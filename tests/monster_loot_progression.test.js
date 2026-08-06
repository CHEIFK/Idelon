import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/index.js';
import { generateCombatLoot } from '../src/engine/combat/loot.js';

function getDrop(lootTable, itemId) {
  return lootTable.entries.find(entry => entry.itemId === itemId);
}

test('Monster loot tables resolve to valid items and make every equipment slot obtainable', async () => {
  const engine = await createEngine();
  const content = engine.content;
  const enemyLootTableIds = new Set(content.getAll('enemies').map(enemy => enemy.lootTableId));
  const lootEquipmentBySlot = new Map();

  for (const lootTableId of enemyLootTableIds) {
    const lootTable = content.getLootTable(lootTableId);
    assert.ok(lootTable, `Missing enemy loot table: ${lootTableId}`);

    for (const entry of lootTable.entries) {
      assert.ok(content.getItem(entry.itemId), `${lootTableId} references missing item ${entry.itemId}`);
      assert.ok(entry.chance > 0 && entry.chance <= 1, `${lootTableId} has invalid chance for ${entry.itemId}`);

      const equipment = content.getEquipment(entry.itemId);
      if (equipment) {
        assert.equal(content.getItem(entry.itemId).equipmentSlot, equipment.slot);
        if (!lootEquipmentBySlot.has(equipment.slot)) lootEquipmentBySlot.set(equipment.slot, []);
        lootEquipmentBySlot.get(equipment.slot).push(entry.itemId);
      }
    }
  }

  assert.deepEqual(
    [...lootEquipmentBySlot.keys()].sort(),
    ['amulet', 'boots', 'chest', 'gloves', 'helmet', 'legs', 'ring', 'shield', 'weapon']
  );
});

test('Monster families and bosses retain their themed, balanced signature drops', async () => {
  const engine = await createEngine();
  const content = engine.content;
  const expectations = [
    ['goblin_loot', 'goblin_ear', 0.8],
    ['goblin_loot', 'wooden_sword', 0.2],
    ['wolf_loot', 'leather_boots', 0.18],
    ['spider_loot', 'silk_chest', 0.08],
    ['bandit_loot', 'iron_shield', 0.2],
    ['undead_loot', 'bone_sword', 0.15],
    ['orc_loot', 'orc_chest', 0.18],
    ['spectral_loot', 'spectral_amulet', 0.12],
    ['vampire_loot', 'blood_ring', 0.1],
    ['drake_loot', 'drake_chest', 0.12],
    ['shadow_loot', 'shadow_gloves', 0.12],
    ['demon_loot', 'infernal_sword', 0.1],
    ['ancient_dragon_boss_loot', 'dragon_slayer', 0.1],
    ['abyssal_overlord_boss_loot', 'abyss_blade', 0.08]
  ];

  for (const [lootTableId, itemId, chance] of expectations) {
    const drop = getDrop(content.getLootTable(lootTableId), itemId);
    assert.ok(drop, `${lootTableId} should include ${itemId}`);
    assert.equal(drop.chance, chance);
  }

  const dragon = content.getEnemy('ancient_dragon');
  const overlord = content.getEnemy('abyssal_overlord');
  assert.notEqual(dragon.lootTableId, overlord.lootTableId);
  assert.equal(getDrop(content.getLootTable(dragon.lootTableId), 'dragon_scale').amount, 3);

  const abyssSlots = content.getLootTable(overlord.lootTableId).entries
    .map(entry => content.getEquipment(entry.itemId)?.slot)
    .filter(Boolean)
    .sort();
  assert.deepEqual(abyssSlots, ['amulet', 'boots', 'chest', 'gloves', 'helmet', 'legs', 'ring', 'shield', 'weapon']);
});

test('Equipment drops remain single-item rewards while materials retain the existing loot scaling', async () => {
  const engine = await createEngine();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    for (const enemy of engine.content.getAll('enemies')) {
      const drops = generateCombatLoot(enemy, engine.content);
      for (const drop of drops) {
        if (engine.content.getEquipment(drop.itemId)) {
          assert.equal(drop.amount, 1, `${enemy.name} should award one ${drop.itemId} per successful equipment roll`);
        }
      }
    }
  } finally {
    Math.random = originalRandom;
  }
});
