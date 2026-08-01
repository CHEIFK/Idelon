import { EVENTS } from '../constants/index.js';

/**
 * Fully Data-Driven Quests Module.
 */
export class QuestsModule {
  constructor(engine = null) {
    this.engine = engine;
    if (engine && engine.events) {
      this.attachEventListeners(engine.events);
    }
  }

  setEngine(engine) {
    this.engine = engine;
    if (engine && engine.events) {
      this.attachEventListeners(engine.events);
    }
  }

  /**
   * Auto-subscribe to engine events to automatically track active quest objectives.
   */
  attachEventListeners(eventsBus) {
    eventsBus.on(EVENTS.ITEM_ADDED, (d) => this.handleEvent('gather_item', d));
    eventsBus.on(EVENTS.COMBAT_VICTORY, (d) => this.handleEvent('defeat_enemy', d));
    eventsBus.on(EVENTS.CRAFTING_COMPLETED, (d) => this.handleEvent('craft_item', d));
    eventsBus.on(EVENTS.AREA_ENTERED, (d) => this.handleEvent('visit_area', d));
    eventsBus.on(EVENTS.NPC_TALKED, (d) => this.handleEvent('talk_npc', d));
  }

  handleEvent(eventType, data) {
    if (!data || !data.playerId || !this.engine) return;
    // Fast update for active quests
    this.updateProgressFromEvent(data.playerId, eventType, data);
  }

  accept(
    player,
    questId,
    contentLoader = this.engine?.content,
    eventsBus = this.engine?.events
  ) {
    if (!contentLoader) return { success: false, reason: 'no_content_loader' };
    const questDef = contentLoader.getQuest(questId);
    if (!questDef) return { success: false, reason: 'quest_not_found' };

    if (questDef.levelReq && (player.level || 1) < questDef.levelReq) {
      return { success: false, reason: 'level_too_low' };
    }

    if (player.quests[questId] && player.quests[questId].status === 'completed') {
      return { success: false, reason: 'already_completed' };
    }

    player.quests[questId] = {
      id: questId,
      status: 'active',
      progress: 0,
      startedAt: Date.now()
    };

    if (eventsBus) {
      eventsBus.emit(EVENTS.QUEST_ACCEPTED, {
        playerId: player.id,
        questId
      });
    }

    return { success: true, quest: player.quests[questId] };
  }

  updateProgressFromEvent(playerId, eventType, eventData) {
    const playerModule = this.engine?.player;
    if (!playerModule) return;

    // Load or inspect active player state
    const player = this.engine?.activePlayer || null;
    if (player && player.id === playerId) {
      this.update(player, eventType, eventData);
    }
  }

  /**
   * Update active quest objectives based on event signals.
   */
  update(
    player,
    eventType,
    eventData,
    contentLoader = this.engine?.content,
    eventsBus = this.engine?.events
  ) {
    if (!player.quests) return [];
    const updatedQuests = [];

    for (const [questId, questState] of Object.entries(player.quests)) {
      if (!questState || questState.status !== 'active') continue;

      const questDef = contentLoader ? contentLoader.getQuest(questId) : null;
      if (!questDef || !questDef.objective) continue;

      const obj = questDef.objective;
      let matched = false;
      let increment = 0;

      if (obj.type === 'gather_item' && (eventType === 'gather_item' || eventType === EVENTS.ITEM_ADDED)) {
        if (eventData.itemId === obj.targetId) {
          matched = true;
          increment = eventData.amount || 1;
        }
      } else if (obj.type === 'defeat_enemy' && (eventType === 'defeat_enemy' || eventType === EVENTS.COMBAT_VICTORY)) {
        if (eventData.enemyId === obj.targetId) {
          matched = true;
          increment = 1;
        }
      } else if (obj.type === 'craft_item' && (eventType === 'craft_item' || eventType === EVENTS.CRAFTING_COMPLETED)) {
        if (eventData.resultItemId === obj.targetId) {
          matched = true;
          increment = eventData.resultAmount || 1;
        }
      } else if (obj.type === 'visit_area' && (eventType === 'visit_area' || eventType === EVENTS.AREA_ENTERED)) {
        if (eventData.areaId === obj.targetId) {
          matched = true;
          increment = obj.amount || 1;
        }
      } else if (obj.type === 'talk_npc' && (eventType === 'talk_npc' || eventType === EVENTS.NPC_TALKED)) {
        if (eventData.npcId === obj.targetId) {
          matched = true;
          increment = obj.amount || 1;
        }
      }

      if (matched && increment > 0) {
        questState.progress = Math.min(obj.amount, questState.progress + increment);
        updatedQuests.push(questState);

        if (eventsBus) {
          eventsBus.emit(EVENTS.QUEST_PROGRESS, {
            playerId: player.id,
            questId,
            currentProgress: questState.progress,
            targetAmount: obj.amount
          });
        }
      }
    }

    return updatedQuests;
  }

  /**
   * Complete quest and grant rewards (XP, currency, items, unlocked areas).
   */
  complete(
    player,
    questId,
    contentLoader = this.engine?.content,
    skillsModule = this.engine?.skills,
    inventoryModule = this.engine?.inventory,
    economyModule = this.engine?.economy,
    eventsBus = this.engine?.events
  ) {
    const questState = player.quests[questId];
    if (!questState || questState.status !== 'active') {
      return { success: false, reason: 'quest_not_active' };
    }

    const questDef = contentLoader ? contentLoader.getQuest(questId) : null;
    if (!questDef) return { success: false, reason: 'quest_not_found' };

    const targetAmount = questDef.objective?.amount || 1;
    if (questState.progress < targetAmount) {
      return { success: false, reason: 'objective_not_met', progress: questState.progress, targetAmount };
    }

    questState.status = 'completed';
    questState.completedAt = Date.now();

    const reward = questDef.reward || {};

    // Grant XP
    if (reward.xp && skillsModule) {
      for (const [skillId, xpAmt] of Object.entries(reward.xp)) {
        skillsModule.addXP(player, skillId, xpAmt);
      }
    }

    // Grant Currency
    if (reward.currency && economyModule) {
      for (const [curr, amt] of Object.entries(reward.currency)) {
        economyModule.addCurrency(player, curr, amt);
      }
    }

    // Grant Items
    if (Array.isArray(reward.items) && inventoryModule) {
      for (const itemObj of reward.items) {
        inventoryModule.addItem(player, itemObj.id, itemObj.amount || 1);
      }
    }

    // Unlock Area
    if (reward.unlockAreaId) {
      if (!Array.isArray(player.unlockedAreas)) {
        player.unlockedAreas = [];
      }
      if (!player.unlockedAreas.includes(reward.unlockAreaId)) {
        player.unlockedAreas.push(reward.unlockAreaId);
      }
    }

    if (eventsBus) {
      eventsBus.emit(EVENTS.QUEST_COMPLETED, {
        playerId: player.id,
        questId,
        reward
      });
    }

    return { success: true, questId, reward };
  }
}
