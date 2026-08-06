import { getHeroLevel, getXpForLevel, getXpRemaining } from '../engine/progression.js';
import { syncPlayerUnlockedAreas } from '../engine/player.js';
import { SECTORS_REGISTRY, getUnlockedAreaIdsForHeroLevel, getGatheringQuantityMultiplier, isMiningActivityUnlocked, getActivityOwningAreaId, getEnemiesForVisitedAreas, getRecommendedSectorForPlayer } from '../utils/sectorMap.js';
import { AUTO_HUNT_CYCLE_MS, SINGLE_HUNT_SPEED_MULTIPLIER, MAX_OFFLINE_MINING_DURATION_MS } from '../constants/index.js';
import { getLootChance } from '../engine/combat/loot.js';

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
    const attributes = this.engine.attributes ? this.engine.attributes.getAttributes(player) : (player.attributes || {});
    const maxHp = this.engine.attributes ? this.engine.attributes.calculateMaxHealth(player, equippedStats) : 100 + ((player.level || 1) * 10);
    const hp = typeof player.hp === 'number' && Number.isFinite(player.hp)
      ? Math.max(0, Math.min(player.hp, maxHp))
      : maxHp;
    const battleRank = this.engine.attributes ? this.engine.attributes.getBattleRank(player) : 'Recruit';
    const regenInfo = this.engine.attributes ? this.engine.attributes.calculateRegeneration(player) : { displayText: '+5 HP every 5 minutes' };

    return {
      id: player.id,
      name: player.name,
      level: player.level || 1,
      heroXp: player.heroXp || 0,
      currentAreaId: player.currentAreaId || 'starter_village',
      currencies: { ...player.currencies },
      equippedStats,
      equipment: player.equipment || {},
      attributes,
      hp,
      maxHp,
      battleRank,
      regenerationText: regenInfo.displayText
    };
  }

  /**
   * Read-only data needed to render the interactive hunt screen.
   * Combat selection and resolution remain owned by huntInstant().
   */
  async getHuntOverview(playerId) {
    const player = await this.getPlayer(playerId);
    const content = this.engine.content;
    const heroXp = player.heroXp || 0;
    const level = player.level || getHeroLevel(heroXp, content.getHeroXpTable?.());
    const nextLevelXp = getXpForLevel(level + 1, content.getHeroXpTable?.());
    const enemyIds = getEnemiesForVisitedAreas(player, content);

    return {
      gold: player.currencies?.gold || 0,
      level,
      heroXp,
      nextLevelXp,
      currentAreaId: player.currentAreaId || 'starter_village',
      activeBuffs: this.engine.potions?.getActiveBuffs(player) || [],
      availableEnemies: enemyIds.map(id => content.getEnemy(id)).filter(Boolean)
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

    if (player.currentActivity) {
      if (player.currentActivity.id === activityId || player.currentActivity.skillId === activityDef.skillId) {
        return { success: false, alreadyActive: true, reason: 'already_mining', skillId: activityDef.skillId, activity: activityDef, currentActivity: player.currentActivity };
      }
    }

    const result = this.engine.activities.start(player, activityId);
    if (result && result.alreadyActive) {
      return { success: false, alreadyActive: true, reason: 'already_mining', skillId: activityDef.skillId, activity: activityDef, currentActivity: player.currentActivity };
    }
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

    if (player.currentActivity) {
      if (player.currentActivity.mode === 'auto' || player.currentActivity.skillId === 'mining') {
        return {
          success: false,
          alreadyActive: true,
          reason: 'already_mining',
          skillId: 'mining',
          activities: chosen,
          count: chosen.length,
          currentActivity: player.currentActivity
        };
      }
    }

    const now = Date.now();
    player.currentActivity = {
      mode: 'auto',
      ids: chosen.map(a => a.id),
      skillId: 'mining',
      startTime: now,
      lastClaimed: now,
      // Entries are created lazily by _syncAutoMiningActivities. Keeping the
      // initial map empty preserves legacy offline simulations that backdate
      // lastClaimed while still timestamping newly added activities.
      activityStartedAt: {}
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
   * Craft an item using a recipe and persist the resulting player state.
   */
  async craft(playerId, recipeId, count = 1) {
    const player = await this.getPlayer(playerId);
    const recipeBeforeCraft = this.engine.content.getRecipe(recipeId);
    const levelBefore = player.skills?.[recipeBeforeCraft?.skillId]?.level || 1;
    const heroLevelBefore = player.level || 1;
    const result = this.engine.crafting.craft(player, recipeId, count);
    if (result.success) {
      const recipe = this.engine.content.getRecipe(recipeId);
      if (recipe?.skillId) {
        const progressionRewards = this._computeProgressionRewards(player, recipe.skillId, levelBefore, heroLevelBefore);
        result.levelUps = progressionRewards.levelUps;
        result.heroLevelUps = progressionRewards.heroLevelUps;
      }
    }
    await this.savePlayer(player);
    return result;
  }

  /**
   * Equip an item from inventory and persist the resulting player state.
   */
  async equip(playerId, itemInput) {
    const player = await this.getPlayer(playerId);
    const itemId = this.engine.content.resolveItemId(itemInput, player.inventory);
    const result = this.engine.equipment.equip(player, itemId);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Unequip an item from a slot and persist the resulting player state.
   */
  async unequip(playerId, slot) {
    const player = await this.getPlayer(playerId);
    const result = this.engine.equipment.unequip(player, slot);
    await this.savePlayer(player);
    return result;
  }

  /**
   * Internal helper to claim mining activity (auto or single).
   */
  async _claimMining(player) {
    if (!player.currentActivity) return null;

    if (player.currentActivity.mode === 'auto') {
      return this._claimAutoActivity(player);
    }

    const levelBefore = player.skills?.mining?.level || 1;
    const heroLevelBefore = player.level || 1;
    const result = this.engine.activities.claim(player);

    if (!result) {
      // A stale activity ID from an old or manually edited save must not
      // remain permanently claimable-but-unrewardable.
      player.currentActivity = null;
      await this.savePlayer(player);
      return null;
    }

    // Attach mining progress + level-up rewards if this was a mining activity
    if (result && player.currentActivity?.skillId === 'mining') {
      const progressionRewards = this._computeProgressionRewards(player, 'mining', levelBefore, heroLevelBefore);
      result.miningProgress = this._miningProgress(player);
      result.levelUps = progressionRewards.levelUps;
      result.heroLevelUps = progressionRewards.heroLevelUps;
    }

    await this.savePlayer(player);
    return result;
  }

  /**
   * Internal: claim rewards for all activities in an auto-mining session.
   * Distributes elapsed time fairly across all active resources.
   */
  async _claimAutoActivity(player) {
    this._syncAutoMiningActivities(player);
    const { ids, lastClaimed, activityStartedAt = {} } = player.currentActivity;
    const content = this.engine.content;
    const now = Date.now();
    const rawElapsedMs = Math.max(0, now - lastClaimed);
    const elapsedMs = Math.min(rawElapsedMs, MAX_OFFLINE_MINING_DURATION_MS);

    const combinedItems = new Map();
    let totalXp = 0;
    let totalCycles = 0;
    const combinedCurrencies = {};

    // Each resource gets a fair share of the elapsed time
    for (const activityId of ids) {
      const actDef = content.getActivity(activityId);
      if (!actDef) continue;

      // Newly unlocked activities begin when they are added to the session;
      // otherwise travelling to a sector after a long offline period would
      // award that sector's resources for time spent before it was explored.
      const rawActivityElapsedMs = Math.max(0, now - Math.max(
        lastClaimed,
        Number.isFinite(activityStartedAt[activityId]) ? activityStartedAt[activityId] : lastClaimed
      ));
      const activityElapsedMs = Math.min(rawActivityElapsedMs, MAX_OFFLINE_MINING_DURATION_MS);
      const speedMultiplier = this.engine.potions?.getMiningSpeedMultiplier
        ? this.engine.potions.getMiningSpeedMultiplier(player)
        : 1;
      const effectiveDuration = (actDef.durationMs * ids.length) / speedMultiplier;
      const cycles = Math.floor(activityElapsedMs / effectiveDuration);
      if (cycles <= 0) continue;

      totalCycles += cycles;

      // Roll loot table
      const lootTable = content.getLootTable(actDef.lootTableId);
      if (lootTable && Array.isArray(lootTable.entries)) {
        for (let i = 0; i < cycles; i++) {
          const luckPercent = this.engine.potions?.getModifier
            ? this.engine.potions.getModifier(player, 'luck')
            : 0;
          for (const entry of lootTable.entries) {
            if (Math.random() <= getLootChance(entry.chance, luckPercent)) {
              const min = entry.min ?? entry.amount ?? 1;
              const max = entry.max ?? entry.amount ?? 1;
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
      return {
        cyclesCompleted: 0,
        elapsedMs,
        itemsGained: [],
        xpGained: 0,
        currenciesGained: {},
        mode: 'auto',
        miningProgress: this._miningProgress(player),
        levelUps: [],
        heroLevelUps: []
      };
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
    const heroLevelBefore = player.level || 1;
    const xpResult = this.engine.skills.addXP(player, 'mining', totalXp);
    totalXp = xpResult.xpGained ?? totalXp;
    const progressionRewards = this._computeProgressionRewards(player, 'mining', levelBefore, heroLevelBefore);

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
      levelUps: progressionRewards.levelUps,
      heroLevelUps: progressionRewards.heroLevelUps
    };
  }

  /**
   * Claim offline / accumulated activity progress for mining / gathering.
   */
  async claimActivity(playerId) {
    const player = await this.getPlayer(playerId);
    if (!player.currentActivity) {
      return null;
    }
    return this._claimMining(player);
  }

  /**
   * Instant Combat: Simulate encounter against unlocked enemies immediately.
   */
  async huntInstant(playerId, targetInput = null) {
    const player = await this.getPlayer(playerId);
    const content = this.engine.content;
    const availableEnemyIds = getEnemiesForVisitedAreas(player, content);

    if (availableEnemyIds.length === 0) {
      return { success: false, reason: 'no_enemies' };
    }

    let selectedEnemyIds = [];

    if (targetInput) {
      const clean = targetInput.trim().toLowerCase().replace(/\s+/g, '_');

      // Match enemy ID or name in available enemies
      selectedEnemyIds = availableEnemyIds.filter(id => {
        if (id === clean || id.includes(clean)) return true;
        const enemyDef = content.getEnemy(id);
        if (enemyDef && enemyDef.name.toLowerCase().includes(targetInput.trim().toLowerCase())) return true;
        return false;
      });

      if (selectedEnemyIds.length === 0) {
        // Check if enemy exists in content loader at all
        const allEnemies = content.getAll('enemies') || [];
        const existsGlobal = allEnemies.some(e => e.id === clean || e.id.includes(clean) || e.name.toLowerCase().includes(targetInput.trim().toLowerCase()));
        if (existsGlobal) {
          return { success: false, reason: 'enemy_not_accessible', enemyId: targetInput };
        }
        return { success: false, reason: 'unknown_enemy', enemyId: targetInput };
      }
    } else {
      selectedEnemyIds = availableEnemyIds;
    }

    const defeatedEnemies = [];
    const combinedItems = new Map();
    const combinedCurrencies = {};
    let totalXp = 0;
    let playerDied = false;
    let lastDurabilityChanges = { broken: [], reduced: [], replacements: [] };
    let lastEquipmentChanges = { equipped: [] };
    const combatLevelBefore = player.skills?.combat?.level || 1;
    const heroLevelBefore = player.level || 1;

    const equippedStats = this.engine.equipment ? this.engine.equipment.getTotalStats(player) : {};
    const maxHp = this.engine.attributes
      ? this.engine.attributes.calculateMaxHealth(player, equippedStats)
      : 100 + (player.level * 10) + (equippedStats.health || 0);
    if (typeof player.hp !== 'number' || !Number.isFinite(player.hp)) {
      player.hp = maxHp;
    } else {
      player.hp = Math.max(0, Math.min(player.hp, maxHp));
    }

    for (const enemyId of selectedEnemyIds) {
      const res = this.engine.combat.simulate(player, enemyId);
      if (!res || !res.success) continue;

      if (res.victory) {
        const enemyDef = content.getEnemy(enemyId);
        if (enemyDef) {
          defeatedEnemies.push({ id: enemyDef.id, name: enemyDef.name, level: enemyDef.level || 1 });
        }
        for (const drop of (res.loot || [])) {
          combinedItems.set(drop.itemId, (combinedItems.get(drop.itemId) || 0) + drop.amount);
        }
        totalXp += res.xpGained || 0;
        for (const [curr, amt] of Object.entries(res.currenciesGained || {})) {
          combinedCurrencies[curr] = (combinedCurrencies[curr] || 0) + amt;
        }
        if (res.durabilityChanges) lastDurabilityChanges = res.durabilityChanges;
        if (res.equipmentChanges) lastEquipmentChanges = res.equipmentChanges;
      } else {
        if (res.playerDied) {
          playerDied = true;
          player.hp = 1; // Respawn with 1 HP
          break;
        }
      }
    }

    const progressionRewards = this._computeProgressionRewards(player, 'combat', combatLevelBefore, heroLevelBefore);
    await this.savePlayer(player);

    return {
      success: true,
      victory: !playerDied,
      playerDied,
      enemiesDefeated: defeatedEnemies,
      enemies: defeatedEnemies,
      hpRemaining: typeof player.hp === 'number' ? player.hp : maxHp,
      maxHp,
      xpGained: totalXp,
      currenciesGained: combinedCurrencies,
      itemsGained: Array.from(combinedItems.entries()).map(([itemId, amount]) => ({ itemId, amount })),
      loot: Array.from(combinedItems.entries()).map(([itemId, amount]) => ({ itemId, amount })),
      durabilityChanges: lastDurabilityChanges,
      equipmentChanges: lastEquipmentChanges,
      levelUps: progressionRewards.levelUps,
      heroLevelUps: progressionRewards.heroLevelUps,
      recommendedSector: playerDied ? getRecommendedSectorForPlayer(
        player,
        content,
        {
          attack: 10 + (player.level || 1) * 2 + (equippedStats.attack || 0),
          strength: (player.attributes?.strength || 1) - 1,
          defense: equippedStats.defense || 0,
          maxHp
        }
      ) : null
    };
  }

  async huntAuto(playerId) {
    return this.huntInstant(playerId);
  }

  async huntSingle(playerId, enemyId) {
    return this.huntInstant(playerId, enemyId);
  }

  async hunt(playerId, enemyId) {
    return this.huntInstant(playerId, enemyId);
  }

  async fight(playerId, enemyId) {
    return this.huntInstant(playerId, enemyId);
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
    if (result.success === false) {
      return { success: false, reason: result.reason, npcId, areaId: result.npc?.areaId };
    }
    return {
      success: true,
      npc: result.npc,
      dialogue: result.dialog
    };
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
      this._syncAutoMiningActivities(player);
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
   * Read-only inventory data for the hunt interface.
   * Inventory presentation stays separate from the general inventory command.
   */
  async getHuntInventory(playerId) {
    const player = await this.getPlayer(playerId);
    const inventory = this.engine.inventory.getInventory(player);
    return {
      inventory,
      gold: player.currencies?.gold || 0,
      slotsUsed: Object.keys(inventory).length
    };
  }

  /**
   * Build the two hunt-interface sale previews from canonical item metadata.
   * No inventory or currency state is mutated here.
   */
  async getInventorySaleGroups(playerId) {
    const shop = await this.getShop(playerId);
    const content = this.engine.content;
    const isMonsterDrop = item => {
      const itemDef = content.getItem(item.id);
      return itemDef
        && itemDef.category !== 'Equipment'
        && (itemDef.obtainMethod === 'combat' || itemDef.obtainMethod === 'hunting');
    };

    return {
      ores: shop.inventorySellItems.filter(item => content.getItem(item.id)?.category === 'Ore'),
      monsterDrops: shop.inventorySellItems.filter(isMonsterDrop)
    };
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
   * Deposit items from inventory into storage (bank).
   */
  async depositItem(playerId, itemInput, count = 1) {
    const player = await this.getPlayer(playerId);
    if (!(typeof count === 'string' && count.toLowerCase() === 'all')
      && count !== undefined && count !== null && count !== ''
      && !/^[1-9]\d*$/.test(String(count))) {
      return { success: false, reason: 'invalid_quantity', message: 'Quantity must be a positive integer.' };
    }
    const itemId = this.engine.content.resolveItemId(itemInput, player.inventory);

    const ownedQty = player.inventory[itemId] || 0;
    if (ownedQty <= 0) {
      return { success: false, reason: 'no_items_in_inventory', itemInput, itemId };
    }

    let actualCount = count;
    if (typeof count === 'string' && count.toLowerCase() === 'all') {
      actualCount = ownedQty;
    } else {
      actualCount = Math.min(ownedQty, count === undefined || count === null || count === '' ? 1 : Number(count));
    }

    const storedQty = Number.isSafeInteger(player.storage?.[itemId]) && player.storage[itemId] >= 0
      ? player.storage[itemId]
      : 0;
    if (actualCount > Number.MAX_SAFE_INTEGER - storedQty) {
      return { success: false, reason: 'storage_limit', message: 'Bank storage cannot hold that quantity.' };
    }

    this.engine.inventory.removeItem(player, itemId, actualCount);

    if (!player.storage) player.storage = {};
    player.storage[itemId] = storedQty + actualCount;

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
    if (!(typeof count === 'string' && count.toLowerCase() === 'all')
      && count !== undefined && count !== null && count !== ''
      && !/^[1-9]\d*$/.test(String(count))) {
      return { success: false, reason: 'invalid_quantity', message: 'Quantity must be a positive integer.' };
    }
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
      actualCount = Math.min(storedQty, count === undefined || count === null || count === '' ? 1 : Number(count));
    }

    const inventoryQty = Number.isSafeInteger(player.inventory?.[itemId]) && player.inventory[itemId] >= 0
      ? player.inventory[itemId]
      : 0;
    if (actualCount > Number.MAX_SAFE_INTEGER - inventoryQty) {
      return { success: false, reason: 'inventory_limit', message: 'Inventory cannot hold that quantity.' };
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
   * Return the data-driven potion catalogue and the player's current gold.
   */
  async getPotionShop(playerId) {
    const player = await this.getPlayer(playerId);
    return {
      currencies: { ...player.currencies },
      potions: this.engine.content.getAllPotions().map(potion => ({
        ...potion,
        owned: player.inventory?.[potion.id] || 0
      }))
    };
  }

  /**
   * Purchase stackable potions with gold.
   */
  async buyPotion(playerId, potionInput, count = 1) {
    const player = await this.getPlayer(playerId);
    const rawCount = typeof count === 'string' ? count.trim() : count;
    if ((typeof rawCount === 'string' && rawCount.toLowerCase() === 'all') || rawCount === '') {
      return { success: false, reason: 'invalid_quantity', message: 'Quantity must be a positive integer.' };
    }
    const quantity = typeof rawCount === 'number'
      ? rawCount
      : (/^[1-9]\d*$/.test(String(rawCount)) ? Number(rawCount) : NaN);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { success: false, reason: 'invalid_quantity', message: 'Quantity must be a positive integer.' };
    }

    const potionId = this.engine.content.resolveItemId(potionInput);
    const potion = this.engine.content.getPotion(potionId);
    if (!potion) {
      return { success: false, reason: 'unknown_potion', potionInput, potionId };
    }

    const totalCost = potion.buyPrice * quantity;
    const currentGold = Number.isFinite(player.currencies?.gold) && player.currencies.gold >= 0
      ? player.currencies.gold
      : 0;
    const owned = Number.isSafeInteger(player.inventory?.[potion.id]) && player.inventory[potion.id] >= 0
      ? player.inventory[potion.id]
      : 0;
    if (!Number.isSafeInteger(quantity)
      || !Number.isFinite(totalCost)
      || totalCost <= 0
      || totalCost > Number.MAX_SAFE_INTEGER
      || currentGold < totalCost) {
      return {
        success: false,
        reason: 'insufficient_gold',
        message: `You need ${totalCost} Gold but only have ${currentGold}.`,
        potion,
        quantity,
        totalCost,
        gold: currentGold
      };
    }
    if (quantity > Number.MAX_SAFE_INTEGER - owned) {
      return { success: false, reason: 'inventory_limit', message: 'Inventory cannot hold that quantity.' };
    }

    if (!this.engine.economy.removeCurrency(player, 'gold', totalCost)) {
      return {
        success: false,
        reason: 'insufficient_gold',
        message: `You need ${totalCost} Gold but only have ${currentGold}.`,
        potion,
        quantity,
        totalCost,
        gold: currentGold
      };
    }
    this.engine.inventory.addItem(player, potion.id, quantity);
    await this.savePlayer(player);

    return {
      success: true,
      potion,
      potionId: potion.id,
      quantity,
      totalCost,
      newGoldBalance: player.currencies.gold,
      totalOwned: player.inventory[potion.id]
    };
  }

  /**
   * Consume one potion from inventory and apply its effect.
   */
  async useItem(playerId, itemInput) {
    const player = await this.getPlayer(playerId);
    const itemId = this.engine.content.resolveItemId(itemInput, player.inventory);
    const result = this.engine.potions.use(player, itemId);
    if (result.success) await this.savePlayer(player);
    return result;
  }

  /**
   * Get currently active, persisted potion buffs after applying elapsed ticks.
   */
  async getBuffs(playerId) {
    const player = await this.getPlayer(playerId);
    const before = JSON.stringify({ activeBuffs: player.activeBuffs, hp: player.hp });
    const buffs = this.engine.potions.getActiveBuffs(player);
    if (JSON.stringify({ activeBuffs: player.activeBuffs, hp: player.hp }) !== before) {
      await this.savePlayer(player);
    }
    return buffs;
  }

  /**
   * Sell items from player inventory for gold.
   * Supports single item sales OR .sell all (sells all items with category === 'Ore').
   */
  async sellItem(playerId, itemInput, count = 1) {
    const player = await this.getPlayer(playerId);

    // Support .sell all / /sell all (Sell all items with category === "Ore")
    if (typeof itemInput === 'string' && itemInput.trim().toLowerCase() === 'all') {
      if (count !== 1) {
        return { success: false, reason: 'invalid_quantity', message: 'Bulk ore sales do not accept a quantity.' };
      }
      const inventory = { ...(player.inventory || {}) };
      const itemsSold = [];
      let totalGold = 0;

      for (const [itemId, qty] of Object.entries(inventory)) {
        if (qty <= 0) continue;
        const itemDef = this.engine.content.getItem(itemId);
        if (itemDef && itemDef.category === 'Ore') {
          const unitValue = itemDef.sellValue !== undefined ? itemDef.sellValue : (itemDef.value || 0.5);
          const goldEarned = Number((unitValue * qty).toFixed(2));
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
      const currentGold = Number.isFinite(player.currencies?.gold) && player.currencies.gold >= 0 ? player.currencies.gold : 0;
      if (!Number.isFinite(totalGold) || totalGold < 0 || totalGold > Number.MAX_SAFE_INTEGER - currentGold) {
        return { success: false, reason: 'currency_limit', message: 'Your gold balance cannot hold that sale.' };
      }
      for (const item of itemsSold) {
        this.engine.inventory.removeItem(player, item.itemId, item.quantity);
      }
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
    let requestedCount = 1;
    if (typeof count === 'string' && count.toLowerCase() === 'all') {
      requestedCount = null;
    } else {
      const parsed = typeof count === 'number' ? count : (typeof count === 'string' && /^[1-9]\d*$/.test(count) ? Number(count) : NaN);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return { success: false, reason: 'invalid_quantity', message: 'Quantity must be a positive integer.' };
      }
      requestedCount = parsed;
    }

    const itemId = this.engine.content.resolveItemId(itemInput, player.inventory);
    const ownedQty = player.inventory[itemId] || 0;

    if (ownedQty <= 0) {
      return { success: false, reason: 'insufficient_items', itemInput, itemId, ownedQty: 0 };
    }

    const itemDef = this.engine.content.getItem(itemId);
    if (!itemDef) {
      return { success: false, reason: 'unknown_item', itemInput, itemId };
    }

    if (requestedCount === null) {
      requestedCount = ownedQty;
    }

    if (requestedCount > ownedQty) {
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
    const itemValue = itemDef?.sellValue !== undefined ? itemDef.sellValue : (itemDef?.value || 0.5);
    const totalGold = Number((itemValue * actualCount).toFixed(2));

    const currentGold = Number.isFinite(player.currencies?.gold) && player.currencies.gold >= 0 ? player.currencies.gold : 0;
    if (!Number.isFinite(totalGold) || totalGold < 0 || totalGold > Number.MAX_SAFE_INTEGER - currentGold) {
      return { success: false, reason: 'currency_limit', message: 'Your gold balance cannot hold that sale.' };
    }

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
   * Sell a hunt-interface inventory group through the existing sellItem API.
   * The group only coordinates existing single-item sale operations.
   */
  async sellInventoryGroup(playerId, group) {
    if (group === 'ores') {
      return this.sellItem(playerId, 'all');
    }

    if (group !== 'monster_drops') {
      return { success: false, reason: 'invalid_sale_group' };
    }

    const saleGroups = await this.getInventorySaleGroups(playerId);
    const items = saleGroups.monsterDrops;
    if (items.length === 0) {
      return { success: false, reason: 'no_monster_drops_owned' };
    }

    const itemsSold = [];
    let totalGold = 0;
    let newGoldBalance = 0;

    for (const item of items) {
      const result = await this.sellItem(playerId, item.id, 'all');
      if (!result.success) continue;
      const itemDef = this.engine.content.getItem(item.id);
      itemsSold.push({
        itemId: item.id,
        name: itemDef?.name || item.name,
        quantity: result.count,
        unitValue: result.itemValue,
        goldEarned: result.totalGold
      });
      totalGold += result.totalGold;
      newGoldBalance = result.newGoldBalance;
    }

    if (itemsSold.length === 0) {
      return { success: false, reason: 'no_monster_drops_owned' };
    }

    return {
      success: true,
      group,
      itemsSold,
      totalGold: Number(totalGold.toFixed(2)),
      newGoldBalance
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
   * Compute skill-level rewards and skill-specific unlocks for levels gained.
   * Hero-Level sector notifications are computed separately below.
   * Awards +5 sterlings per level gained. Persists directly on player.
   * Returns array of level-up objects (one per level gained, empty if none).
   * @internal
   */
  _computeLevelUpRewards(player, skillId, levelBefore) {
    const skillLevelBefore = typeof levelBefore === 'number' && Number.isFinite(levelBefore)
      ? Math.max(1, Math.floor(levelBefore))
      : 1;
    const skillLevelAfter = typeof player.skills?.[skillId]?.level === 'number' && Number.isFinite(player.skills[skillId].level)
      ? Math.max(1, Math.floor(player.skills[skillId].level))
      : 1;
    if (skillLevelAfter <= skillLevelBefore) return [];

    const content = this.engine.content;
    const allActivities = content.getAll('activities');
    const STERLINGS_PER_LEVEL = 5;
    const levelUps = [];

    syncPlayerUnlockedAreas(player);

    if (!player.currencies) player.currencies = { gold: 0, sterlings: 0 };

    for (let lvl = skillLevelBefore + 1; lvl <= skillLevelAfter; lvl++) {
      // Award sterlings
      player.currencies.sterlings = (player.currencies.sterlings || 0) + STERLINGS_PER_LEVEL;

      // Skill progression continues to control skill-specific unlocks.
      const unlockedActivities = allActivities.filter(
        a => a.skillId === skillId && a.levelReq === lvl
      );
      const unlocks = [];
      for (const act of unlockedActivities) {
        // Pull the primary item name from its loot table
        const lt = content.getLootTable(act.lootTableId);
        const itemId = lt?.entries?.[0]?.itemId;
        const itemDef = itemId ? content.getItem(itemId) : null;
        unlocks.push(itemDef?.name || act.name);
      }

      levelUps.push({
        skillId,
        from: lvl - 1,
        to:   lvl,
        sterlingsAwarded: STERLINGS_PER_LEVEL,
        unlocks
      });
    }

    return levelUps;
  }

  /**
   * Compute Hero-Level progression rewards independently from skill rewards.
   * This is the only place that creates sector unlock notifications.
   */
  _computeHeroLevelUpRewards(player, heroLevelBefore = player.level) {
    const previousHeroLevel = typeof heroLevelBefore === 'number' && Number.isFinite(heroLevelBefore)
      ? Math.max(1, Math.floor(heroLevelBefore))
      : 1;
    const currentHeroLevel = typeof player.level === 'number' && Number.isFinite(player.level)
      ? Math.max(1, Math.floor(player.level))
      : 1;

    if (currentHeroLevel <= previousHeroLevel) return [];

    const content = this.engine.content;
    const previouslyUnlocked = new Set(getUnlockedAreaIdsForHeroLevel(previousHeroLevel));
    const currentlyUnlocked = getUnlockedAreaIdsForHeroLevel(currentHeroLevel);
    const newlyUnlockedAreaIds = currentlyUnlocked.filter(areaId => !previouslyUnlocked.has(areaId));
    const levelUps = [];

    for (let level = previousHeroLevel + 1; level <= currentHeroLevel; level++) {
      const areaIds = newlyUnlockedAreaIds.filter(areaId => {
        const sector = SECTORS_REGISTRY.find(entry => entry.areaId === areaId);
        return sector?.requiredHeroLevel === level;
      });
      const unlocks = areaIds
        .map(areaId => content.getArea(areaId))
        .filter(Boolean)
        .map(area => `${area.name} (area)`);

      levelUps.push({
        skillId: 'hero',
        from: level - 1,
        to: level,
        sterlingsAwarded: 0,
        unlocks,
        unlockedAreaIds: areaIds
      });
    }

    return levelUps;
  }

  _computeProgressionRewards(player, skillId, skillLevelBefore, heroLevelBefore = player.level) {
    return {
      levelUps: this._computeLevelUpRewards(player, skillId, skillLevelBefore),
      heroLevelUps: this._computeHeroLevelUpRewards(player, heroLevelBefore)
    };
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
      // Equipment is stored in the same quantity map, but it has no item
      // sell definition and sellItem intentionally rejects it. Do not show
      // such entries as market inventory.
      if (!itemDef) continue;
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
    const beforeState = JSON.stringify({
      activity: player.currentActivity,
      activeBuffs: player.activeBuffs,
      hp: player.hp
    });
    this.engine.potions?.process?.(player);
    this._syncUnlockedAreas(player);
    if (player.currentActivity?.mode === 'auto' && player.currentActivity.skillId === 'mining') {
      this._syncAutoMiningActivities(player);
    } else if (player.currentActivity && !this.engine.content.getActivity(player.currentActivity.id)) {
      player.currentActivity = null;
    }
    const afterState = JSON.stringify({
      activity: player.currentActivity,
      activeBuffs: player.activeBuffs,
      hp: player.hp
    });
    if (afterState !== beforeState) {
      await this.savePlayer(player);
    }
    return player;
  }

  /**
   * Ensure player.unlockedAreas matches the current Hero Level.
   * @internal
   */
  _syncUnlockedAreas(player) {
    syncPlayerUnlockedAreas(player);
  }

  /**
   * Internal helper to refresh active Auto Mining session resources when available unlocked sectors change.
   * Preserves existing session, elapsed time, and progress.
   * @internal
   */
  _syncAutoMiningActivities(player) {
    if (!player || !player.currentActivity) return;
    if (player.currentActivity.mode !== 'auto' || player.currentActivity.skillId !== 'mining') return;

    const content = this.engine.content;
    if (!content) return;

    const allActivities = content.getAll('activities');
    const unlocked = allActivities.filter(act => {
      if (act.skillId !== 'mining') return false;
      return isMiningActivityUnlocked(player, act, content);
    });

    if (unlocked.length > 0) {
      const now = Date.now();
      const previousIds = new Set(Array.isArray(player.currentActivity.ids) ? player.currentActivity.ids : []);
      const startedAt = (player.currentActivity.activityStartedAt && typeof player.currentActivity.activityStartedAt === 'object')
        ? player.currentActivity.activityStartedAt
        : {};
      const baseline = Number.isFinite(player.currentActivity.lastClaimed) ? player.currentActivity.lastClaimed : now;
      for (const activity of unlocked) {
        if (!previousIds.has(activity.id)) {
          // Only newly unlocked resources need a boundary timestamp. Existing
          // resources intentionally fall back to lastClaimed when no boundary
          // was recorded (including legacy saves), preserving their accrued
          // offline progress.
          startedAt[activity.id] = now;
        }
      }
      player.currentActivity.ids = unlocked.map(a => a.id);
      player.currentActivity.activityStartedAt = Object.fromEntries(
        unlocked.map(activity => [activity.id, startedAt[activity.id]])
      );
    }
  }

  /**
   * Internal helper to save player.
   */
  async savePlayer(player) {
    await this.engine.player.save(player);
  }

  async shutdown() {
    await this.engine.shutdown?.();
  }
}
