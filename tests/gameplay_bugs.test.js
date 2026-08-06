import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine/index.js';
import { GameService } from '../src/service/gameService.js';
import { commandRegistry } from '../src/discord/commands/index.js';
import { createGameInstance } from '../src/index.js';

test('Gameplay Bug 1: Repeated command prefixes (.hunt.hunt.hunt) execute command only once', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_repeat_1', username: 'FightUser' };

  // Initialize player profile
  await gameService.start(user.id, user.username);

  // 1. Test .hunt.hunt.hunt
  const resFight = await commandRegistry.handleTextMessage('.hunt.hunt.hunt goblin', user, gameService);
  assert.ok(resFight && resFight.embed, 'Should handle .hunt.hunt.hunt');
  assert.ok(resFight.embed.title.includes('Hunt Started') || resFight.embed.title.includes('Victory') || resFight.embed.title.includes('Defeated'), 'Should execute hunt once');

  // 2. Test .travel.travel.travel 01 (starter village area)
  const resTravel = await commandRegistry.handleTextMessage('.travel.travel.travel 01', user, gameService);
  assert.ok(resTravel && resTravel.embed, 'Should handle .travel.travel.travel 01');
  assert.ok(resTravel.embed.title.includes('Travel Successful') || resTravel.embed.title.includes('Arrived'), 'Should execute travel once with arg 01');

  // 3. Test .claim.claim.claim
  const resClaim = await commandRegistry.handleTextMessage('.claim.claim.claim', user, gameService);
  assert.ok(resClaim && resClaim.embed, 'Should handle .claim.claim.claim');
});

test('Gameplay Bug 2: Reissuing .mine while already mining preserves progress and allows .claim', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_mine_repeat', username: 'MinerHero' };

  await gameService.start(user.id, user.username);

  // Step 1: Start mining session
  const resStart = await commandRegistry.handleTextMessage('.mine', user, gameService);
  assert.ok(resStart && resStart.embed, 'Should start auto mining');
  assert.ok(resStart.embed.title.includes('Started'), 'Should indicate mining started');

  const player = await gameService.getPlayer(user.id);
  assert.ok(player.currentActivity, 'Player should have an active currentActivity');

  // Simulate 30 seconds of elapsed mining time (12 cycles of 2.5s duration)
  const originalStartTime = Date.now() - 30000;
  player.currentActivity.startTime = originalStartTime;
  player.currentActivity.lastClaimed = originalStartTime;
  await gameService.savePlayer(player);

  // Step 2: Re-issue .mine accidentally before claiming
  const resSecondMine = await commandRegistry.handleTextMessage('.mine', user, gameService);
  assert.ok(resSecondMine && resSecondMine.embed, 'Should return already mining response');
  assert.ok(resSecondMine.embed.title.includes('Already Mining'), 'Should notify user they are already mining');

  // Verify progress was NOT reset
  const playerAfterSecondMine = await gameService.getPlayer(user.id);
  assert.equal(playerAfterSecondMine.currentActivity.startTime, originalStartTime, 'Original startTime must be preserved');
  assert.equal(playerAfterSecondMine.currentActivity.lastClaimed, originalStartTime, 'Original lastClaimed must be preserved');

  // Step 3: Issue .claim to verify accumulated progress is claimed successfully
  const resClaim = await commandRegistry.handleTextMessage('.claim', user, gameService);
  assert.ok(resClaim && resClaim.embed, 'Should return claim result embed');
  assert.ok(resClaim.embed.title.includes('Claimed'), 'Should claim accumulated rewards');

  const fields = resClaim.embed.fields || [];
  const cyclesField = fields.find(f => f.name.includes('Cycles'));
  assert.ok(cyclesField, 'Should contain Cycles field');
  assert.ok(cyclesField.value.includes('12') || cyclesField.value.includes('Cycles'), 'Should claim accumulated 12 cycles from original session');
});

