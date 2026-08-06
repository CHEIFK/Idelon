import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance } from '../src/index.js';

test('Auto-mine (.mine) gathers resources satisfying Sector progression (visitedAreas)', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_auto_miner_sector_test';
  await game.start(playerId, 'SectorAutoMiner');

  // Set hero level to 5 so travel is permitted to lead_quarry, sand_dunes, titanium_caverns
  const player = await game.getPlayer(playerId);
  player.heroXp = 1100; // Hero level 5 threshold
  player.skills.mining = { level: 5, xp: 1100 }; // Resource skill gates remain independent
  await game.savePlayer(player);

  // 1. In Starter Village -> Copper, Coal
  const resStarter = await game.mineAuto(playerId);
  const starterIds = resStarter.activities.map(a => a.id);
  assert.ok(starterIds.includes('mine_copper'), 'Starter Village includes Copper');
  assert.ok(starterIds.includes('mine_coal'), 'Starter Village includes Coal');
  assert.ok(!starterIds.includes('mine_lead'), 'Starter Village does NOT include Lead');
  assert.ok(!starterIds.includes('mine_titanium'), 'Starter Village does NOT include Titanium');

  // 2. Travel to Lead Quarry -> Copper, Coal, Lead
  await game.travel(playerId, 'lead_quarry');

  const resLead = await game.mineAuto(playerId);
  const leadIds = resLead.activities.map(a => a.id);
  assert.ok(leadIds.includes('mine_copper'), 'Lead Quarry includes Copper');
  assert.ok(leadIds.includes('mine_coal'), 'Lead Quarry includes Coal');
  assert.ok(leadIds.includes('mine_lead'), 'Lead Quarry includes Lead');
  assert.ok(!leadIds.includes('mine_titanium'), 'Lead Quarry does NOT include Titanium');

  // 3. Reach Hero Level 10 and travel to Sand Dunes -> Sand becomes available.
  const playerAtSand = await game.getPlayer(playerId);
  playerAtSand.heroXp = 4600; // Hero level 10 threshold
  await game.savePlayer(playerAtSand);
  await game.travel(playerId, 'sand_dunes');

  // 4. Reach Hero Level 15 and travel to Titanium Caverns.
  const playerAtTitanium = await game.getPlayer(playerId);
  playerAtTitanium.heroXp = 10600; // Hero level 15 threshold
  await game.savePlayer(playerAtTitanium);
  await game.travel(playerId, 'titanium_caverns');

  const resTitanium = await game.mineAuto(playerId);
  const titaniumIds = resTitanium.activities.map(a => a.id);
  assert.ok(titaniumIds.includes('mine_copper'), 'Titanium Caverns includes Copper');
  assert.ok(titaniumIds.includes('mine_coal'), 'Titanium Caverns includes Coal');
  assert.ok(titaniumIds.includes('mine_lead'), 'Titanium Caverns includes Lead');
  assert.ok(titaniumIds.includes('mine_sand'), 'Titanium Caverns includes Sand');
  assert.ok(titaniumIds.includes('mine_titanium'), 'Titanium Caverns includes Titanium');
  assert.ok(!titaniumIds.includes('mine_beryllium'), 'Titanium Caverns does NOT include Beryllium');
});
