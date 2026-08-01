import test from 'node:test';
import assert from 'node:assert/strict';
import { getHeroLevel, getXpForLevel, getXpRemaining, DEFAULT_HERO_XP_TABLE } from '../src/engine/progression.js';
import { createGameInstance } from '../src/index.js';
import { migratePlayerSave } from '../migrations/index.js';

test('Hero Level lookup (getHeroLevel)', () => {
  assert.equal(getHeroLevel(0), 1);
  assert.equal(getHeroLevel(50), 1);
  assert.equal(getHeroLevel(100), 2);
  assert.equal(getHeroLevel(299), 2);
  assert.equal(getHeroLevel(300), 3);
  assert.equal(getHeroLevel(650), 4);
  assert.equal(getHeroLevel(1100), 5);
  assert.equal(getHeroLevel(495100), 100);
  assert.equal(getHeroLevel(9999999), 100, 'Exceeding max XP stays at max level 100');
});

test('Cumulative XP required for level (getXpForLevel)', () => {
  assert.equal(getXpForLevel(1), 0);
  assert.equal(getXpForLevel(2), 100);
  assert.equal(getXpForLevel(3), 300);
  assert.equal(getXpForLevel(4), 650);
  assert.equal(getXpForLevel(5), 1100);
  assert.equal(getXpForLevel(100), 495100);
});

test('XP remaining until next level (getXpRemaining)', () => {
  assert.equal(getXpRemaining(0), 100);       // Level 1 (0 XP) -> Level 2 (100 XP) = 100
  assert.equal(getXpRemaining(50), 50);       // Level 1 (50 XP) -> Level 2 (100 XP) = 50
  assert.equal(getXpRemaining(100), 200);     // Level 2 (100 XP) -> Level 3 (300 XP) = 200
  assert.equal(getXpRemaining(250), 50);      // Level 2 (250 XP) -> Level 3 (300 XP) = 50
  assert.equal(getXpRemaining(495100), 0);    // Max level 100 -> 0 remaining
  assert.equal(getXpRemaining(1000000), 0);   // Beyond max level -> 0 remaining
});

test('Boundary transitions between levels', () => {
  // Level 1 -> Level 2 boundary
  assert.equal(getHeroLevel(99), 1);
  assert.equal(getHeroLevel(100), 2);

  // Level 2 -> Level 3 boundary
  assert.equal(getHeroLevel(299), 2);
  assert.equal(getHeroLevel(300), 3);

  // Level 3 -> Level 4 boundary
  assert.equal(getHeroLevel(649), 3);
  assert.equal(getHeroLevel(650), 4);

  // Level 4 -> Level 5 boundary
  assert.equal(getHeroLevel(1099), 4);
  assert.equal(getHeroLevel(1100), 5);
});

test('Maximum defined level (Level 100)', () => {
  const maxEntry = DEFAULT_HERO_XP_TABLE[DEFAULT_HERO_XP_TABLE.length - 1];
  assert.equal(maxEntry.level, 100);
  assert.equal(getHeroLevel(maxEntry.requiredXp), 100);
  assert.equal(getHeroLevel(maxEntry.requiredXp + 50000), 100);
  assert.equal(getXpRemaining(maxEntry.requiredXp), 0);
});

test('Existing save compatibility & Hero Level recalculation from data table', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_legacy_table_1';

  // Save payload with 650 heroXp (Level 4 on table)
  const legacySave = {
    id: playerId,
    name: 'TableHero',
    level: 1,
    heroXp: 650,
    skills: { mining: { xp: 650, level: 3 } },
    currencies: { gold: 50, sterlings: 10 },
    schemaVersion: 5
  };

  const migrated = migratePlayerSave(legacySave);
  assert.equal(migrated.heroXp, 650);
  assert.equal(migrated.level, 4, 'Hero level should be recalculated to 4 from data table for 650 heroXp');

  // Load through GameService to verify in-memory behavior
  await game.engine.database.set('players', playerId, legacySave);
  const loadedPlayer = await game.getPlayer(playerId);

  assert.equal(loadedPlayer.heroXp, 650);
  assert.equal(loadedPlayer.level, 4);
});
