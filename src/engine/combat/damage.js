/**
 * Combat damage calculation helper.
 */
export function calculateDamage(attackerStats, defenderStats, isCrit = false) {
  attackerStats = attackerStats || {};
  defenderStats = defenderStats || {};
  const critMultiplier = isCrit ? 1.5 : 1.0;
  const baseAttack = typeof attackerStats.attack === 'number' && Number.isFinite(attackerStats.attack) ? attackerStats.attack : 5;
  const strengthBonus = typeof attackerStats.strength === 'number' && Number.isFinite(attackerStats.strength) ? attackerStats.strength * 1.5 : 0;
  const rawDamage = (baseAttack + strengthBonus) * critMultiplier;
  const defenseMitigation = typeof defenderStats.defense === 'number' && Number.isFinite(defenderStats.defense) ? defenderStats.defense : 0;
  return Math.max(1, Math.floor(rawDamage - defenseMitigation));
}
