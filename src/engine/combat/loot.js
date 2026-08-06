/**
 * Combat loot generation helper using ContentLoader loot tables.
 */
export function getLootChance(baseChance, luckPercent = 0) {
  const chance = typeof baseChance === 'number' && Number.isFinite(baseChance) ? baseChance : 0;
  const luck = typeof luckPercent === 'number' && Number.isFinite(luckPercent) ? Math.max(0, luckPercent) : 0;
  return Math.min(1, Math.max(0, chance + luck / 100));
}

export function generateCombatLoot(enemyDef, contentLoader, luckPercent = 0) {
  if (!enemyDef || !enemyDef.lootTableId || !contentLoader) {
    return [];
  }

  const lootTable = contentLoader.getLootTable(enemyDef.lootTableId);
  if (!lootTable || !Array.isArray(lootTable.entries)) {
    return [];
  }

  const MULTIPLIER = 20;
  const drops = [];
  for (const entry of lootTable.entries) {
    if (Math.random() <= getLootChance(entry.chance, luckPercent)) {
      const baseMin = entry.min ?? entry.amount ?? 1;
      const baseMax = entry.max ?? entry.amount ?? 1;
      const min = Math.max(1, Math.round(baseMin * MULTIPLIER * 0.5));
      const max = Math.max(min, Math.round(baseMax * MULTIPLIER * 1.5));
      const amount = Math.floor(Math.random() * (max - min + 1)) + min;
      drops.push({ itemId: entry.itemId, amount });
    }
  }

  return drops;
}