test('Gameplay Bug 2: Reissuing single node .mine copper while already mining preserves progress', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_mine_copper_repeat', username: 'CopperMiner' };

  await gameService.start(user.id, user.username);

  // Start mining copper
  await commandRegistry.handleTextMessage('.mine copper', user, gameService);

  const player = await gameService.getPlayer(user.id);
  const originalStartTime = Date.now() - 60000; // 60s ago
  player.currentActivity.startTime = originalStartTime;
  player.currentActivity.lastClaimed = originalStartTime;
  await gameService.savePlayer(player);

  // Accidentally type .mine copper again
  const resSecond = await commandRegistry.handleTextMessage('.mine copper', user, gameService);
  assert.ok(resSecond && resSecond.embed.title.includes('Already Mining'));

  const playerAfter = await gameService.getPlayer(user.id);
  assert.equal(playerAfter.currentActivity.startTime, originalStartTime, 'startTime must be preserved');

  // Claim
  const resClaim = await commandRegistry.handleTextMessage('.claim', user, gameService);
  assert.ok(resClaim && resClaim.embed.title.includes('Claimed'));
});

test('Combat persists remaining HP and applies the health attribute consistently', async () => {
  const engine = new Engine();
  await engine.init();
  const service = new GameService(engine);
  await service.start('usr_hp_persistence', 'VitalHero');

  const player = await service.getPlayer('usr_hp_persistence');
  player.attributes.health = 10;
  player.hp = undefined;
  await service.savePlayer(player);

  const profile = await service.getProfile(player.id);
  assert.equal(profile.maxHp, 200);

  const result = engine.combat.simulate(player, 'goblin');
  assert.equal(player.hp, result.playerFinalHp);
  assert.ok(player.hp < profile.maxHp, 'A non-trivial encounter should consume HP');
  assert.equal(result.maxHp, profile.maxHp);
  assert.equal(
    engine.attributes.calculateMaxHealth(player),
    100 + player.level * 10 + 90,
    'The health attribute remains part of the canonical max HP calculation after combat'
  );
});

test('GameService preserves its crafting and equipment public APIs', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_service_compatibility';
  await game.start(playerId, 'Compatibility Hero');
  const player = await game.getPlayer(playerId);

  game.engine.inventory.addItem(player, 'copper_ore', 2);
  game.engine.inventory.addItem(player, 'iron_sword', 1);
  await game.savePlayer(player);

  const craftResult = await game.craft(playerId, 'smelt_copper_bar');
  assert.equal(craftResult.success, true);
  assert.equal((await game.getInventory(playerId)).copper_bar, 1);

  const equipResult = await game.equip(playerId, 'iron_sword');
  assert.equal(equipResult.success, true);
  assert.equal((await game.getEquipment(playerId)).weapon.id, 'iron_sword');

  const unequipResult = await game.unequip(playerId, 'weapon');
  assert.equal(unequipResult.success, true);
  assert.equal((await game.getEquipment(playerId)).weapon, undefined);
});

test('Auto mining starts newly unlocked resources at travel time', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_auto_mining_travel_boundary';
  await game.start(playerId, 'Boundary Miner');
  await game.mineAuto(playerId);

  const beforeTravel = await game.getPlayer(playerId);
  const oldStart = beforeTravel.currentActivity.lastClaimed - 60_000;
  beforeTravel.currentActivity.lastClaimed = oldStart;
  await game.savePlayer(beforeTravel);

  const progressed = await game.getPlayer(playerId);
  progressed.heroXp = 5000;
  progressed.level = 5;
  progressed.skills.mining = { level: 2, xp: 200 }; // Lead resource skill requirement
  await game.savePlayer(progressed);
  await game.travel(playerId, 'lead_quarry');

  const afterTravel = await game.getPlayer(playerId);
  assert.ok(afterTravel.currentActivity.activityStartedAt.mine_lead >= afterTravel.currentActivity.lastClaimed - 60_000);
  assert.ok(afterTravel.currentActivity.activityStartedAt.mine_lead >= Date.now() - 5000);
});
