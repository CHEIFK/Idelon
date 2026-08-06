import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine/index.js';
import { GameService } from '../src/service/gameService.js';
import { DevService } from '../src/service/devService.js';
import { commandRegistry } from '../src/discord/commands/index.js';

test('Phase 2 Regression: .sell copper 0 is rejected as invalid quantity', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_p2_sell0', username: 'TestHero' };
  
  const player = await gameService.getPlayer(user.id);
  player.inventory['copper_ore'] = 10;
  await gameService.savePlayer(player);

  const res = await commandRegistry.handleTextMessage('.sell copper_ore 0', user, gameService);
  assert.ok(res && res.embed, 'Should return an embed');
  assert.equal(res.embed.title, '❌ Sale Failed', 'Should report Sale Failed');
  assert.ok(res.embed.description.includes('Quantity must be a positive integer'), 'Should state positive integer requirement');

  const afterPlayer = await gameService.getPlayer(user.id);
  assert.equal(afterPlayer.inventory['copper_ore'], 10, 'Player inventory should remain 10 items');
});

test('Phase 2 Regression: Multi-option argument parsing in text commands (.dev give-item target item amount)', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const devService = new DevService(gameService, ['admin_p2']);
  const adminUser = { id: 'admin_p2', username: 'AdminHero' };

  const res = await commandRegistry.handleTextMessage('.dev give-item target_user_123 copper_ore 5', adminUser, gameService, devService);
  assert.ok(res && res.embed, 'Should return dev response embed');
  assert.equal(res.embed.title, '🛠️ Dev: Give Item');

  const targetPlayer = await gameService.getPlayer('target_user_123');
  assert.equal(targetPlayer.inventory['copper_ore'], 5, 'Target player should receive 5 copper_ore');
});

test('Phase 2 Regression: Text travel accepts a numbered sector phrase', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_text_sector_phrase', username: 'Traveler' };
  await gameService.start(user.id, user.username);
  const player = await gameService.getPlayer(user.id);
  player.level = 5;
  player.heroXp = 1100;
  await gameService.savePlayer(player);

  const result = await commandRegistry.handleTextMessage('.travel sector 2', user, gameService);
  assert.equal(result.embed.title, '🗺️ Travel Successful');
  assert.equal((await gameService.getPlayer(user.id)).currentAreaId, 'lead_quarry');
});

test('Phase 2 Regression: Text dev item arguments support slash option order', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const devService = new DevService(gameService, ['admin_p2_order']);
  const user = { id: 'admin_p2_order', username: 'AdminHero' };

  const result = await commandRegistry.handleTextMessage('.dev give-item iron_sword 2 target_order_user', user, gameService, devService);
  assert.equal(result.embed.title, '🛠️ Dev: Give Item');
  assert.equal((await gameService.getInventory('target_order_user')).iron_sword, 2);
});

test('Phase 2 Regression: Text dev scalar arguments support slash option order', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const devService = new DevService(gameService, ['admin_p2_scalar']);
  const user = { id: 'admin_p2_scalar', username: 'AdminHero' };

  const xpResult = await commandRegistry.handleTextMessage('.dev add-xp mining 0', user, gameService, devService);
  assert.equal(xpResult.embed.title, '❌ Dev Action Error');
  assert.match(xpResult.embed.description, /positive integer/);

  const currencyResult = await commandRegistry.handleTextMessage('.dev give-currency gold 0', user, gameService, devService);
  assert.equal(currencyResult.embed.title, '❌ Dev Action Error');
  assert.match(currencyResult.embed.description, /positive/);
});
