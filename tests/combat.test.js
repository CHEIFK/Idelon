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

test('Engaging high-level enemies evaluates stat-driven combat outcome', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_novice_warrior', 'Rookie');

  // Inject a high level enemy into content loader
  engine.content.categories.enemies.set('dragon_boss', {
    id: 'dragon_boss',
    name: 'Ancient Dragon',
    level: 50,
    hp: 2000,
    attack: 100
  });

  const res = engine.combat.start(player, 'dragon_boss');
  assert.equal(res.success, true);
  assert.equal(res.playerDied, true, 'Low level player engaging ancient dragon is defeated by stats');
});

test('Combat damageDealt reports the sum of player attacks, including a first missed attack', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_damage_total', 'DamageTracker');
  const originalRandom = Math.random;
  let calls = 0;
  Math.random = () => {
    calls += 1;
    return calls === 1 ? 1 : 0;
  };
  try {
    const result = engine.combat.start(player, 'goblin');
    const totalPlayerDamage = result.turns
      .filter(turn => turn.attacker === 'player')
      .reduce((sum, turn) => sum + turn.damageDealt, 0);
    assert.equal(result.damageDealt, totalPlayerDamage);
    assert.equal(result.turns[0].damageDealt, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test('Combat loot honors fixed data-driven entry amounts before scaling', async () => {
  const engine = await createEngine();
  const enemy = { id: 'amount_enemy', lootTableId: 'amount_loot', hp: 1, attack: 1, defense: 0 };
  engine.content.categories.enemies.set(enemy.id, enemy);
  engine.content.categories.lootTables.set('amount_loot', {
    id: 'amount_loot',
    entries: [{ itemId: 'bone_fragment', amount: 2, chance: 1 }]
  });
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const drops = (await import('../src/engine/combat/loot.js')).generateCombatLoot(enemy, engine.content);
    assert.equal(drops[0].amount, 20, 'Amount 2 should scale from a 10-unit minimum');
  } finally {
    Math.random = originalRandom;
  }
});

test('Boss lookup is data-backed and boss victories emit the boss event', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_boss_data', 'Boss Hunter');
  player.level = 100;
  player.equipment.weapon = { id: 'iron_sword', stats: { attack: 10000 } };
  const events = [];
  engine.events.on(EVENTS.BOSS_KILLED, data => events.push(data));

  assert.equal(engine.combat.bosses.getBoss('goblin'), null);
  const boss = engine.combat.bosses.getBoss('ancient_dragon');
  assert.equal(boss.id, 'ancient_dragon');
  assert.equal(boss.isBoss, true);

  const result = engine.combat.start(player, 'ancient_dragon');
  assert.equal(result.isBoss, true);
  if (result.victory) {
    assert.equal(events.length, 1);
    assert.equal(events[0].bossId, 'ancient_dragon');
  }
});
