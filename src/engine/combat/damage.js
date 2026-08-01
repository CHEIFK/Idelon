/**
 * Combat damage calculation helper.
 */
export function calculateDamage(attackerStats, defenderStats, isCrit = false) {
  const critMultiplier = isCrit ? 1.5 : 1.0;
  const rawDamage = (attackerStats.attack || 5) * critMultiplier;
  const defenseMitigation = defenderStats.defense || 0;
  
  return Math.max(1, Math.floor(rawDamage - defenseMitigation));
}
