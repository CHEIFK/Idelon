import { getHeroLevel } from './progression.js';

/**
 * Skills module for leveling and XP tracking.
 */
export class SkillsModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  addXP(player, skillId, amount, xpTableOverride = null) {
    if (!player || !skillId || typeof skillId !== 'string' || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
      const current = player?.skills?.[skillId] || { xp: 0, level: 1 };
      return { xp: current.xp || 0, level: current.level || 1, leveledUp: false, ignored: true };
    }
    if (!player.skills || typeof player.skills !== 'object' || Array.isArray(player.skills)) {
      player.skills = {};
    }
    if (!player.skills[skillId]) {
      player.skills[skillId] = { xp: 0, level: 1 };
    }
    const skill = player.skills[skillId];
    const experienceMultiplier = this.engine?.potions?.getExperienceMultiplier
      ? this.engine.potions.getExperienceMultiplier(player)
      : 1;
    const effectiveAmount = Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.round(amount * Math.max(1, experienceMultiplier))
    );
    const currentXp = typeof skill.xp === 'number' && Number.isFinite(skill.xp) && skill.xp >= 0
      ? Math.min(skill.xp, Number.MAX_SAFE_INTEGER)
      : 0;
    const currentLevel = typeof skill.level === 'number' && Number.isFinite(skill.level) && skill.level >= 1 ? Math.floor(skill.level) : 1;
    const heroXp = typeof player.heroXp === 'number' && Number.isFinite(player.heroXp) && player.heroXp >= 0
      ? Math.min(player.heroXp, Number.MAX_SAFE_INTEGER)
      : 0;
    if (!Number.isFinite(effectiveAmount)
      || effectiveAmount <= 0
      || effectiveAmount > Number.MAX_SAFE_INTEGER - currentXp
      || effectiveAmount > Number.MAX_SAFE_INTEGER - heroXp) {
      return { xp: currentXp, level: currentLevel, leveledUp: false, ignored: true };
    }
    skill.xp = currentXp + effectiveAmount;

    const xpTable = xpTableOverride || this.engine?.content?.getHeroXpTable();
    const newLevel = getHeroLevel(skill.xp, xpTable);
    const leveledUp = newLevel > currentLevel;
    skill.level = newLevel;

    // Update global Hero XP and Hero Level via data-driven progression table
    player.heroXp = heroXp + effectiveAmount;
    player.level = getHeroLevel(player.heroXp, xpTable);

    return { xp: skill.xp, level: skill.level, leveledUp, xpGained: effectiveAmount };
  }

  getLevel(player, skillId) {
    return player.skills[skillId]?.level || 1;
  }

  getXP(player, skillId) {
    return player.skills[skillId]?.xp || 0;
  }
}
