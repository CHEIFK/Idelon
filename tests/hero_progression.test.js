import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance, ACTIVITIES } from '../src/index.js';
import { formatNumber } from '../src/utils/formatter.js';

test('Universal Number Formatter utility (formatNumber)', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(385.5), '385.5');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1000), '1K');
  assert.equal(formatNumber(12500), '12.5K');
  assert.equal(formatNumber(100000), '100K');
  assert.equal(formatNumber(1500000), '1.5M');
  assert.equal(formatNumber(2500000000), '2.5B');
  assert.equal(formatNumber(1000000000000), '1T');
  assert.equal(formatNumber(1000000000000000), '1Q');
  assert.equal(formatNumber(1000000000000000000), '1S');
});

test('Global Hero Level System accumulates XP across all activities (Mining & Combat)', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_hero_xp_1';
  await game.start(playerId, 'HeroLevelTester');

  const player = await game.getPlayer(playerId);
  assert.equal(player.level, 1);
  assert.equal(player.heroXp, 0);

  // 1. Earn Mining XP
  game.engine.skills.addXP(player, 'mining', 300);
  assert.equal(player.skills.mining.level, 2);
  assert.equal(player.heroXp, 300);
  // Hero Level = 3 for 300 heroXp on table
  assert.equal(player.level, 3);

  // 2. Earn Combat XP
  game.engine.skills.addXP(player, 'combat', 600);
  assert.equal(player.skills.combat.level, 3);
  // Total Hero XP = 300 + 600 = 900
  assert.equal(player.heroXp, 900);
  // Hero Level = 4 for 900 heroXp on table (Level 4: 650, Level 5: 1100)
  assert.equal(player.level, 4);
});

test('Combat Reward Rebalance: drops and gold scaled by ~20x with weighted randomness', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_combat_rebalance_1';
  await game.start(playerId, 'CombatMerchant');

  // Give player strong gear to guarantee combat victory
  const player = await game.getPlayer(playerId);
  player.equipment.weapon = { id: 'iron_sword', stats: { attack: 50 } };
  await game.savePlayer(player);

  const combatRes = await game.fight(playerId, 'goblin');
  assert.equal(combatRes.success, true);
  assert.equal(combatRes.victory, true);

  // Verify Gold looted is scaled by ~20x (base goblin currencyRewards gold is 2 -> scaled to ~40)
  assert.ok(combatRes.currenciesGained.gold >= 25, `Gold looted (${combatRes.currenciesGained.gold}) should be scaled by ~20x`);

  // Verify Item loot quantities are scaled by ~20x
  if (combatRes.loot && combatRes.loot.length > 0) {
    const firstDrop = combatRes.loot[0];
    assert.ok(firstDrop.amount >= 5, `Item drop amount (${firstDrop.amount}) should be significantly scaled`);
  }
});

test('Progression Consistency: Area unlocks are based on Hero Level', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_area_hero_level_1';
  await game.start(playerId, 'ExplorerHero');

  const player = await game.getPlayer(playerId);
  // Initially at Hero Level 1
  let availableAreas = game.engine.world.getAvailable(player);
  const mountainAreaAvailableBefore = availableAreas.some(a => a.id === 'misty_mountains');
  assert.equal(mountainAreaAvailableBefore, false, 'Misty Mountains (level 3 req) should be locked at Hero Level 1');

  // Gain total Hero XP across combat + mining to reach Hero Level 3 (needs 400 XP)
  game.engine.skills.addXP(player, 'combat', 200);
  game.engine.skills.addXP(player, 'mining', 250);
  assert.ok(player.level >= 3, `Hero Level should be at least 3, got ${player.level}`);

  availableAreas = game.engine.world.getAvailable(player);
  const mountainAreaAvailableAfter = availableAreas.some(a => a.id === 'misty_mountains');
  assert.equal(mountainAreaAvailableAfter, true, 'Misty Mountains should be unlocked when Hero Level reaches 3');
});
