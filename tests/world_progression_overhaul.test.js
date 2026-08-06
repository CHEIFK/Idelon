import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/index.js';
import { GameService } from '../src/service/gameService.js';
import { commandRegistry } from '../src/discord/commands/index.js';
import { getEnemiesForVisitedAreas, isMiningActivityUnlocked } from '../src/utils/sectorMap.js';

test('1. No Ores in Monster Loot: Loot tables contain zero ores', async () => {
  const engine = await createEngine();
  const content = engine.content;
  const oreIds = ['copper_ore', 'coal', 'lead_ore', 'sand', 'iron_ore', 'silver_ore', 'gold_ore', 'titanium_ore', 'mithril_ore'];

  const allEnemies = content.getAll('enemies') || [];
  for (const enemy of allEnemies) {
    if (!enemy.lootTableId) continue;
    const lootTable = content.getLootTable(enemy.lootTableId);
    if (!lootTable || !Array.isArray(lootTable.entries)) continue;

    for (const entry of lootTable.entries) {
      assert.ok(
        !oreIds.includes(entry.itemId),
        `Enemy '${enemy.id}' loot table '${enemy.lootTableId}' must not drop ore '${entry.itemId}'`
      );
    }
  }
});

test('2. Current Location Restriction: Auto Mining & Hunting pools strictly respect current location', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_loc_restrict', username: 'LocationExplorer' };
  await gameService.start(user.id, user.username);

  // Boost level to allow travel to lead_quarry (Sector 2)
  const player = await gameService.getPlayer(user.id);
  player.heroXp = 5000;
  player.level = 5;
  await gameService.savePlayer(player);

  // 1. Located in Starter Village (Sector 1)
  const starterEnemies = getEnemiesForVisitedAreas(player, engine.content);
  assert.ok(starterEnemies.length > 0);
  assert.ok(!starterEnemies.includes('slime_green'), 'Slime green from Sector 2 should not be available in Sector 1');

  // 2. Travel to Lead Quarry (Sector 2)
  await gameService.travel(user.id, 'lead_quarry');
  const playerInQuarry = await gameService.getPlayer(user.id);
  assert.equal(playerInQuarry.currentAreaId, 'lead_quarry');

  const quarryEnemies = getEnemiesForVisitedAreas(playerInQuarry, engine.content);
  assert.ok(quarryEnemies.includes('slime_green'), 'Slime green from Sector 2 should be available when located in Sector 2');

  // 3. Travel back to Starter Village (Sector 1)
  await gameService.travel(user.id, 'starter_village');
  const playerBackInVillage = await gameService.getPlayer(user.id);
  assert.equal(playerBackInVillage.currentAreaId, 'starter_village');

  const backEnemies = getEnemiesForVisitedAreas(playerBackInVillage, engine.content);
  assert.ok(!backEnemies.includes('slime_green'), 'Slime green should immediately be restricted when traveling back to Sector 1');
});

test('3. Dynamic Difficulty Guidance: Defeat embed includes recommended safe sector', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_defeat_guidance', username: 'DefeatedExplorer' };
  await gameService.start(user.id, user.username);

  // Travel to Sector 7 (Tungsten Core) and fight Dark Knight at Level 1 to trigger defeat
  const player = await gameService.getPlayer(user.id);
  player.heroXp = 43600; // Hero level 30 unlocks Tungsten Core
  player.level = 30;
  player.visitedAreas.push('lead_quarry', 'sand_dunes', 'tungsten_core');
  player.currentAreaId = 'tungsten_core';
  player.hp = 1;
  await gameService.savePlayer(player);

  const res = await gameService.huntInstant(user.id, 'dark_knight');
  assert.equal(res.playerDied, true);
  assert.ok(res.recommendedSector, 'Should include recommendedSector object on defeat');
  assert.ok(res.recommendedSector.areaId, 'Recommended sector should have valid areaId');
});

test('4. .stats Command: Renders hero stats embed with durability and bonuses', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_stats_test', username: 'StatMaster' };
  await gameService.start(user.id, user.username);

  const res = await commandRegistry.handleTextMessage('.stats', user, gameService);
  assert.ok(res && res.embed, 'Should return stats embed');
  assert.equal(res.embed.title, '👤 Hero Stats');

  const fields = res.embed.fields || [];
  assert.ok(res.embed.description.includes('⭐ Hero Lv.'), 'Should include compact progression summary');
  assert.ok(res.embed.description.includes('📍'), 'Should include current location');
  assert.ok(res.embed.description.includes('🗺 Highest:'), 'Should include highest explored sector');
  assert.ok(fields.some(f => f.name === '⚔ Combat'), 'Should include combat field');
  assert.ok(fields.some(f => f.name === '🛡 Equipment'), 'Should include equipment field');
  assert.ok(fields.some(f => f.name === '📜 Skills'), 'Should include skills field');
  assert.equal(fields.some(f => f.name.includes('Active Mining')), false);
  assert.equal(fields.some(f => f.name.includes('Active Hunting')), false);
  assert.ok(fields.some(f => f.name.includes('Skills')), 'Should include Skills field');
});
