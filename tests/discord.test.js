import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordBotInstance, commandRegistry } from '../src/index.js';

function mockInteraction(commandName, options = {}, userId = 'usr_discord_1', username = 'DiscordUser') {
  return {
    commandName,
    user: { id: userId, username },
    options: {
      getString: (key) => options[key] || null,
      getInteger: (key) => options[key] || null
    }
  };
}

test('Command registry indexes all 18 Idelon V1 MVP slash commands', () => {
  const allCmds = commandRegistry.getAllCommands();
  assert.equal(allCmds.length, 18);

  const playerCmds = commandRegistry.getCommandsByCategory('player');
  assert.equal(playerCmds.length, 4);

  const activitiesCmds = commandRegistry.getCommandsByCategory('activities');
  assert.equal(activitiesCmds.length, 2);

  const inventoryCmds = commandRegistry.getCommandsByCategory('inventory');
  assert.equal(inventoryCmds.length, 4);

  const combatCmds = commandRegistry.getCommandsByCategory('combat');
  assert.equal(combatCmds.length, 2);

  const worldCmds = commandRegistry.getCommandsByCategory('world');
  assert.equal(worldCmds.length, 2);

  const economyCmds = commandRegistry.getCommandsByCategory('economy');
  assert.equal(economyCmds.length, 3);

  const adminCmds = commandRegistry.getCommandsByCategory('admin');
  assert.equal(adminCmds.length, 1);
});

test('Discord bot interaction pipeline for player and help commands', async () => {
  const bot = await createDiscordBotInstance();

  // /start
  const startRes = await bot.handleCommandInteraction(mockInteraction('start'));
  assert.ok(startRes.embed);

  // /profile
  const profileRes = await bot.handleCommandInteraction(mockInteraction('profile'));
  assert.ok(profileRes.embed);

  // /skills
  const skRes = await bot.handleCommandInteraction(mockInteraction('skills'));
  assert.ok(skRes.embed);

  // /help
  const helpRes = await bot.handleCommandInteraction(mockInteraction('help'));
  assert.ok(helpRes.embed);
  assert.equal(helpRes.embed.title.includes('Idelon Game Commands'), true);
});

test('Discord bot interaction pipeline for storage, inventory, and shop', async () => {
  const bot = await createDiscordBotInstance();
  const userId = 'usr_discord_1';

  // /inv
  const invRes = await bot.handleCommandInteraction(mockInteraction('inv', {}, userId));
  assert.ok(invRes.embed);

  // /storage
  const storageRes = await bot.handleCommandInteraction(mockInteraction('storage', {}, userId));
  assert.ok(storageRes.embed);

  // Add copper ore to inventory for testing deposit/sell and SAVE
  const player = await bot.gameService.getPlayer(userId);
  bot.gameService.engine.inventory.addItem(player, 'copper_ore', 10);
  await bot.gameService.savePlayer(player);

  // /deposit copper_ore 5
  const depRes = await bot.handleCommandInteraction(mockInteraction('deposit', { item: 'copper_ore', amount: '5' }, userId));
  assert.ok(depRes.embed);
  assert.equal(depRes.embed.title.includes('Deposited'), true);

  // /withdraw copper_ore all
  const wdrawRes = await bot.handleCommandInteraction(mockInteraction('withdraw', { item: 'copper_ore', amount: 'all' }, userId));
  assert.ok(wdrawRes.embed);
  assert.equal(wdrawRes.embed.title.includes('Withdrawn'), true);

  // /shop
  const shopRes = await bot.handleCommandInteraction(mockInteraction('shop', {}, userId));
  assert.ok(shopRes.embed);

  // /sell copper_ore all
  const sellRes = await bot.handleCommandInteraction(mockInteraction('sell', { item: 'copper_ore', amount: 'all' }, userId));
  assert.ok(sellRes.embed);
  assert.equal(sellRes.embed.title.includes('Items Sold'), true);
});

