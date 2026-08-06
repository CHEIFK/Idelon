import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createDiscordBotInstance } from '../src/index.js';
import { migratePlayerSave, CURRENT_SCHEMA_VERSION } from '../migrations/index.js';
import { createProfileEmbed, createStatsEmbed, renderHealthBar } from '../src/discord/embeds.js';
import { getXpForLevel } from '../src/engine/progression.js';

test('Hero Attributes: Default attributes initialization on new player', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_attr_test_1', 'Attr Hero');

  assert.ok(player.attributes);
  assert.equal(player.attributes.strength, 1);
  assert.equal(player.attributes.attack, 1);
  assert.equal(player.attributes.loot, 1);
  assert.equal(player.attributes.health, 1);
  assert.equal(player.attributes.regeneration, 1);
  assert.equal(player.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test('Hero Attributes: Save and load persistence of custom attributes', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_attr_persist', 'Persist Hero');
  
  // Custom attribute levels
  player.attributes.strength = 5;
  player.attributes.health = 3;
  player.attributes.regeneration = 2;
  await engine.player.save(player);

  const reloaded = await engine.player.load('usr_attr_persist');
  assert.ok(reloaded);
  assert.equal(reloaded.attributes.strength, 5);
  assert.equal(reloaded.attributes.health, 3);
  assert.equal(reloaded.attributes.regeneration, 2);
  assert.equal(reloaded.attributes.attack, 1);
  assert.equal(reloaded.attributes.loot, 1);
});

test('Hero Attributes: Migration of legacy save payloads (v0 - v5) to the current schema with default attributes', () => {
  const legacyV5Save = {
    id: 'usr_legacy_v5',
    name: 'V5 Hero',
    level: 10,
    heroXp: 5000,
    currencies: { gold: 100, sterlings: 10 },
    schemaVersion: 5
  };

  const migrated = migratePlayerSave(legacyV5Save);
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(migrated.attributes);
  assert.equal(migrated.attributes.strength, 1);
  assert.equal(migrated.attributes.attack, 1);
  assert.equal(migrated.attributes.loot, 1);
  assert.equal(migrated.attributes.health, 1);
  assert.equal(migrated.attributes.regeneration, 1);
});

test('Hero Attributes: Single source of truth for derived stats (Max HP, Regeneration, Battle Rank)', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_derived_test', 'Derived Hero');
  player.level = 10;
  player.attributes.health = 4; // +30 HP (3 levels above 1)
  player.attributes.regeneration = 3; // +15 HP every 5 mins

  const maxHp = engine.attributes.calculateMaxHealth(player);
  // Base 100 + Level 10 * 10 (100) + (Health 4 - 1) * 10 (30) = 230
  assert.equal(maxHp, 230);

  const regen = engine.attributes.calculateRegeneration(player);
  assert.equal(regen.hpPerInterval, 15);
  assert.equal(regen.displayText, '+15 HP every 5 minutes');

  const rank = engine.attributes.getBattleRank(player);
  assert.equal(rank, 'Gold');
});

test('Hero Profile Embed: Compact overview omits detailed character-sheet sections', async () => {
  const bot = await createDiscordBotInstance();
  const userId = 'usr_profile_test';
  
  const player = await bot.gameService.getPlayer(userId);
  player.name = 'ProfileHero';
  player.heroXp = getXpForLevel(5);
  player.level = 5;
  await bot.gameService.savePlayer(player);

  const profile = await bot.gameService.getProfile(userId);
  const embed = createProfileEmbed(profile);

  // Title verification
  assert.equal(embed.title, '👤 ProfileHero');

  // Verify Footer is hidden (no Player ID or Engine version)
  assert.equal(embed.footer, undefined);

  assert.equal(embed.fields, undefined);
  assert.ok(embed.description.includes('⭐ Hero Lv.5 • 🏅 Silver'));
  assert.ok(embed.description.includes('❤️ 150 / 150 HP'));
  assert.ok(embed.description.includes('💰 0 Gold'));
  assert.ok(embed.description.includes('📍 🏡 Starter Village'));
  assert.ok(embed.description.includes('✨ Active Buffs\nNone'));
  assert.ok(embed.description.includes('⛏ Mining Lv.1 • ⚔ Combat Lv.1'));
  assert.ok(embed.description.includes('🪓 Woodcutting Lv.1 • 🎣 Fishing Lv.1'));
  assert.ok(embed.description.includes('🔥 Smithing Lv.1'));
  assert.ok(embed.description.includes('💡 Use `.stats` for detailed hero statistics.'));
  assert.equal(embed.description.includes('Equipment'), false);
  assert.equal(embed.description.includes('Hero Attributes'), false);
});

test('Hero Stats Embed: Attack displays the combat attack stat, not the attack attribute level', async () => {
  const bot = await createDiscordBotInstance();
  const player = await bot.gameService.getPlayer('usr_stats_attack_display');
  const profile = await bot.gameService.getProfile(player.id);
  const embed = createStatsEmbed(profile, profile.equipment, profile.attributes, {}, bot.gameService.engine.content, player);
  const combatField = embed.fields.find(field => field.name === '⚔ Combat');

  assert.ok(combatField.value.includes('⚔ ATK: 12'));
  assert.ok(!/⚔ ATK: 1(?:\D|$)/.test(combatField.value));
});

test('Hero Profile Embed: Reuses the active buff system', async () => {
  const bot = await createDiscordBotInstance();
  const userId = 'usr_profile_buff_test';
  const player = await bot.gameService.getPlayer(userId);
  player.activeBuffs = {
    haste: {
      potionType: 'haste',
      stat: 'haste',
      amount: 50,
      durationMs: 300000,
      expiresAt: Date.now() + 300000,
      effectLabel: '+50% mining speed for 5 minutes',
      sourcePotionId: 'huge_haste_potion'
    }
  };
  await bot.gameService.savePlayer(player);

  const result = await bot.handleTextMessage('.profile', { id: userId, username: 'BuffHero' });
  assert.ok(result.embed.description.includes('✨ Active Buffs'));
  assert.ok(result.embed.description.includes('Huge Haste Potion'));
  assert.ok(result.embed.description.includes('+50% mining speed for 5 minutes'));
  assert.equal(result.embed.description.includes('Active Buffs\nNone'), false);
});

test('Health bar renderer utility test', () => {
  assert.equal(renderHealthBar(100, 100), '🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
  assert.equal(renderHealthBar(50, 100), '🟩🟩🟩🟩🟩⬛⬛⬛⬛⬛');
  assert.equal(renderHealthBar(0, 100), '⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
});
