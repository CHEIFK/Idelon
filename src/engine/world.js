import { EVENTS } from '../constants/index.js';

/**
 * NPC sub-module managing NPC interactions and dialogue.
 */
export class NpcModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  get(id, contentLoader = this.engine?.content) {
    if (!contentLoader) return null;
    return contentLoader.getNpc(id);
  }

  talk(player, npcId, contentLoader = this.engine?.content, eventsBus = this.engine?.events) {
    const npc = this.get(npcId, contentLoader);
    if (!npc) return null;

    if (eventsBus) {
      eventsBus.emit(EVENTS.NPC_TALKED, {
        playerId: player.id,
        npcId: npc.id,
        dialog: npc.dialog
      });
    }

    return {
      npc,
      dialog: npc.dialog,
      questsProvided: npc.questsProvided || []
    };
  }
}

/**
 * World and Area sub-module managing zone travel and available areas.
 */
export class WorldModule {
  constructor(engine = null) {
    this.engine = engine;
    this.npc = new NpcModule(engine);
  }

  setEngine(engine) {
    this.engine = engine;
    this.npc.setEngine(engine);
  }

  getArea(areaId, contentLoader = this.engine?.content) {
    if (!contentLoader) return null;
    return contentLoader.getArea(areaId);
  }

  getNpc(npcId, contentLoader = this.engine?.content) {
    return this.npc.get(npcId, contentLoader);
  }

  /**
   * Return areas available / unlocked for the player.
   */
  getAvailable(player, contentLoader = this.engine?.content) {
    if (!contentLoader) return [];
    const allAreas = contentLoader.getAll('areas');

    return allAreas.filter(area => {
      const levelOk = (player.level || 1) >= (area.levelReq || 1);
      const questOk = !area.reqQuestId || (player.quests[area.reqQuestId]?.status === 'completed');
      const manuallyUnlocked = Array.isArray(player.unlockedAreas) && player.unlockedAreas.includes(area.id);

      return levelOk && (questOk || manuallyUnlocked);
    });
  }

  /**
   * Travel player to specified area.
   */
  travel(player, areaId, contentLoader = this.engine?.content, eventsBus = this.engine?.events) {
    const available = this.getAvailable(player, contentLoader);
    const targetArea = available.find(a => a.id === areaId);

    if (!targetArea) {
      return { success: false, reason: 'area_locked', areaId };
    }

    player.currentAreaId = areaId;

    if (eventsBus) {
      eventsBus.emit(EVENTS.AREA_ENTERED, {
        playerId: player.id,
        areaId
      });
    }

    return {
      success: true,
      areaId,
      area: targetArea
    };
  }
}