test('Text Command Alias pipeline (.profile, .inv, .shop, .mine, .sell)', async () => {
  const bot = await createDiscordBotInstance();
  const user = { id: 'usr_alias_1', username: 'AliasUser' };

  // .profile == /profile
  const textProfile = await bot.handleTextMessage('.profile', user);
  const slashProfile = await bot.handleCommandInteraction(mockInteraction('profile', {}, user.id, user.username));
  assert.equal(textProfile.embed.title, slashProfile.embed.title);

  // .inv == /inv
  const textInv = await bot.handleTextMessage('.inv', user);
  const slashInv = await bot.handleCommandInteraction(mockInteraction('inv', {}, user.id, user.username));
  assert.equal(textInv.embed.title, slashInv.embed.title);

  // Add copper ore for sale and SAVE
  const player = await bot.gameService.getPlayer(user.id);
  bot.gameService.engine.inventory.addItem(player, 'copper_ore', 10);
  await bot.gameService.savePlayer(player);

  // .sell copper 5
  const textSell = await bot.handleTextMessage('.sell copper 5', user);
  assert.ok(textSell.embed);
  assert.equal(textSell.embed.title.includes('Items Sold'), true);

  // Default .mine defaults to Copper Ore
  const textMine = await bot.handleTextMessage('.mine', user);
  assert.ok(textMine.embed);
});

test('Fix /sell slash command parameter parsing bug', async () => {
  const bot = await createDiscordBotInstance();
  const userId = 'usr_sell_fix';

  const player = await bot.gameService.getPlayer(userId);
  bot.gameService.engine.inventory.addItem(player, 'copper_ore', 10);
  await bot.gameService.savePlayer(player);

  // Pass single string parameter "copper 5"
  const singleStringRes = await bot.handleCommandInteraction(mockInteraction('sell', { item: 'copper 5' }, userId));
  assert.ok(singleStringRes.embed);
  assert.equal(singleStringRes.embed.title.includes('Items Sold'), true);

  // Pass single string parameter "copper all"
  const p2 = await bot.gameService.getPlayer(userId);
  bot.gameService.engine.inventory.addItem(p2, 'copper_ore', 5);
  await bot.gameService.savePlayer(p2);

  const allStringRes = await bot.handleCommandInteraction(mockInteraction('sell', { item: 'copper all' }, userId));
  assert.ok(allStringRes.embed);
  assert.equal(allStringRes.embed.title.includes('Items Sold'), true);
});

test('Discord bot interaction pipeline for combat and world exploration', async () => {
  const bot = await createDiscordBotInstance();
  const userId = 'usr_discord_1';

  // /enemies
  const enemiesRes = await bot.handleCommandInteraction(mockInteraction('enemies', {}, userId));
  assert.ok(enemiesRes.embed);
  assert.equal(enemiesRes.embed.title.includes('Enemies in'), true);

  // /fight (valid enemy)
  const fightRes = await bot.handleCommandInteraction(mockInteraction('fight', { enemy: 'goblin' }, userId));
  assert.ok(fightRes.embed);
  assert.equal(fightRes.embed.title.includes('Victory'), true);

  // /fight (invalid enemy friendly error)
  const invalidFightRes = await bot.handleCommandInteraction(mockInteraction('fight', { enemy: 'non_existent_boss' }, userId));
  assert.ok(invalidFightRes.embed);
  assert.equal(invalidFightRes.embed.title.includes('Unknown Enemy'), true);

  // /areas
  const areasRes = await bot.handleCommandInteraction(mockInteraction('areas', {}, userId));
  assert.ok(areasRes.embed);
  assert.equal(areasRes.embed.title.includes('World Regions'), true);

  // /travel
  const travelRes = await bot.handleCommandInteraction(mockInteraction('travel', { area: 'starter_village' }, userId));
  assert.ok(travelRes.embed);
});
