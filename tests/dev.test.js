import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance, createDevService, createDiscordBot } from '../src/index.js';

function mockDevInteraction(subcommand, options = {}, userId = 'dev_123') {
  return {
    commandName: 'dev',
    user: { id: userId, username: 'DevUser' },
    options: {
      getString: (key) => key === 'subcommand' ? subcommand : (options[key] || null),
      getInteger: (key) => options[key] || null
    }
  };
}

test('DevService security authorization and production toggle', async () => {
  const game = await createGameInstance();
  const devService = createDevService(game, ['dev_123'], true);

  // Authorized dev
  assert.equal(devService.isDev('dev_123'), true);
  // Unauthorized user
  assert.equal(devService.isDev('user_456'), false);

  // Disabled in production check
  const prodDevService = createDevService(game, ['dev_123'], false);
  assert.equal(prodDevService.isDev('dev_123'), false);
  assert.rejects(async () => {
    await prodDevService.giveItem('dev_123', 'usr_target', 'iron_sword', 1);
  }, /disabled in this environment/);
});

test('Dev toolkit commands execution pipeline and audit logging', async () => {
  const game = await createGameInstance();
  const devService = createDevService(game, ['dev_123'], true);
  const bot = createDiscordBot(game, devService);

  const adminId = 'dev_123';
  const targetId = 'usr_target_1';

  await game.start(targetId, 'TargetPlayer');

  // 1. give-item
  const giveRes = await bot.handleCommandInteraction(mockDevInteraction('give-item', { target_user: targetId, item: 'iron_sword', amount: 1 }, adminId));
  assert.equal(giveRes.embed.title.includes('Give Item'), true);
  assert.equal(await game.getInventory(targetId).then(i => i['iron_sword']), 1);

  // 2. remove-item
  const remRes = await bot.handleCommandInteraction(mockDevInteraction('remove-item', { target_user: targetId, item: 'iron_sword', amount: 1 }, adminId));
  assert.equal(remRes.embed.title.includes('Remove Item'), true);
  assert.equal(await game.getInventory(targetId).then(i => i['iron_sword']), undefined);

  // 3. add-xp & set-level
  await bot.handleCommandInteraction(mockDevInteraction('add-xp', { target_user: targetId, skill: 'mining', amount: 500 }, adminId));
  const skills = await game.getSkills(targetId);
  assert.equal(skills.mining.xp, 500);

  await bot.handleCommandInteraction(mockDevInteraction('set-level', { target_user: targetId, amount: 25 }, adminId));
  const profile = await game.getProfile(targetId);
  assert.equal(profile.level, 25);

  // 4. give-currency
  await bot.handleCommandInteraction(mockDevInteraction('give-currency', { target_user: targetId, currency: 'gold', amount: 1000 }, adminId));
  const profile2 = await game.getProfile(targetId);
  assert.equal(profile2.currencies.gold, 1000);

  // 5. teleport
  await bot.handleCommandInteraction(mockDevInteraction('teleport', { target_user: targetId, area: 'dragon_spire' }, adminId));
  const profile3 = await game.getProfile(targetId);
  assert.equal(profile3.currentAreaId, 'dragon_spire');

  // 6. reload-content & player-info
  const reloadRes = await bot.handleCommandInteraction(mockDevInteraction('reload-content', {}, adminId));
  assert.equal(reloadRes.embed.title.includes('Reload Content'), true);

  const infoRes = await bot.handleCommandInteraction(mockDevInteraction('player-info', { target_user: targetId }, adminId));
  assert.equal(infoRes.embed.title.includes('Player Info'), true);
});

test('Dev toolkit rejects unauthorized user', async () => {
  const game = await createGameInstance();
  const devService = createDevService(game, ['dev_123'], true);
  const bot = createDiscordBot(game, devService);

  const res = await bot.handleCommandInteraction(mockDevInteraction('give-item', { item: 'iron_sword' }, 'unauthorized_user'));
  assert.equal(res.embed.title.includes('Permission Denied'), true);
});
