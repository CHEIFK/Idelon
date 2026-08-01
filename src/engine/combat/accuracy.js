/**
 * Accuracy and Critical hit chance calculations.
 */
export function calculateHitChance(attackerStats, defenderStats) {
  const baseHit = 0.90;
  const accuracyBonus = (attackerStats.accuracy || 0) * 0.01;
  const evasionBonus = (defenderStats.evasion || 0) * 0.01;

  return Math.min(1.0, Math.max(0.10, baseHit + accuracyBonus - evasionBonus));
}

export function calculateCritChance(attackerStats) {
  return Math.min(0.75, Math.max(0.01, attackerStats.criticalChance || 0.05));
}
