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

  // 3. Travel to Titanium Caverns -> Copper, Coal, Lead, Sand, Titanium
  await game.travel(playerId, 'sand_dunes');
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
