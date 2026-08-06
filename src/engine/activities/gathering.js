import { EVENTS, getActivitySpeedMultiplier, MAX_OFFLINE_MINING_DURATION_MS } from '../../constants/index.js';
import { getGatheringQuantityMultiplier } from '../../utils/sectorMap.js';

/**
 * Generic Gathering Activity runner for Mining, Woodcutting, Fishing, Farming, etc.
 */
export class GatheringActivity {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  /**
   * Start a gathering activity. Returns active activity object or null if failed.
   */
  start(player, activityId, contentLoader = this.engine?.content, eventsBus = this.engine?.events) {
    if (!contentLoader) {
      throw new Error('Content loader instance is required to start an activity.');
    }

    const activityDef = contentLoader.getActivity(activityId);
    if (!activityDef) {
      throw new Error(`Activity '${activityId}' not found in content loader.`);
    }

    // Skill levels continue to gate resource activities. Sector access is
    // validated separately through the Hero-Level world progression helpers.
    const playerLevel = player.skills[activityDef.skillId]?.level || 1;
    if (playerLevel < activityDef.levelReq) {
      return null;
    }

    if (player.currentActivity) {
      if (player.currentActivity.id === activityId || player.currentActivity.skillId === activityDef.skillId) {
        return {
          alreadyActive: true,
          reason: 'already_active',
          skillId: activityDef.skillId,
          currentActivity: player.currentActivity
        };
      }
    }

    const now = Date.now();
    player.currentActivity = {
      id: activityId,
      skillId: activityDef.skillId,
      startTime: now,
      lastClaimed: now
    };

    if (eventsBus) {
      eventsBus.emit(EVENTS.ACTIVITY_STARTED, {
        playerId: player.id,
        activityId,
        skillId: activityDef.skillId,
        startTime: now
      });
    }

    return player.currentActivity;
  }

  /**
   * Calculate offline progression and claim rewards for completed cycles.
   */
  claim(
    player,
    contentLoader = this.engine?.content,
    inventoryModule = this.engine?.inventory,
    skillsModule = this.engine?.skills,
    economyModule = this.engine?.economy,
    eventsBus = this.engine?.events
  ) {
    if (!player.currentActivity) return null;
    if (!contentLoader) return null;

    const activityDef = contentLoader.getActivity(player.currentActivity.id);
    if (!activityDef) return null;

    const speedMult = getActivitySpeedMultiplier(
      player.currentActivity,
      player,
      this.engine?.potions
    );
    const effectiveDuration = activityDef.durationMs / speedMult;

    const now = Date.now();
    const rawElapsedMs = Math.max(0, now - player.currentActivity.lastClaimed);
    const elapsedMs = Math.min(rawElapsedMs, MAX_OFFLINE_MINING_DURATION_MS);
    const cycles = Math.floor(elapsedMs / effectiveDuration);

    if (cycles <= 0) {
      return {
        cyclesCompleted: 0,
        elapsedMs: rawElapsedMs,
        itemsGained: [],
        xpGained: 0,
        currenciesGained: {}
      };
    }

    // 1. Roll loot table for rewards
    const lootTable = contentLoader.getLootTable(activityDef.lootTableId);
    const itemTotals = new Map();

    if (lootTable && Array.isArray(lootTable.entries)) {
      for (let i = 0; i < cycles; i++) {
        for (const entry of lootTable.entries) {
            const luckPercent = this.engine?.potions?.getModifier
              ? this.engine.potions.getModifier(player, 'luck')
              : 0;
            const chance = Math.min(1, Math.max(0, (entry.chance || 0) + luckPercent / 100));
            if (Math.random() <= chance) {
            const min = entry.min ?? entry.amount ?? 1;
            const max = entry.max ?? entry.amount ?? 1;
            const qty = Math.floor(Math.random() * (max - min + 1)) + min;
            itemTotals.set(entry.itemId, (itemTotals.get(entry.itemId) || 0) + qty);
          }
        }
      }
    }

    // 2. Award items to player inventory & emit events
    const itemsGained = [];
    for (let [itemId, amount] of itemTotals.entries()) {
      const mult = getGatheringQuantityMultiplier(player, itemId, contentLoader);
      const finalAmount = Math.floor(amount * mult);

      if (inventoryModule) {
        inventoryModule.addItem(player, itemId, finalAmount);
      }
      itemsGained.push({ itemId, amount: finalAmount });

      if (eventsBus) {
        eventsBus.emit(EVENTS.ITEM_ADDED, {
          playerId: player.id,
          itemId,
          amount: finalAmount
        });
      }
    }

    // 3. Award currency if defined
    const currenciesGained = {};
    if (activityDef.currencyRewards && economyModule) {
      for (const [curr, amtPerCycle] of Object.entries(activityDef.currencyRewards)) {
        const totalAmt = amtPerCycle * cycles;
        economyModule.addCurrency(player, curr, totalAmt);
        currenciesGained[curr] = totalAmt;
      }
    }

    // 4. Award Skill XP & emit events
    const baseXpGained = (activityDef.xpPerCycle || 10) * cycles;
    const xpResult = skillsModule ? skillsModule.addXP(player, activityDef.skillId, baseXpGained) : { xp: baseXpGained, xpGained: baseXpGained, level: 1, leveledUp: false };
    const xpGained = xpResult.xpGained ?? baseXpGained;

    if (eventsBus) {
      eventsBus.emit(EVENTS.XP_GAINED, {
        playerId: player.id,
        skillId: activityDef.skillId,
        xpGained,
        totalXp: xpResult.xp,
        level: xpResult.level
      });

      if (xpResult.leveledUp) {
        eventsBus.emit(EVENTS.PLAYER_LEVEL_UP, {
          playerId: player.id,
          skillId: activityDef.skillId,
          newLevel: xpResult.level
        });
      }

      eventsBus.emit(EVENTS.ACTIVITY_COMPLETED, {
        playerId: player.id,
        activityId: activityDef.id,
        cyclesCompleted: cycles,
        elapsedMs
      });
    }

    // Update lastClaimed timestamp
    if (rawElapsedMs >= MAX_OFFLINE_MINING_DURATION_MS) {
      player.currentActivity.lastClaimed = now;
    } else {
      player.currentActivity.lastClaimed += Math.floor(cycles * effectiveDuration);
    }

    return {
      cyclesCompleted: cycles,
      elapsedMs,
      itemsGained,
      xpGained,
      currenciesGained
    };
  }

  /**
   * Stop activity.
   */
  stop(player) {
    const activity = player.currentActivity;
    player.currentActivity = null;
    return activity;
  }
}
