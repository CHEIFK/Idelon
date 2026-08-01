import { getHeroLevel, getXpForLevel, getXpRemaining } from '../engine/progression.js';
import { SECTORS_REGISTRY, getGatheringQuantityMultiplier, isMiningActivityUnlocked, getActivityOwningAreaId } from '../utils/sectorMap.js';

/**
 * Game Service Layer.
 * High-level orchestration facade over engine components.
 * Serves as the single public API for all frontends (Discord, Web, Mobile, etc.).
 */
export class GameService {
  constructor(engine) {
    this.engine = engine;
  }

  /**
   * Start or create player session.
   */
  async start(playerId, playerName = 'Hero') {
    let player = await this.engine.player.load(playerId);
    if (!player) {
      player = this.engine.player.create(playerId, playerName);
      await this.engine.player.save(player);
    }
    const profile = await this.getProfile(playerId);
    return {
      success: true,
      player,
      profile
    };
  }

  /**
   * Get player profile & stats.
   */
  async getProfile(playerId) {
    const player = await this.getPlayer(playerId);
    const equippedStats = this.engine.equipment.getTotalStats(player);
    return {
      id: player.id,
      name: player.name,
      level: player.level || 1,
      heroXp: player.heroXp || 0,
      currentAreaId: player.currentAreaId || 'starter_village',
      currencies: { ...player.currencies },
      equippedStats
    };
  }

