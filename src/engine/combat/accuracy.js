/**
 * Accuracy and Critical hit chance calculations.
 */
export function calculateHitChance(attackerStats, defenderStats) {
  attackerStats = attackerStats || {};
  defenderStats = defenderStats || {};
  const baseHit = 0.90;
  const accuracyBonus = typeof attackerStats.accuracy === 'number' && Number.isFinite(attackerStats.accuracy)
    ? attackerStats.accuracy * 0.01
    : 0;
  const evasionBonus = typeof defenderStats.evasion === 'number' && Number.isFinite(defenderStats.evasion)
    ? defenderStats.evasion * 0.01
    : 0;

  return Math.min(1.0, Math.max(0.10, baseHit + accuracyBonus - evasionBonus));
}

export function calculateCritChance(attackerStats) {
  const criticalChance = typeof attackerStats?.criticalChance === 'number' && Number.isFinite(attackerStats.criticalChance)
    ? attackerStats.criticalChance
    : 0.05;
  return Math.min(0.75, Math.max(0.01, criticalChance));
}
