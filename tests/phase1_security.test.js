import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine/index.js';
import { GameService } from '../src/service/gameService.js';
import { DevService } from '../src/service/devService.js';
import { createDiscordBotInstance } from '../src/index.js';

test('Phase 1 Regression: Negative item quantity in InventoryModule.removeItem is rejected', async () => {
  const engine = new Engine();
  await engine.init();
  const player = engine.player.create('usr_p1_inv', 'Hero');
  player.inventory['copper_ore'] = 10;

  const res = engine.inventory.removeItem(player, 'copper_ore', -5);
  assert.equal(res, false, 'removeItem should return false for negative quantity');
  assert.equal(player.inventory['copper_ore'], 10, 'Inventory quantity should not increase');
});

test('Phase 1 Regression: Inventory and currency additions never exceed safe integer limits', async () => {
  const engine = new Engine();
  await engine.init();
  const player = engine.player.create('usr_safe_limits', 'Safe Hero');
  player.inventory.copper_ore = Number.MAX_SAFE_INTEGER - 1;
  player.currencies.gold = Number.MAX_SAFE_INTEGER - 1;

  assert.equal(engine.inventory.addItem(player, 'copper_ore', 2), Number.MAX_SAFE_INTEGER - 1);
  assert.equal(player.inventory.copper_ore, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(engine.economy.addCurrency(player, 'gold', 2), Number.MAX_SAFE_INTEGER - 1);
  assert.equal(player.currencies.gold, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(engine.economy.addCurrency(player, 'gold', 1.5), Number.MAX_SAFE_INTEGER - 1);
});

test('Phase 1 Regression: Direct removal and XP mutation reject malformed overflow state', async () => {
  const engine = new Engine();
  await engine.init();
  const player = engine.player.create('usr_malformed_runtime', 'Safe Hero');
  player.inventory.copper_ore = Infinity;
  player.currencies.gold = Infinity;
  player.heroXp = Number.MAX_SAFE_INTEGER;
  player.skills.mining = { level: 100, xp: Number.MAX_SAFE_INTEGER };

  assert.equal(engine.inventory.removeItem(player, 'copper_ore', 1), false);
  assert.equal(engine.economy.removeCurrency(player, 'gold', 1), false);
  const xpResult = engine.skills.addXP(player, 'mining', 1);
  assert.equal(xpResult.ignored, true);
  assert.equal(player.skills.mining.xp, Number.MAX_SAFE_INTEGER);
  assert.equal(player.heroXp, Number.MAX_SAFE_INTEGER);
});

test('Phase 1 Regression: Negative currency amount in EconomyModule.removeCurrency is rejected', async () => {
  const engine = new Engine();
  await engine.init();
  const player = engine.player.create('usr_p1_econ', 'Hero');
  player.currencies['gold'] = 100;

  const res = engine.economy.removeCurrency(player, 'gold', -50);
  assert.equal(res, false, 'removeCurrency should return false for negative amount');
  assert.equal(player.currencies['gold'], 100, 'Gold balance should not increase');
});

test('Phase 1 Regression: Negative sell in GameService.sellItem is rejected', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const player = await gameService.getPlayer('usr_p1_sell');
  player.inventory['copper_ore'] = 10;
  player.currencies['gold'] = 100;
  await gameService.savePlayer(player);

  const res = await gameService.sellItem('usr_p1_sell', 'copper_ore', -5);
  assert.equal(res.success, false, 'sellItem should fail for negative count');

  const updatedPlayer = await gameService.getPlayer('usr_p1_sell');
  assert.equal(updatedPlayer.inventory['copper_ore'], 10, 'Inventory should remain unchanged');
});

test('Phase 1 Regression: DevService.giveItem with null/invalid itemId is rejected without state pollution', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const devService = new DevService(gameService, ['admin_1']);

  const res = await devService.giveItem('admin_1', 'usr_p1_dev', null, 5);
  assert.equal(res.success, false, 'giveItem should return success: false for null itemId');

  const player = await gameService.getPlayer('usr_p1_dev');
  assert.equal(player.inventory['null'], undefined, 'Inventory should not contain key "null"');
  assert.equal(player.inventory['undefined'], undefined, 'Inventory should not contain key "undefined"');
});

test('Phase 1 Regression: Deposit and withdraw reject invalid quantities', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const player = await gameService.getPlayer('usr_invalid_bank_quantity');
  player.inventory.copper_ore = 5;
  player.storage.coal = 5;
  await gameService.savePlayer(player);

  const deposit = await gameService.depositItem(player.id, 'copper_ore', -1);
  const withdraw = await gameService.withdrawItem(player.id, 'coal', '1.5');
  assert.equal(deposit.success, false);
  assert.equal(deposit.reason, 'invalid_quantity');
  assert.equal(withdraw.success, false);
  assert.equal(withdraw.reason, 'invalid_quantity');

  const after = await gameService.getPlayer(player.id);
  assert.equal(after.inventory.copper_ore, 5);
  assert.equal(after.storage.coal, 5);
});

test('Phase 1 Regression: Bank and sale overflow failures do not destroy items', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const player = await gameService.getPlayer('usr_overflow_transactions');

  player.inventory.copper_ore = Number.MAX_SAFE_INTEGER;
  player.storage.copper_ore = Number.MAX_SAFE_INTEGER;
  player.currencies.gold = Number.MAX_SAFE_INTEGER;
  await gameService.savePlayer(player);

  const deposit = await gameService.depositItem(player.id, 'copper_ore', 1);
  assert.equal(deposit.success, false);
  assert.equal(deposit.reason, 'storage_limit');

  const withdraw = await gameService.withdrawItem(player.id, 'copper_ore', 1);
  assert.equal(withdraw.success, false);
  assert.equal(withdraw.reason, 'inventory_limit');

  const sale = await gameService.sellItem(player.id, 'copper_ore', 1);
  assert.equal(sale.success, false);
  assert.equal(sale.reason, 'currency_limit');

  const after = await gameService.getPlayer(player.id);
  assert.equal(after.inventory.copper_ore, Number.MAX_SAFE_INTEGER);
  assert.equal(after.storage.copper_ore, Number.MAX_SAFE_INTEGER);
  assert.equal(after.currencies.gold, Number.MAX_SAFE_INTEGER);
});

test('Phase 1 Regression: Discord deposit and withdraw explain invalid quantities', async () => {
  const bot = await createDiscordBotInstance();
  const userId = 'usr_quantity_embed';
  const player = await bot.gameService.getPlayer(userId);
  bot.gameService.engine.inventory.addItem(player, 'copper_ore', 2);
  player.storage.copper_ore = 2;
  await bot.gameService.savePlayer(player);

  const invalidDeposit = await bot.handleCommandInteraction({
    commandName: 'deposit',
    user: { id: userId, username: 'QuantityHero' },
    options: { getString: name => name === 'item' ? 'copper_ore' : '-1' }
  });
  const invalidWithdraw = await bot.handleCommandInteraction({
    commandName: 'withdraw',
    user: { id: userId, username: 'QuantityHero' },
    options: { getString: name => name === 'item' ? 'copper_ore' : '1.5' }
  });
  assert.ok(invalidDeposit.embed.description.includes('positive integer'));
  assert.ok(invalidWithdraw.embed.description.includes('positive integer'));
});
