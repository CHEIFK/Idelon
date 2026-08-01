import { getHeroLevel } from './progression.js';

/**
 * Skills module for leveling and XP tracking.
 */
export class SkillsModule {
  addXP(player, skillId, amount) {
    if (!player.skills[skillId]) {
      player.skills[skillId] = { xp: 0, level: 1 };
    }
    const skill = player.skills[skillId];
    skill.xp += amount;
    
    // ponytail: Simple linear formula. Ceiling: Fixed leveling curve. Upgrade path: Replace with logarithmic/exponential math formula for idle game balance.
    const newLevel = Math.floor(1 + Math.sqrt(skill.xp / 100));
    const leveledUp = newLevel > skill.level;
    skill.level = newLevel;

    // Update global Hero XP and Hero Level via data-driven progression table
    player.heroXp = (player.heroXp || 0) + amount;
    player.level = getHeroLevel(player.heroXp);

    return { xp: skill.xp, level: skill.level, leveledUp };
  }

  getLevel(player, skillId) {
    return player.skills[skillId]?.level || 1;
  }

  getXP(player, skillId) {
    return player.skills[skillId]?.xp || 0;
  }
}
