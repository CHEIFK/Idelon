import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordBotInstance, commandRegistry } from '../src/index.js';
import { HUNT_COOLDOWN_MS } from '../src/discord/huntUi.js';

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

test('Command registry indexes all registered Idelon slash commands', () => {
  const allCmds = commandRegistry.getAllCommands();
  assert.ok(allCmds.length >= 18);

  const playerCmds = commandRegistry.getCommandsByCategory('player');
  assert.ok(playerCmds.length >= 4);

  const activitiesCmds = commandRegistry.getCommandsByCategory('activities');
  assert.equal(activitiesCmds.length, 2);

  const inventoryCmds = commandRegistry.getCommandsByCategory('inventory');
  assert.equal(inventoryCmds.length, 4);

  const combatCmds = commandRegistry.getCommandsByCategory('combat');
  assert.equal(combatCmds.length, 2);

  const worldCmds = commandRegistry.getCommandsByCategory('world');
  assert.equal(worldCmds.length, 2);

  const economyCmds = commandRegistry.getCommandsByCategory('economy');
  assert.equal(economyCmds.length, 5);

  const adminCmds = commandRegistry.getCommandsByCategory('admin');
  assert.equal(adminCmds.length, 1);
  assert.equal(commandRegistry.getCommand('buffs'), null);
});

test('Discord bot interaction pipeline for player and help commands', async () => {
  const bot = await createDiscordBotInstance();

  // /start
  const startRes = await bot.handleCommandInteraction(mockInteraction('start'));
  assert.ok(startRes.embed);
  assert.equal(startRes.embed.title, '🎮 Welcome to Idelon');
  assert.ok(startRes.embed.description.includes('Quick Start'));
  assert.ok(startRes.embed.description.includes('.mine      Gather resources'));
  assert.ok(startRes.embed.description.includes('.hunt      Fight monsters'));
  assert.ok(startRes.embed.description.includes('.travel    Explore sectors'));
  assert.ok(startRes.embed.description.includes('.areas     World Regions'));
  assert.ok(startRes.embed.description.includes('.profile   Player profile'));
  assert.ok(startRes.embed.description.includes('.stats     View your hero'));
  assert.ok(startRes.embed.description.includes('• Hunting is instant.'));
  assert.equal(startRes.embed.fields, undefined);
  for (const profileLabel of ['Hero Level', 'Battle Rank', 'Health', 'Attributes', 'Inventory', 'Player statistics']) {
    assert.equal(JSON.stringify(startRes.embed).includes(profileLabel), false, `Start guide should not include ${profileLabel}`);
  }

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
  assert.equal(helpRes.embed.description.includes('.buffs'), false);
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

test('Profile, equipment, stats, and help embeds use canonical content and commands', async () => {
  const bot = await createDiscordBotInstance();
  const user = { id: 'usr_embed_consistency', username: 'EmbedHero' };
  const player = await bot.gameService.getPlayer(user.id);
  bot.gameService.engine.inventory.addItem(player, 'iron_sword', 1);
  bot.gameService.engine.equipment.equip(player, 'iron_sword');
  await bot.gameService.savePlayer(player);

  const profile = await bot.handleTextMessage('.profile', user);
  const equipment = await bot.handleTextMessage('.equipment', user);
  const stats = await bot.handleTextMessage('.stats', user);
  const help = await bot.handleTextMessage('.help', user);

  assert.equal(profile.embed.description.includes('Equipment'), false);
  assert.equal(profile.embed.description.includes('Hero Attributes'), false);
  assert.ok(profile.embed.description.includes('✨ Active Buffs\nNone'));
  assert.ok(equipment.embed.description.includes('Iron Sword'));
  assert.ok(stats.embed.fields.find(f => f.name === '🛡 Equipment').value.includes('Iron Sword'));
  assert.equal(stats.embed.fields.some(f => f.name.includes('Active Mining')), false);
  assert.equal(stats.embed.fields.some(f => f.name.includes('Active Hunting')), false);
  assert.ok(help.embed.fields[0].value.includes('/stats'));
  assert.ok(help.embed.fields[0].value.includes('/equipment'));
});

test('Discord bot interaction pipeline for combat and world exploration', async () => {
  const bot = await createDiscordBotInstance();
  const userId = 'usr_discord_1';

  // /enemies
  const enemiesRes = await bot.handleCommandInteraction(mockInteraction('enemies', {}, userId));
  assert.ok(enemiesRes.embed);
  assert.equal(enemiesRes.embed.title.includes('Enemies in'), true);

  // /hunt (valid enemy)
  const huntRes = await bot.handleCommandInteraction(mockInteraction('hunt', { enemy: 'goblin' }, userId));
  assert.ok(huntRes.embed);
  assert.equal(huntRes.embed.title.includes('Encounter Victory') || huntRes.embed.title.includes('Defeated'), true);

  // /hunt (invalid enemy friendly error)
  const invalidHuntRes = await bot.handleCommandInteraction(mockInteraction('hunt', { enemy: 'non_existent_boss' }, userId));
  assert.ok(invalidHuntRes.embed);
  assert.equal(invalidHuntRes.embed.title, '❌ Unknown Enemy');

  // /areas
  const areasRes = await bot.handleCommandInteraction(mockInteraction('areas', {}, userId));
  assert.ok(areasRes.embed);
  assert.equal(areasRes.embed.title.includes('World Regions'), true);

  // /travel
  const travelRes = await bot.handleCommandInteraction(mockInteraction('travel', { area: 'starter_village' }, userId));
  assert.ok(travelRes.embed);
});

test('Hunt component cooldown disables only the Hunt button', async () => {
  const bot = await createDiscordBotInstance();
  const user = { id: 'usr_hunt_cooldown', username: 'CooldownHunter' };

  const result = await bot.handleComponentInteraction({
    customId: `hunt:fight:${user.id}`,
    user
  });

  assert.equal(result.huntCooldownMs, HUNT_COOLDOWN_MS);
  const buttons = result.components.flatMap(row => row.components || []);
  const huntButton = buttons.find(button => button.custom_id === `hunt:fight:${user.id}`);
  const otherButtons = buttons.filter(button => button.custom_id !== `hunt:fight:${user.id}`);

  assert.equal(huntButton.disabled, true);
  assert.ok(otherButtons.length > 0);
  assert.equal(otherButtons.some(button => button.disabled === true), false);
});
