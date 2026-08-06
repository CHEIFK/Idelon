import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine/index.js';
import { GameService } from '../src/service/gameService.js';
import { commandRegistry } from '../src/discord/commands/index.js';

test('Instant Combat Test: .hunt returns combat result immediately without background session or claim', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_instant_hunt_1', username: 'InstantHunter' };

  await gameService.start(user.id, user.username);

  // Execute a targeted hunt; plain .hunt opens the hunting grounds overview.
  const huntRes = await commandRegistry.handleTextMessage('.hunt goblin', user, gameService);
  assert.ok(huntRes && huntRes.embed, 'Should return instant combat embed');
  assert.ok(huntRes.embed.title.includes('Encounter Victory') || huntRes.embed.title.includes('Defeated'), 'Title should reflect encounter result');

  // Verify no currentHunt session was created
  const player = await gameService.getPlayer(user.id);
  assert.equal(player.currentHunt, undefined, 'player.currentHunt must be undefined');

  // Verify .claim returns Nothing to Claim when only hunting was executed
  const claimRes = await commandRegistry.handleTextMessage('.claim', user, gameService);
  assert.ok(claimRes && claimRes.embed.title.includes('Nothing to Claim'), '.claim is for idle activities like mining, not hunting');
});

test('Instant Combat Test: .hunt goblin targets only Goblin enemies', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_instant_goblin', username: 'GoblinSlayer' };

  await gameService.start(user.id, user.username);

  const huntRes = await commandRegistry.handleTextMessage('.hunt goblin', user, gameService);
  assert.ok(huntRes && huntRes.embed, 'Should return combat result');

  const fields = huntRes.embed.fields || [];
  const enemiesField = fields.find(f => f.name.includes('Enemies Defeated'));
  assert.ok(enemiesField, 'Should contain Enemies Defeated field');
  assert.ok(enemiesField.value.includes('Goblin'), 'Should list defeated Goblin enemies');
});

test('Instant Combat Test: Starter player consistently defeats starter monsters', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_starter_balance', username: 'NovicePlayer' };

  await gameService.start(user.id, user.username);

  // Brand new player executes .hunt in Starter Village
  const result = await gameService.huntInstant(user.id);
  assert.equal(result.success, true);
  assert.equal(result.victory, true, 'Starter player must defeat starter monsters');
  assert.equal(result.playerDied, false);
  assert.ok(result.enemiesDefeated.length >= 3, 'Defeats all starter village enemies (Goblin Scavenger, Goblin Scout, Giant Rat)');
  assert.ok(result.hpRemaining > 0, 'Player retains HP after victory');
});

test('Instant Combat Test: Travel unlocks additional monsters in .hunt', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_travel_monsters', username: 'SectorTraveler' };

  await gameService.start(user.id, user.username);

  // Boost level to travel
  const player = await gameService.getPlayer(user.id);
  player.level = 10;
  player.skills = player.skills || {};
  player.skills.combat = { level: 10, xp: 5000 };
  await gameService.savePlayer(player);

  // Travel to Sand Dunes
  await gameService.travel(user.id, 'sand_dunes');

  const res = await gameService.huntInstant(user.id);
  assert.equal(res.success, true);
  assert.ok(res.enemiesDefeated.some(e => e.id === 'bandit'), 'Should automatically include Bandit from Sand Dunes');
});

test('Mining consistency: .mine starts idle mining and .claim collects rewards', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_mining_idle', username: 'IdleMiner' };

  await gameService.start(user.id, user.username);

  await commandRegistry.handleTextMessage('.mine', user, gameService);

  const player = await gameService.getPlayer(user.id);
  assert.ok(player.currentActivity, 'player.currentActivity should be active');
  player.currentActivity.lastClaimed -= 60000;
  await gameService.savePlayer(player);

  const claimRes = await commandRegistry.handleTextMessage('.claim', user, gameService);
  assert.ok(claimRes && claimRes.embed.title.includes('Claimed') || claimRes.embed.title.includes('Auto Mining'));
});
