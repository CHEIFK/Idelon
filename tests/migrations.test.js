import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/index.js';
import { migratePlayerSave, validatePlayerSave, CURRENT_SCHEMA_VERSION } from '../migrations/index.js';

test('Data Integrity: New players instantiate with latest schemaVersion', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_test_schema', 'Test Hero');

  assert.equal(player.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(player.inventory);
  assert.ok(player.storage);
  assert.ok(player.currencies);
});

test('Data Integrity: Automatic migration of legacy v0 save payload', () => {
  const legacySave = {
    id: 'usr_legacy_v0',
    name: 'Ancient Hero',
    level: 5
  };

  const migrated = migratePlayerSave(legacySave);

  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.tier, 1);
  assert.equal(migrated.rarity, 'Common');
  assert.equal(migrated.requiredSkill, null);
  assert.deepEqual(migrated.inventory, {});
  assert.deepEqual(migrated.storage, {});
  assert.deepEqual(migrated.currencies, { gold: 0, sterlings: 0 });
});

test('Data Integrity: Corrupted save payloads repair without crashing', () => {
  const corruptedSave = null;
  const repaired = migratePlayerSave(corruptedSave);

  assert.ok(repaired);
  assert.equal(repaired.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(repaired.id);
  assert.ok(repaired.name);

  const val = validatePlayerSave(repaired);
  assert.equal(val.valid, true);
});
