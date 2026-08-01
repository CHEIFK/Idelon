import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, ContentLoader } from '../src/index.js';

test('Content system loads and queries all 11 definitions', async () => {
  const engine = await createEngine();
  const content = engine.content;

  assert.ok(content.getItem('iron_ore'), 'Item iron_ore loaded');
  assert.ok(content.getSkill('mining'), 'Skill mining loaded');
  assert.ok(content.getActivity('mine_iron'), 'Activity mine_iron loaded');
  assert.ok(content.getResource('iron_node'), 'Resource iron_node loaded');
  assert.ok(content.getEnemy('goblin'), 'Enemy goblin loaded');
  assert.ok(content.getEquipment('iron_sword'), 'Equipment iron_sword loaded');
  assert.ok(content.getRecipe('craft_iron_sword'), 'Recipe craft_iron_sword loaded');
  assert.ok(content.getNpc('blacksmith'), 'NPC blacksmith loaded');
  assert.ok(content.getArea('starter_village'), 'Area starter_village loaded');
  assert.ok(content.getQuest('first_steps'), 'Quest first_steps loaded');
  assert.ok(content.getLootTable('mining_iron_loot'), 'LootTable mining_iron_loot loaded');

  assert.equal(content.getAll('items').length, 72);
  assert.equal(content.getAll('skills').length, 8);
});

test('Content validation catches invalid cross-references', () => {
  const loader = new ContentLoader();
  
  assert.throws(() => {
    loader._loadCategory('skills', [{ id: 'mining', name: 'Mining' }]);
    loader._loadCategory('lootTables', []);
    loader._loadCategory('activities', [
      { id: 'mine_unknown', name: 'Mine Unknown', skillId: 'non_existent_skill' }
    ]);
    loader.validate();
  }, /Validation Error: Activity 'mine_unknown' references missing skillId 'non_existent_skill'/);
});

test('Content validation catches duplicate IDs', () => {
  const loader = new ContentLoader();

  assert.throws(() => {
    loader._loadCategory('items', [
      { id: 'dup_item', name: 'Item 1' },
      { id: 'dup_item', name: 'Item 2' }
    ]);
  }, /Duplicate ID 'dup_item'/);
});
