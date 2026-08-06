import { EVENTS } from '../constants/index.js';
import { syncPlayerUnlockedAreas } from './player.js';
import { getUnlockedAreaIdsForHeroLevel } from '../utils/sectorMap.js';

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
    if (npc.areaId && npc.areaId !== (player?.currentAreaId || 'starter_village')) {
      return { success: false, reason: 'npc_not_in_area', npc };
    }

    if (eventsBus) {
      eventsBus.emit(EVENTS.NPC_TALKED, {
        playerId: player.id,
        npcId: npc.id,
        dialog: npc.dialog
      });
    }

    return {
      success: true,
      npc,
      dialog: npc.dialog
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

  getNpc(npcId, contentLoader = this.content || this.engine?.content) {
    return this.npc.get(npcId, contentLoader);
  }

  /**
   * Return areas available / unlocked for the player.
   */
  getAvailable(player, contentLoader = this.content || this.engine?.content) {
    if (!contentLoader) return [];
    syncPlayerUnlockedAreas(player);
    const allAreas = contentLoader.getAll('areas');
    const unlockedSet = new Set(getUnlockedAreaIdsForHeroLevel(player?.level));

    return allAreas.filter(area => {
      return unlockedSet.has(area.id);
    });
  }

  /**
   * Travel player to specified area.
   */
  travel(player, areaId, contentLoader = this.content || this.engine?.content, eventsBus = this.events || this.engine?.events) {
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
