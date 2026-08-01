/**
 * Combat loot generation helper using ContentLoader loot tables.
 */
export function generateCombatLoot(enemyDef, contentLoader) {
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
    if (Math.random() <= entry.chance) {
      const baseMin = entry.min || 1;
      const baseMax = entry.max || 1;
      const min = Math.max(1, Math.round(baseMin * MULTIPLIER * 0.5));
      const max = Math.max(min, Math.round(baseMax * MULTIPLIER * 1.5));
      const amount = Math.floor(Math.random() * (max - min + 1)) + min;
      drops.push({ itemId: entry.itemId, amount });
    }
  }

  return drops;
}
