/**
 * Hero Attributes System.
 * Single source of truth for Hero attributes, calculations, and RPG progression metrics.
 */

export const DEFAULT_ATTRIBUTES = Object.freeze({
  strength: 1,
  attack: 1,
  loot: 1,
  health: 1,
  regeneration: 1
});

export const ATTRIBUTE_DEFINITIONS = Object.freeze({
  strength: {
    id: 'strength',
    name: 'Strength Level',
    emoji: '💪',
    defaultValue: 1
  },
  attack: {
    id: 'attack',
    name: 'Attack Level',
    emoji: '⚔️',
    defaultValue: 1
  },
  loot: {
    id: 'loot',
    name: 'Loot Level',
    emoji: '🎯',
    defaultValue: 1
  },
  health: {
    id: 'health',
    name: 'Health Level',
    emoji: '❤️',
    defaultValue: 1
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneration Level',
    emoji: '💚',
    defaultValue: 1
  }
});

export class AttributeModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  /**
   * Get raw attribute values map from player data.
   */
  getAttributes(player) {
    if (!player) return { ...DEFAULT_ATTRIBUTES };
    const playerAttrs = player.attributes || {};
    const result = {};
    for (const key of Object.keys(ATTRIBUTE_DEFINITIONS)) {
      result[key] = typeof playerAttrs[key] === 'number' && playerAttrs[key] > 0
        ? playerAttrs[key]
        : ATTRIBUTE_DEFINITIONS[key].defaultValue;
    }
    // Include any custom future attributes stored on player.attributes
    for (const [k, v] of Object.entries(playerAttrs)) {
      if (!(k in result) && typeof v === 'number') {
        result[k] = v;
      }
    }
    return result;
  }

  /**
   * Get level for a single attribute.
   */
  getAttributeLevel(player, attributeId) {
    const attrs = this.getAttributes(player);
    return attrs[attributeId] || ATTRIBUTE_DEFINITIONS[attributeId]?.defaultValue || 1;
  }

  /**
   * Calculate Maximum Health for a player based on Level, Health Attribute, and Equipment stats.
   * Single Source of Truth for Max HP calculation.
   */
  calculateMaxHealth(player, equippedStats = null) {
    if (!player) return 100;
    const heroLevel = player.level || 1;
    const healthAttr = this.getAttributeLevel(player, 'health');

    let gearHp = 0;
    if (equippedStats && typeof equippedStats.health === 'number') {
      gearHp = equippedStats.health;
    } else if (this.engine?.equipment) {
      const stats = this.engine.equipment.getTotalStats(player);
      gearHp = stats.health || 0;
    }

    // Base 100 + (Hero Level * 10) + ((Health Level - 1) * 10) + Equipment HP
    return 100 + (heroLevel * 10) + ((healthAttr - 1) * 10) + gearHp;
  }

  /**
   * Calculate Regeneration details for player.
   */
  calculateRegeneration(player) {
    const regenLevel = this.getAttributeLevel(player, 'regeneration');
    const hpPerInterval = regenLevel * 5;
    const intervalMinutes = 5;
    return {
      level: regenLevel,
      hpPerInterval,
      intervalMinutes,
      displayText: `+${hpPerInterval} HP every ${intervalMinutes} minutes`
    };
  }

  /**
   * Calculate Battle Rank string for a player.
   */
  getBattleRank(player) {
    const level = player?.level || 1;
    if (level >= 100) return 'Legend';
    if (level >= 75) return 'Grandmaster';
    if (level >= 50) return 'Master';
    if (level >= 30) return 'Diamond';
    if (level >= 20) return 'Platinum';
    if (level >= 10) return 'Gold';
    if (level >= 5) return 'Silver';
    if (level >= 2) return 'Bronze';
    return 'Recruit';
  }
}
