import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, EVENTS } from '../src/index.js';

test('Data-driven combat simulation with equipped stats, turns, loot, XP, and events', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_warrior_1', 'Kratos');

  // Equip Iron Sword (+10 attack) & Iron Helmet (+8 defense, +20 health)
  engine.inventory.addItem(player, 'iron_sword', 1);
  engine.inventory.addItem(player, 'iron_helmet', 1);
  engine.equipment.equip(player, 'iron_sword');
  engine.equipment.equip(player, 'iron_helmet');

  const eventsRecorded = [];
  engine.events.on(EVENTS.COMBAT_STARTED, (d) => eventsRecorded.push({ type: EVENTS.COMBAT_STARTED, d }));
  engine.events.on(EVENTS.COMBAT_TURN, (d) => eventsRecorded.push({ type: EVENTS.COMBAT_TURN, d }));
  engine.events.on(EVENTS.COMBAT_VICTORY, (d) => eventsRecorded.push({ type: EVENTS.COMBAT_VICTORY, d }));
  engine.events.on(EVENTS.XP_GAINED, (d) => eventsRecorded.push({ type: EVENTS.XP_GAINED, d }));
  engine.events.on(EVENTS.ITEM_ADDED, (d) => eventsRecorded.push({ type: EVENTS.ITEM_ADDED, d }));

  // Run combat against Goblin
  const result = engine.combat.start(player, 'goblin');

  assert.equal(result.success, true);
  assert.equal(result.victory, true);
  assert.ok(result.turnsCount > 0);
  assert.ok(result.xpGained > 0);
  assert.equal(engine.skills.getXP(player, 'combat'), result.xpGained);
  assert.ok(engine.economy.getCurrencies(player).gold >= 25, 'Gold reward should be scaled by ~20x');

  // Check getResult API
  const lastRes = engine.combat.getResult();
  assert.equal(lastRes, result);

  // Check events emitted
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.COMBAT_STARTED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.COMBAT_TURN), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.COMBAT_VICTORY), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.XP_GAINED), true);
});

test('Combat respawn: fights against the same enemy reset enemy HP per encounter', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_warrior_2', 'Gladiator');

  const res1 = engine.combat.start(player, 'goblin');
  assert.equal(res1.victory, true);

  // Second fight immediately after
  const res2 = engine.combat.start(player, 'goblin');
  assert.equal(res2.victory, true);
  assert.equal(res2.enemyFinalHp, 0);
});

test('Level requirement check prevents engaging high-level enemies', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_novice_warrior', 'Rookie');

  // Inject a high level enemy into content loader
  engine.content.categories.enemies.set('dragon_boss', {
    id: 'dragon_boss',
    name: 'Ancient Dragon',
    level: 50,
    levelReq: 50,
    hp: 2000,
    attack: 100
  });

  const res = engine.combat.start(player, 'dragon_boss');
  assert.equal(res.success, false);
  assert.equal(res.reason, 'level_too_low');
});
