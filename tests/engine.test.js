import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, ACTIVITIES, EVENTS } from '../src/index.js';

test('Engine initialization and modular sub-directories', async () => {
  const engine = await createEngine();
  assert.ok(engine, 'Engine instance created');
  assert.ok(engine.events, 'Event emitter loaded');
  assert.ok(engine.activities.mining, 'Activities/mining sub-module loaded');
  assert.ok(engine.activities.woodcutting, 'Activities/woodcutting sub-module loaded');
  assert.ok(engine.activities.fishing, 'Activities/fishing sub-module loaded');
  assert.ok(engine.activities.hunting, 'Activities/hunting sub-module loaded');
  assert.ok(engine.combat.enemies, 'Combat/enemies sub-module loaded');
  assert.ok(engine.combat.bosses, 'Combat/bosses sub-module loaded');
});

test('Constants usage and modular activity invocation', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_200', 'Miner');

  const act = engine.activities.mining.start(player, ACTIVITIES.MINING_IRON);
  assert.equal(act.id, 'mine_iron');
  assert.equal(player.currentActivity.id, ACTIVITIES.MINING_IRON);
});

test('Event system subscription and notification', async () => {
  const engine = await createEngine();
  let eventFired = false;

  engine.events.once(EVENTS.PLAYER_LEVEL_UP, (payload) => {
    eventFired = true;
    assert.equal(payload.playerId, 'usr_300');
  });

  engine.events.emit(EVENTS.PLAYER_LEVEL_UP, { playerId: 'usr_300', newLevel: 5 });
  assert.equal(eventFired, true);
});

test('Combat sub-modules damage and enemies', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_400', 'Warrior');
  const enemy = engine.combat.enemies.getEnemy('goblin');

  assert.equal(enemy.id, 'goblin');
  assert.equal(enemy.name, 'Goblin');

  const combatRes = engine.combat.attack(player, 'goblin');
  assert.equal(combatRes.attackerId, 'usr_400');
});