  /**
   * Start a gathering / mining activity.
   */
  async mine(playerId, activityId) {
    const player = await this.getPlayer(playerId);
    const content = this.engine.content;
    const activityDef = content.getActivity(activityId);

    if (!activityDef) {
      throw new Error(`Activity '${activityId}' not found in content loader.`);
    }

    if (activityDef.skillId === 'mining') {
      if (!isMiningActivityUnlocked(player, activityDef, content)) {
        const owningAreaId = getActivityOwningAreaId(activityDef, content);
        return { success: false, reason: 'sector_locked', owningAreaId };
      }
    }

    const result = this.engine.activities.start(player, activityId);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Auto-mine: start all mining activities unlocked by the player's explored sectors (visitedAreas).
   * Stores a multi-activity record in player.currentActivity without touching the engine.
   */
  async mineAuto(playerId) {
    const player = await this.getPlayer(playerId);
    const content = this.engine.content;

    const allActivities = content.getAll('activities');
    const chosen = allActivities.filter(act => {
      if (act.skillId !== 'mining') return false;
      return isMiningActivityUnlocked(player, act, content);
    });

    if (chosen.length === 0) {
      throw new Error('No mining activities are available in your explored sectors.');
    }

    const now = Date.now();
    player.currentActivity = {
      mode: 'auto',
      ids: chosen.map(a => a.id),
      skillId: 'mining',
      startTime: now,
      lastClaimed: now
    };

    await this.savePlayer(player);

    return {
      success: true,
      mode: 'auto',
      activities: chosen,
      count: chosen.length
    };
  }

  /**
   * Claim offline / accumulated activity progress.
   * Supports both single-activity and auto (multi-activity) modes.
   */
  async claimActivity(playerId) {
    const player = await this.getPlayer(playerId);

    if (player.currentActivity?.mode === 'auto') {
      return this._claimAutoActivity(player);
    }

    const levelBefore = player.skills?.mining?.level || 1;
    const result = this.engine.activities.claim(player);

    // Attach mining progress + level-up rewards if this was a mining activity
    if (result && player.currentActivity?.skillId === 'mining') {
      const levelUps = this._computeLevelUpRewards(player, 'mining', levelBefore);
      result.miningProgress = this._miningProgress(player);
      result.levelUps = levelUps;
    }

    await this.savePlayer(player);
    return result;
  }

  /**
   * Internal: claim rewards for all activities in an auto-mining session.
   * Distributes elapsed time fairly across all active resources.
   */
  async _claimAutoActivity(player) {
    const { ids, lastClaimed } = player.currentActivity;
    const content = this.engine.content;
    const now = Date.now();
    const elapsedMs = now - lastClaimed;

    const combinedItems = new Map();
    let totalXp = 0;
    let totalCycles = 0;
    const combinedCurrencies = {};

    // Each resource gets a fair share of the elapsed time
    for (const activityId of ids) {
      const actDef = content.getActivity(activityId);
      if (!actDef) continue;

      const cycles = Math.floor(elapsedMs / (actDef.durationMs * ids.length));
      if (cycles <= 0) continue;

      totalCycles += cycles;

      // Roll loot table
      const lootTable = content.getLootTable(actDef.lootTableId);
      if (lootTable && Array.isArray(lootTable.entries)) {
        for (let i = 0; i < cycles; i++) {
          for (const entry of lootTable.entries) {
            if (Math.random() <= entry.chance) {
              const min = entry.min || 1;
              const max = entry.max || 1;
              const qty = Math.floor(Math.random() * (max - min + 1)) + min;
              combinedItems.set(entry.itemId, (combinedItems.get(entry.itemId) || 0) + qty);
            }
          }
        }
      }

      // Accumulate XP
      totalXp += (actDef.xpPerCycle || 10) * cycles;

      // Accumulate currency rewards
      if (actDef.currencyRewards) {
        for (const [curr, amtPerCycle] of Object.entries(actDef.currencyRewards)) {
          combinedCurrencies[curr] = (combinedCurrencies[curr] || 0) + amtPerCycle * cycles;
        }
      }
    }

    if (totalCycles <= 0) {
      return { cyclesCompleted: 0, elapsedMs, itemsGained: [], xpGained: 0, currenciesGained: {}, mode: 'auto', miningProgress: this._miningProgress(player), levelUps: [] };
    }

    // Award items with yield multiplier applied
    const itemsGained = [];
    for (const [itemId, baseAmount] of combinedItems.entries()) {
      const mult = getGatheringQuantityMultiplier(player, itemId, content);
      const finalAmount = Math.floor(baseAmount * mult);
      this.engine.inventory.addItem(player, itemId, finalAmount);
      itemsGained.push({ itemId, amount: finalAmount });
    }

    // Award currency
    for (const [curr, amount] of Object.entries(combinedCurrencies)) {
      this.engine.economy.addCurrency(player, curr, amount);
    }

    // Award XP and track level-ups
    const levelBefore = player.skills?.mining?.level || 1;
    this.engine.skills.addXP(player, 'mining', totalXp);
    const levelUps = this._computeLevelUpRewards(player, 'mining', levelBefore);

    // Advance lastClaimed so next claim starts from now
    player.currentActivity.lastClaimed = now;

    await this.savePlayer(player);

    return {
      mode: 'auto',
      cyclesCompleted: totalCycles,
      elapsedMs,
      itemsGained,
      xpGained: totalXp,
      currenciesGained: combinedCurrencies,
      miningProgress: this._miningProgress(player),
      levelUps
    };
  }

  /**
   * Craft an item using a recipe.
   */
  async craft(playerId, recipeId) {
    const player = await this.getPlayer(playerId);
    const result = this.engine.crafting.craft(player, recipeId);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Equip an item from inventory.
   */
  async equip(playerId, itemInput) {
    const player = await this.getPlayer(playerId);
    const itemId = this.engine.content.resolveItemId(itemInput, player.inventory);
    const result = this.engine.equipment.equip(player, itemId);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Unequip an item from a slot.
   */
  async unequip(playerId, slot) {
    const player = await this.getPlayer(playerId);
    const result = this.engine.equipment.unequip(player, slot);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Engage in turn-based combat with an enemy.
   */
  async fight(playerId, enemyId) {
    const player = await this.getPlayer(playerId);

    // Validate enemy ID exists
    const enemyDef = this.engine.content.getEnemy(enemyId);
    if (!enemyDef) {
      return {
        success: false,
        reason: 'unknown_enemy',
        enemyId
      };
    }

    const result = this.engine.combat.simulate(player, enemyId);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Interact with an NPC in the current area.
   */
  async talkToNpc(playerId, npcId) {
    const player = await this.getPlayer(playerId);
    const result = this.engine.world.npc.talk(player, npcId);
    if (!result) {
      return { success: false, reason: 'npc_not_found', npcId };
    }
    return {
      success: true,
      npc: result.npc,
      dialogue: result.dialog
    };
  }

  /**
   * Accept a quest.
   */
  async acceptQuest(playerId, questId) {
    const player = await this.getPlayer(playerId);
    const result = this.engine.quests.accept(player, questId);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Complete a quest.
   */
  async completeQuest(playerId, questId) {
    const player = await this.getPlayer(playerId);
    const result = this.engine.quests.complete(player, questId);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Travel to an unlocked world region.
   */
  async travel(playerId, areaId) {
    const player = await this.getPlayer(playerId);
    const result = this.engine.world.travel(player, areaId);
    if (result.success) {
      if (!Array.isArray(player.visitedAreas)) {
        player.visitedAreas = ['starter_village'];
      }
      if (!player.visitedAreas.includes(areaId)) {
        player.visitedAreas.push(areaId);
      }
    }
    await this.savePlayer(player);
    return result;
  }

  /**
   * Get player inventory.
   */
  async getInventory(playerId) {
    const player = await this.getPlayer(playerId);
    return this.engine.inventory.getInventory(player);
  }

  /**
   * Get player equipment.
   */
  async getEquipment(playerId) {
    const player = await this.getPlayer(playerId);
    return this.engine.equipment.getEquipped(player);
  }

  /**
   * Get player skills.
   * SkillsModule has no getSkills(); return player.skills directly.
   */
  async getSkills(playerId) {
    const player = await this.getPlayer(playerId);
    return { ...(player.skills || {}) };
  }

  /**
   * Get player quest log.
   */
  async getQuestLog(playerId) {
    const player = await this.getPlayer(playerId);
    return { ...(player.quests || {}) };
  }

  /**
   * Deposit items from inventory into storage (bank).
   */
  async depositItem(playerId, itemInput, count = 1) {
    const player = await this.getPlayer(playerId);
    const itemId = this.engine.content.resolveItemId(itemInput, player.inventory);

    const ownedQty = player.inventory[itemId] || 0;
    if (ownedQty <= 0) {
      return { success: false, reason: 'no_items_in_inventory', itemInput, itemId };
    }

    let actualCount = count;
    if (typeof count === 'string' && count.toLowerCase() === 'all') {
      actualCount = ownedQty;
    } else {
      actualCount = Math.min(ownedQty, Math.max(1, parseInt(count, 10) || 1));
    }

    this.engine.inventory.removeItem(player, itemId, actualCount);

    if (!player.storage) player.storage = {};
    player.storage[itemId] = (player.storage[itemId] || 0) + actualCount;

    await this.savePlayer(player);

    return {
      success: true,
      itemId,
      amount: actualCount,
      remainingInventory: player.inventory[itemId] || 0,
      totalStorage: player.storage[itemId]
    };
  }

  /**
   * Withdraw items from storage (bank) into inventory.
   */
  async withdrawItem(playerId, itemInput, count = 1) {
    const player = await this.getPlayer(playerId);
    const itemId = this.engine.content.resolveItemId(itemInput, player.storage);

    if (!player.storage) player.storage = {};
    const storedQty = player.storage[itemId] || 0;

    if (storedQty <= 0) {
      return { success: false, reason: 'no_items_in_storage', itemInput, itemId };
    }

    let actualCount = count;
    if (typeof count === 'string' && count.toLowerCase() === 'all') {
      actualCount = storedQty;
    } else {
      actualCount = Math.min(storedQty, Math.max(1, parseInt(count, 10) || 1));
    }

    player.storage[itemId] -= actualCount;
    if (player.storage[itemId] <= 0) delete player.storage[itemId];

    this.engine.inventory.addItem(player, itemId, actualCount);
    await this.savePlayer(player);

    return {
      success: true,
      itemId,
      amount: actualCount,
      remainingStorage: player.storage[itemId] || 0,
      totalInventory: player.inventory[itemId] || 0
    };
  }

  /**
   * Get player storage contents.
   */
  async getStorage(playerId) {
    const player = await this.getPlayer(playerId);
    return { ...(player.storage || {}) };
  }

  /**
   * Sell items from player inventory for gold.
   * Supports single item sales OR .sell all (sells all items with category === 'Ore').
   */
  async sellItem(playerId, itemInput, count = 1) {
    const player = await this.getPlayer(playerId);

    // Support .sell all / /sell all (Sell all items with category === "Ore")
    if (itemInput && itemInput.trim().toLowerCase() === 'all') {
      const inventory = { ...(player.inventory || {}) };
      const itemsSold = [];
      let totalGold = 0;

      for (const [itemId, qty] of Object.entries(inventory)) {
        if (qty <= 0) continue;
        const itemDef = this.engine.content.getItem(itemId);
        if (itemDef && itemDef.category === 'Ore') {
          const unitValue = itemDef.sellValue !== undefined ? itemDef.sellValue : (itemDef.value || 0.5);
          const goldEarned = Number((unitValue * qty).toFixed(2));
          this.engine.inventory.removeItem(player, itemId, qty);
          totalGold += goldEarned;
          itemsSold.push({
            itemId,
            name: itemDef.name,
            quantity: qty,
            unitValue,
            goldEarned
          });
        }
      }

      if (itemsSold.length === 0) {
        return { success: false, reason: 'no_ores_owned', itemInput: 'all' };
      }

      totalGold = Number(totalGold.toFixed(2));
      this.engine.economy.addCurrency(player, 'gold', totalGold);
      await this.savePlayer(player);

      return {
        success: true,
        isSellAllOres: true,
        itemsSold,
        totalGold,
        newGoldBalance: Number(this.engine.economy.getCurrencies(player).gold.toFixed(2))
      };
    }

    // Single item sale
    const itemId = this.engine.content.resolveItemId(itemInput, player.inventory);
    const ownedQty = player.inventory[itemId] || 0;

    if (ownedQty <= 0) {
      return { success: false, reason: 'insufficient_items', itemInput, itemId, ownedQty: 0 };
    }

    let requestedCount = 1;
    if (typeof count === 'string' && count.toLowerCase() === 'all') {
      requestedCount = ownedQty;
    } else {
      requestedCount = parseInt(count, 10) || 1;
    }

    if (requestedCount > ownedQty) {
      const itemDef = this.engine.content.getItem(itemId);
      const itemName = itemDef?.name || itemInput;
      return {
        success: false,
        reason: 'quantity_exceeded',
        itemInput,
        itemId,
        ownedQty,
        requestedCount,
        message: `You only own ${ownedQty} ${itemName}.`
      };
    }

    const actualCount = requestedCount;
    const itemDef = this.engine.content.getItem(itemId);
    const itemValue = itemDef?.sellValue !== undefined ? itemDef.sellValue : (itemDef?.value || 0.5);
    const totalGold = Number((itemValue * actualCount).toFixed(2));

    this.engine.inventory.removeItem(player, itemId, actualCount);
    this.engine.economy.addCurrency(player, 'gold', totalGold);
    await this.savePlayer(player);

    return {
      success: true,
      itemId,
      count: actualCount,
      itemValue,
      totalGold,
      newGoldBalance: Number(this.engine.economy.getCurrencies(player).gold.toFixed(2))
    };
  }

  /**
   * Get player wallet (gold + sterlings only).
   */
  async getBalance(playerId) {
    const player = await this.getPlayer(playerId);
    return {
      gold:      Number((player.currencies?.gold || 0).toFixed(2)),
      sterlings: player.currencies?.sterlings || 0
    };
  }

  /**
   * Compute level-up rewards and unlock notifications for levels gained since levelBefore.
   * Awards +5 sterlings per level gained. Persists directly on player.
   * Returns array of level-up objects (one per level gained, empty if none).
   * @internal
   */
  _computeLevelUpRewards(player, skillId, levelBefore) {
    const levelAfter = player.skills?.[skillId]?.level || 1;
    if (levelAfter <= levelBefore) return [];

    const content = this.engine.content;
    const allActivities = content.getAll('activities');
    const allAreas      = content.getAll('areas');
    const STERLINGS_PER_LEVEL = 5;
    const levelUps = [];

    if (!player.currencies) player.currencies = { gold: 0, sterlings: 0 };

    for (let lvl = levelBefore + 1; lvl <= levelAfter; lvl++) {
      // Award sterlings
      player.currencies.sterlings = (player.currencies.sterlings || 0) + STERLINGS_PER_LEVEL;

      // Dynamically find what becomes available at this level for the given skill path
      const unlockedActivities = allActivities.filter(
        a => a.skillId === skillId && a.levelReq === lvl
      );
      const unlockedAreas = allAreas.filter(a => {
        if (a.levelReq !== lvl || a.reqQuestId) return false;
        const sector = SECTORS_REGISTRY.find(s => s.areaId === a.id);
        return sector && sector.path === skillId;
      });

      const unlocks = [];
      for (const act of unlockedActivities) {
        // Pull the primary item name from its loot table
        const lt = content.getLootTable(act.lootTableId);
        const itemId = lt?.entries?.[0]?.itemId;
        const itemDef = itemId ? content.getItem(itemId) : null;
        unlocks.push(itemDef?.name || act.name);
      }
      const unlockedAreaIds = unlockedAreas.map(a => a.id);

      for (const area of unlockedAreas) {
        unlocks.push(`${area.name} (area)`);
      }

      levelUps.push({
        from: lvl - 1,
        to:   lvl,
        sterlingsAwarded: STERLINGS_PER_LEVEL,
        unlocks,
        unlockedAreaIds
      });
    }

    return levelUps;
  }

  /**
   * Compute current mining XP progress for display.
   * Uses data-driven XP table progression helpers.
   * @internal
   */
  _miningProgress(player) {
    const skill     = player.skills?.mining || { xp: 0, level: 1 };
    const currentXp = skill.xp  || 0;
    const xpTable   = this.engine.content?.getHeroXpTable();
    const level     = getHeroLevel(currentXp, xpTable);
    const xpForNext = getXpForLevel(level + 1, xpTable);
    const remaining = getXpRemaining(currentXp, xpTable);
    return { level, totalXp: currentXp, xpForNext, remaining };
  }

  /**
   * Get available items in shop or sell prices.
   */
  async getShop(playerId) {
    const player = await this.getPlayer(playerId);
    const inventory = this.engine.inventory.getInventory(player);
    const itemsForSale = [];

    for (const [itemId, qty] of Object.entries(inventory)) {
      const itemDef = this.engine.content.getItem(itemId);
      const unitVal = itemDef?.sellValue !== undefined ? itemDef.sellValue : (itemDef?.value || 0.5);
      const totalVal = Number((unitVal * qty).toFixed(2));
      itemsForSale.push({
        id: itemId,
        name: itemDef?.name || itemId,
        category: itemDef?.category || 'Item',
        miningLevel: itemDef?.miningLevel || null,
        quantity: qty,
        unitValue: unitVal,
        totalValue: totalVal
      });
    }

    return {
      currencies: { ...player.currencies },
      inventorySellItems: itemsForSale
    };
  }

  /**
   * Internal helper to load player.
   */
  async getPlayer(playerId) {
    let player = await this.engine.player.load(playerId);
    if (!player) {
      player = this.engine.player.create(playerId, 'Hero');
      await this.engine.player.save(player);
    }
    return player;
  }

  /**
   * Internal helper to save player.
   */
  async savePlayer(player) {
    await this.engine.player.save(player);
  }
}
