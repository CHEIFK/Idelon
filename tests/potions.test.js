import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/index.js';
import { migratePlayerSave, CURRENT_SCHEMA_VERSION } from '../migrations/index.js';
import { GameService } from '../src/service/gameService.js';

test('Potion content contains all canonical stackable potion definitions', async () => {
  const engine = await createEngine();
  const potions = engine.content.getAllPotions();

  assert.equal(potions.length, 50);
  assert.ok(potions.every(potion => potion.stackable === true && potion.maxStack === 999));
  assert.equal(new Set(potions.map(potion => potion.potionType)).size, 10);
  assert.ok(potions.every(potion => potion.buyPrice > 0));
});

test('Potion purchase stacks inventory and consumes Gold atomically', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_potion_purchase', 'Potion Buyer');
  player.currencies.gold = 500;
  await engine.player.save(player);

  const service = new GameService(engine);
  const first = await service.buyPotion(player.id, 'small health potion', 2);

  assert.equal(first.success, true);
  assert.equal(first.totalOwned, 2);
  const reloaded = await engine.player.load(player.id);
  assert.equal(reloaded.inventory.small_health_potion, 2);
  assert.equal(reloaded.currencies.gold, 400);
});

test('Potion use refreshes same-type duration without creating duplicate buffs', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_potion_refresh', 'Potion User');
  player.inventory.small_strength_potion = 1;
  player.inventory.medium_strength_potion = 1;

  const start = 1_000_000;
  const first = engine.potions.use(player, 'small_strength_potion', engine.content, engine.inventory, null, start);
  const firstExpiry = first.buff.expiresAt;
  const second = engine.potions.use(player, 'medium_strength_potion', engine.content, engine.inventory, null, start + 60_000);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(Object.keys(player.activeBuffs).length, 1);
  assert.equal(player.activeBuffs.strength.amount, 20);
  assert.ok(player.activeBuffs.strength.expiresAt > firstExpiry);
});

test('Active potion buffs migrate and persist through player save/load', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_potion_persist', 'Persistent User');
  player.activeBuffs = {
    haste: {
      potionType: 'haste',
      stat: 'haste',
      amount: 50,
      durationMs: 300000,
      expiresAt: Date.now() + 300000,
      effectLabel: '+50% mining speed for 5 minutes',
      sourcePotionId: 'huge_haste_potion'
    }
  };
  await engine.player.save(player);

  const loaded = await engine.player.load(player.id);
  assert.equal(loaded.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(loaded.activeBuffs.haste.amount, 50);
  assert.equal(loaded.activeBuffs.haste.sourcePotionId, 'huge_haste_potion');

  const migrated = migratePlayerSave({ id: 'legacy-buffs', name: 'Legacy', schemaVersion: 6 });
  assert.deepEqual(migrated.activeBuffs, {});
});
