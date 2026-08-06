import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance, ACTIVITIES } from '../src/index.js';
import { createDiscordBot } from '../src/discord/index.js';

test('Mining XP remaining calculation and miningProgress helper', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_test_xp_1';
  await game.start(playerId, 'XpTester');

  const player = await game.getPlayer(playerId);
  // Initial state: level 1, 0 XP
  const progress1 = game._miningProgress(player);
  assert.equal(progress1.level, 1);
  assert.equal(progress1.totalXp, 0);
  assert.equal(progress1.xpForNext, 100);
  assert.equal(progress1.remaining, 100);

  // Set XP to 250 -> Level 2. Next level (3) requires 300 total XP on table. Remaining = 50.
  player.skills.mining = { xp: 250, level: 2 };
  const progress2 = game._miningProgress(player);
  assert.equal(progress2.level, 2);
  assert.equal(progress2.totalXp, 250);
  assert.equal(progress2.xpForNext, 300);
  assert.equal(progress2.remaining, 50);
});

test('Level-up rewards and Sterling distribution (+5 per level gained, multi-level skips, dynamic unlocks)', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_test_levelup_1';
  await game.start(playerId, 'LevelUpHero');

  const initialPlayer = await game.getPlayer(playerId);
  assert.equal(initialPlayer.currencies.sterlings, 0);

  // Start mining copper and advance time to gain enough XP to skip from level 1 to level 3
  await game.mine(playerId, 'mine_copper');
  const player = await game.getPlayer(playerId);
  assert.ok(player.currentActivity, 'Current activity should be active');
  player.currentActivity.lastClaimed -= 3600000; // 1 hour elapsed -> many cycles
  await game.savePlayer(player);

  const claimRes = await game.claimActivity(playerId);
  assert.ok(claimRes);
  assert.ok(claimRes.miningProgress);
  assert.ok(Array.isArray(claimRes.levelUps));
  assert.ok(claimRes.levelUps.length >= 2, 'Should gain multiple levels from 1 hour of mining');

  // Verify sterlings awarded: 5 sterlings per level gained in currencies.sterlings
  const totalSterlingsExpected = claimRes.levelUps.length * 5;
  const updatedPlayer = await game.getPlayer(playerId);
  assert.equal(updatedPlayer.currencies.sterlings, totalSterlingsExpected);

  // Verify levelUps array contents
  const firstLevelUp = claimRes.levelUps[0];
  assert.equal(firstLevelUp.from, 1);
  assert.equal(firstLevelUp.to, 2);
  assert.equal(firstLevelUp.sterlingsAwarded, 5);
  // Level 2 unlocks Lead Ore (and Lead Quarry area)
  assert.ok(firstLevelUp.unlocks.some(u => u.includes('Lead Ore')), 'Should contain Lead Ore unlock');
});

test('Sterling persistence layer and v5 schema migration fallback', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_test_persist_1';

  // 1. Create player and set currencies.sterlings
  await game.start(playerId, 'PersistHero');
  const player = await game.getPlayer(playerId);
  player.currencies.sterlings = 45;
  await game.savePlayer(player);

  // 2. Reload player from DB and verify sterlings survived persistence
  const reloadedPlayer = await game.getPlayer(playerId);
  assert.equal(reloadedPlayer.currencies.sterlings, 45);

  // 3. Test migration of legacy v4 save payload with top-level sterlings
  const legacyV4Save = {
    id: 'usr_legacy_v4',
    name: 'LegacyV4Hero',
    level: 5,
    currencies: { gold: 100, gems: 50 },
    sterlings: 30,
    inventory: {},
    schemaVersion: 4
  };
  const { migratePlayerSave } = await import('../migrations/index.js');
  const migratedData = migratePlayerSave(legacyV4Save);

  assert.ok(migratedData.schemaVersion >= 5);
  assert.equal(migratedData.currencies.gold, 100);
  assert.equal(migratedData.currencies.sterlings, 30);
  assert.equal(migratedData.sterlings, undefined, 'Top level sterlings should be deleted');
  assert.equal(migratedData.currencies.gems, undefined, 'Obsolete gems field should be removed');
});

test('Balance command (/bal and .bal) returns only Gold and Sterlings wallet', async () => {
  const game = await createGameInstance();
  const bot = createDiscordBot(game);
  const playerId = 'usr_test_bal_1';

  await game.start(playerId, 'WalletHero');
  const player = await game.getPlayer(playerId);
  player.currencies.gold = 385.5;
  player.currencies.sterlings = 15;
  await game.savePlayer(player);

  // 1. Direct GameService.getBalance check
  const bal = await game.getBalance(playerId);
  assert.equal(bal.gold, 385.5);
  assert.equal(bal.sterlings, 15);

  // 2. Text Command Alias .bal check
  const textRes = await bot.handleTextMessage('.bal', { id: playerId, username: 'WalletHero' });
  assert.ok(textRes);
  assert.ok(textRes.embed);
  assert.equal(textRes.embed.title, 'Account Balance');
  assert.deepEqual(textRes.embed.fields, [
    { name: '🪙 Gold:', value: '**385.5**', inline: true },
    { name: '✨ Sterlings:', value: '**15**', inline: true }
  ]);

  // 3. Slash command /bal check
  const interactionRes = await bot.handleCommandInteraction({
    commandName: 'bal',
    user: { id: playerId, username: 'WalletHero' },
    options: {}
  });
  assert.ok(interactionRes);
  assert.ok(interactionRes.embed);
  assert.equal(interactionRes.embed.title, 'Account Balance');
});
