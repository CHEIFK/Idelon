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
  assert.equal(player.skills.mining.level, 3);
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

test('Regression Test: XP gain, level, remaining XP, level-up events, and unlocks remain consistent across level boundaries', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_progression_consistency_test';
  await game.start(playerId, 'ConsistencyHero');

  const player = await game.getPlayer(playerId);
  game.engine.skills.addXP(player, 'mining', 1595);

  let progressBefore = game._miningProgress(player);

  // Before boundary cross:
  // Level 5 requires 1,100 XP, Level 6 requires 1,600 XP.
  // At 1,595 XP, level is 5, remaining to Level 6 is 1,600 - 1,595 = 5 XP.
  assert.equal(player.skills.mining.level, 5);
  assert.equal(progressBefore.level, 5);
  assert.equal(progressBefore.remaining, 5);
  assert.equal(progressBefore.xpForNext, 1600);

  // Cross level boundary (+192 XP -> total 1,787 XP)
  const xpRes = game.engine.skills.addXP(player, 'mining', 192);
  let progressAfter = game._miningProgress(player);

  // Verify internal consistency:
  // 1. Current level updated to 6
  assert.equal(xpRes.leveledUp, true);
  assert.equal(player.skills.mining.level, 6);
  assert.equal(progressAfter.level, 6);

  // 2. Next level target is Level 7 (2,200 XP)
  assert.equal(progressAfter.xpForNext, 2200);

  // 3. Remaining XP is consistent with next level target (2200 - 1787 = 413)
  assert.equal(progressAfter.remaining, 2200 - 1787);

  // 4. Level-up reward computation is triggered for Level 6
  const levelUps = game._computeLevelUpRewards(player, 'mining', 5);
  assert.equal(levelUps.length, 1);
  assert.equal(levelUps[0].from, 5);
  assert.equal(levelUps[0].to, 6);
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

  // Materials are stack-scaled; equipment remains a single-item reward.
  const materialDrop = combatRes.loot?.find(drop => !game.engine.content.getEquipment(drop.itemId));
  if (materialDrop) {
    assert.ok(materialDrop.amount >= 5, `Material drop amount (${materialDrop.amount}) should be significantly scaled`);
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
  assert.equal(mountainAreaAvailableBefore, false, 'Misty Mountains (Hero Level 45) should be locked at Hero Level 1');

  // Gain total Hero XP across combat + mining to reach Hero Level 3.
  game.engine.skills.addXP(player, 'combat', 200);
  game.engine.skills.addXP(player, 'mining', 250);
  assert.ok(player.level >= 3, `Hero Level should be at least 3, got ${player.level}`);

  availableAreas = game.engine.world.getAvailable(player);
  const mountainAreaAvailableAfter = availableAreas.some(a => a.id === 'misty_mountains');
  assert.equal(mountainAreaAvailableAfter, false, 'Misty Mountains remains locked below Hero Level 45');

  // Sector 03 unlocks at Hero Level 10, independently of combat level.
  game.engine.skills.addXP(player, 'combat', 4150);
  assert.equal(player.level, 10);
  availableAreas = game.engine.world.getAvailable(player);
  assert.equal(availableAreas.some(a => a.id === 'sand_dunes'), true);
  assert.equal(availableAreas.some(a => a.id === 'misty_mountains'), false);
});
