import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/index.js';

test('Universal Item Schema validation for all game items', async () => {
  const engine = await createEngine();
  const allItems = engine.content.getAll('items');

  assert.ok(allItems.length > 0, 'Items dataset loaded');

  for (const item of allItems) {
    // 1. Mandatory Core Universal Properties
    assert.equal(typeof item.id, 'string', `Item ${item.id} missing string id`);
    assert.equal(typeof item.name, 'string', `Item ${item.id} missing string name`);
    assert.equal(typeof item.description, 'string', `Item ${item.id} missing string description`);
    assert.equal(typeof item.category, 'string', `Item ${item.id} missing string category`);
    assert.ok(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].includes(item.rarity), `Item ${item.id} invalid rarity '${item.rarity}'`);
    assert.ok(Number.isInteger(item.tier) && item.tier >= 1, `Item ${item.id} invalid tier ${item.tier}`);
    assert.equal(typeof item.icon, 'string', `Item ${item.id} missing string icon`);
    assert.ok(typeof item.sellValue === 'number' && item.sellValue >= 0, `Item ${item.id} invalid sellValue`);
    assert.equal(typeof item.stackable, 'boolean', `Item ${item.id} missing boolean stackable`);
    assert.ok(Number.isInteger(item.maxStack) && item.maxStack >= 1, `Item ${item.id} invalid maxStack`);
    assert.equal(typeof item.obtainMethod, 'string', `Item ${item.id} missing string obtainMethod`);
    assert.ok(item.requiredSkill === null || typeof item.requiredSkill === 'string', `Item ${item.id} invalid requiredSkill`);
    assert.ok(Number.isInteger(item.requiredLevel) && item.requiredLevel >= 1, `Item ${item.id} invalid requiredLevel`);

    // 2. Category Specific Schemas
    if (item.category === 'Equipment') {
      assert.equal(typeof item.equipmentSlot, 'string', `Equipment ${item.id} missing equipmentSlot`);
      assert.equal(typeof item.statBonuses, 'object', `Equipment ${item.id} missing statBonuses object`);
      assert.equal(item.stackable, false, `Equipment ${item.id} must have stackable: false`);
      assert.equal(item.maxStack, 1, `Equipment ${item.id} must have maxStack: 1`);
    }

    if (item.category === 'Consumable' && item.effects) {
      assert.ok(Array.isArray(item.effects), `Consumable ${item.id} effects must be an array`);
    }
  }
});
