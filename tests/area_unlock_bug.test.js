import test from 'node:test';
import assert from 'node:assert';
import { createEngine } from '../src/index.js';
import { GameService } from '../src/service/gameService.js';
import { commandRegistry } from '../src/discord/commands/index.js';

test('1. Future Sectors Remain Locked: Hero Level 5 unlocks only Sector 02', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_unlock_test', username: 'UnlockExplorer' };
  await gameService.start(user.id, user.username);

  const player = await gameService.getPlayer(user.id);
  player.skills = player.skills || {};
  player.skills.mining = { level: 5, xp: 600 };
  player.heroXp = 1100;
  player.level = 5; // Hero Level 5
  await gameService.savePlayer(player);

  const freshPlayer = await gameService.getPlayer(user.id);
  const available = engine.world.getAvailable(freshPlayer);
  const availableIds = available.map(a => a.id);

  // Hero Level 5 unlocks Starter Village and Lead Quarry only.
  assert.ok(availableIds.includes('starter_village'), 'Starter village should be available');
  assert.ok(availableIds.includes('lead_quarry'), 'Lead quarry (Sector 2) should be available');
  assert.ok(!availableIds.includes('sand_dunes'), 'Sand dunes (Sector 3, Hero Level 10) must be locked');
  assert.ok(!availableIds.includes('titanium_caverns'), 'Titanium caverns (Sector 4, Hero Level 15) must be locked');
  assert.ok(!availableIds.includes('iron_mines'), 'Iron mines (Sector 9, Hero Level 40) must be locked');

  // Future / unearned sectors MUST be locked
  assert.ok(!availableIds.includes('beryllium_caves'), 'Sector 5 (Beryllium Caves, Hero Level 20) MUST be locked');
  assert.ok(!availableIds.includes('thorium_depths'), 'Sector 6 (Thorium Depths, Hero Level 25) MUST be locked');
  assert.ok(!availableIds.includes('tungsten_core'), 'Sector 7 (Tungsten Core, Hero Level 30) MUST be locked');
  assert.ok(!availableIds.includes('misty_mountains'), 'Sector 10 (Misty Mountains, Hero Level 45) MUST be locked');
  assert.ok(!availableIds.includes('celestial_sanctuary'), 'Sector 15 (Celestial Sanctuary, Hero Level 70) MUST be locked');

  // Check .areas embed rendering
  const res = await commandRegistry.handleTextMessage('.areas', user, gameService);
  assert.ok(res && res.embed, 'Should return areas embed');
  const desc = res.embed.description;

  assert.ok(desc.includes('📍'), 'Embed should include 📍 Current icon');
  assert.ok(desc.includes('🔒'), 'Embed should include 🔒 Locked icon for future sectors');
  assert.ok(desc.includes('🔒') && desc.includes('Beryllium Caves'), 'Sector 5 should be locked in embed');
  assert.ok(desc.includes('🔒') && desc.includes('Celestial Sanctuary'), 'Sector 15 should be locked in embed');
});

test('2. Unlocked Sectors Persist in player.unlockedAreas: Single source of truth', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_persist_test', username: 'PersistTester' };
  await gameService.start(user.id, user.username);

  const player = await gameService.getPlayer(user.id);
  assert.ok(Array.isArray(player.unlockedAreas), 'player.unlockedAreas must be an array');
  assert.ok(player.unlockedAreas.includes('starter_village'), 'starter_village should be in player.unlockedAreas');

  // Trigger skill level up
  player.skills.mining = { level: 3, xp: 2000 };
  await gameService.savePlayer(player);

  const reloaded = await gameService.getPlayer(user.id);
  assert.ok(reloaded.unlockedAreas.includes('lead_quarry'), 'lead_quarry should be persisted in unlockedAreas');
  assert.ok(!reloaded.unlockedAreas.includes('sand_dunes'), 'sand_dunes should remain locked below Hero Level 10');
  assert.ok(!reloaded.unlockedAreas.includes('tungsten_core'), 'tungsten_core must NOT be in unlockedAreas');
});
