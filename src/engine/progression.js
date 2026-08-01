/**
 * Data-Driven Progression System for Idelon RPG Engine.
 * Provides Hero Level lookup, cumulative XP for level, and remaining XP calculations.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const DEFAULT_HERO_XP_TABLE = require('../data/heroXpTable.json');

/**
 * Calculate player's Hero Level based on total accumulated Hero XP.
 *
 * @param {number} heroXp - Total accumulated Hero XP.
 * @param {Array<{level: number, requiredXp: number}>} [xpTable] - Optional XP table override.
 * @returns {number} The player's Hero Level (1 to max level).
 */
export function getHeroLevel(heroXp, xpTable = DEFAULT_HERO_XP_TABLE) {
  if (!Array.isArray(xpTable) || xpTable.length === 0) return 1;
  const xp = typeof heroXp === 'number' && !isNaN(heroXp) ? Math.max(0, heroXp) : 0;

  let currentLevel = 1;
  for (const entry of xpTable) {
    if (xp >= entry.requiredXp) {
      currentLevel = entry.level;
    } else {
      break;
    }
  }

  return currentLevel;
}

/**
 * Get cumulative XP required to reach a specific level.
 *
 * @param {number} level - Target Hero Level.
 * @param {Array<{level: number, requiredXp: number}>} [xpTable] - Optional XP table override.
 * @returns {number} Cumulative XP required for the specified level.
 */
export function getXpForLevel(level, xpTable = DEFAULT_HERO_XP_TABLE) {
  if (!Array.isArray(xpTable) || xpTable.length === 0) return 0;
  const targetLevel = typeof level === 'number' && !isNaN(level) ? Math.max(1, Math.floor(level)) : 1;

  const entry = xpTable.find(e => e.level === targetLevel);
  if (entry) {
    return entry.requiredXp;
  }

  // If level exceeds defined table, return last entry's requiredXp
  const maxEntry = xpTable[xpTable.length - 1];
  return maxEntry ? maxEntry.requiredXp : 0;
}

/**
 * Get XP remaining until player reaches the next Hero Level.
 *
 * @param {number} heroXp - Current accumulated Hero XP.
 * @param {Array<{level: number, requiredXp: number}>} [xpTable] - Optional XP table override.
 * @returns {number} XP remaining to next level (0 if at max level).
 */
export function getXpRemaining(heroXp, xpTable = DEFAULT_HERO_XP_TABLE) {
  if (!Array.isArray(xpTable) || xpTable.length === 0) return 0;
  const currentXp = typeof heroXp === 'number' && !isNaN(heroXp) ? Math.max(0, heroXp) : 0;
  const currentLevel = getHeroLevel(currentXp, xpTable);

  const maxLevel = xpTable[xpTable.length - 1]?.level || 1;
  if (currentLevel >= maxLevel) {
    return 0;
  }

  const nextLevelXp = getXpForLevel(currentLevel + 1, xpTable);
  return Math.max(0, nextLevelXp - currentXp);
}
