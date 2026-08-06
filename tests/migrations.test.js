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

test('Data Integrity: Malformed numeric and collection fields are repaired safely', () => {
  const migrated = migratePlayerSave({
    id: 'usr_malformed_fields',
    name: 'Broken Save',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    heroXp: '100',
    skills: { mining: { xp: '500', level: 99 }, combat: null },
    inventory: { copper_ore: -2, coal: 2.8, mystery: '4' },
    storage: [],
    equipment: { weapon: { id: 'iron_sword', durability: 999, maxDurability: 100 } },
    currencies: { gold: NaN, sterlings: -4 },
    currentAreaId: 'not_an_area',
    visitedAreas: ['starter_village', 'not_an_area'],
    unlockedAreas: ['not_an_area']
  });

  assert.equal(migrated.heroXp, 0);
  assert.equal(migrated.level, 1);
  assert.deepEqual(migrated.skills, { mining: { xp: 0, level: 1 } });
  assert.deepEqual(migrated.inventory, { coal: 2 });
  assert.deepEqual(migrated.storage, {});
  assert.equal(migrated.equipment.weapon.durability, 100);
  assert.deepEqual(migrated.currencies, { gold: 0, sterlings: 0 });
  assert.equal(migrated.currentAreaId, 'starter_village');
  assert.deepEqual(migrated.visitedAreas, ['starter_village']);
  assert.deepEqual(migrated.unlockedAreas, ['starter_village']);
});

test('Data Integrity: Current-schema repairs are persisted on load', async () => {
  const engine = await createEngine();
  await engine.database.set('players', 'usr_repair_persist', {
    id: 'usr_repair_persist',
    name: 'Repair Me',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    inventory: { copper_ore: -1 },
    storage: {},
    skills: {},
    currencies: { gold: NaN, sterlings: 2 },
    currentAreaId: 'invalid_area'
  });

  const loaded = await engine.player.load('usr_repair_persist');
  assert.deepEqual(loaded.inventory, {});
  assert.equal(loaded.currentAreaId, 'starter_village');

  const persisted = await engine.database.get('players', 'usr_repair_persist');
  assert.deepEqual(persisted.inventory, {});
  assert.equal(persisted.currentAreaId, 'starter_village');
  assert.equal(persisted.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test('Data Integrity: Current location is always represented in visited areas', () => {
  const migrated = migratePlayerSave({
    id: 'usr_current_area_repair',
    name: 'Explorer',
    currentAreaId: 'lead_quarry',
    heroXp: 1100,
    visitedAreas: ['starter_village'],
    unlockedAreas: ['starter_village'],
    schemaVersion: CURRENT_SCHEMA_VERSION
  });

  assert.ok(migrated.visitedAreas.includes('lead_quarry'));
});

test('Data Integrity: Database key remains authoritative over payload identity', async () => {
  const engine = await createEngine();
  await engine.database.set('players', 'usr_key_owner', {
    id: 'usr_other_player',
    name: 'Corrupted Identity',
    schemaVersion: CURRENT_SCHEMA_VERSION
  });

  const loaded = await engine.player.load('usr_key_owner');
  assert.equal(loaded.id, 'usr_key_owner');
  const persisted = await engine.database.get('players', 'usr_key_owner');
  assert.equal(persisted.id, 'usr_key_owner');
  assert.equal(await engine.database.get('players', 'usr_other_player'), null);
});
