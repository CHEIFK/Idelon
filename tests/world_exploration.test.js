import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance } from '../src/index.js';
import { 
  getGatheringQuantityMultiplier, 
  getResourceIntroSectorIndex, 
  clearSectorResourceCache,
  SECTORS_REGISTRY 
} from '../src/utils/sectorMap.js';
import { migratePlayerSave } from '../migrations/index.js';
import { createAreasEmbed, createNothingToClaimEmbed, createSellInfoEmbed } from '../src/discord/embeds.js';

test('1. Mining Sector Unlock Bug Fix - Hero Level 2 unlocks Sector 02, NOT Sector 10', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_sector_unlock_test';
  await game.start(playerId, 'UnlockTester');

  // Trigger level up to level 2 in mining
  const rewards = game._computeLevelUpRewards({ skills: { mining: { level: 2 } } }, 'mining', 1);
  assert.equal(rewards.length, 1);
  const lu = rewards[0];
  
  // Unlocked areas should include lead_quarry (Sector 2) but NOT misty_mountains (Sector 10)
  assert.ok(lu.unlockedAreaIds.includes('lead_quarry'), 'Unlocks Lead Quarry (Sector 02)');
  assert.ok(!lu.unlockedAreaIds.includes('misty_mountains'), 'Does NOT unlock Misty Mountains (Sector 10)');
});

test('2. Visited Areas & Migration Support', async () => {
  const game = await createGameInstance();
  const player = game.engine.player.create('usr_new_vis', 'NewExplorer');
  assert.deepEqual(player.visitedAreas, ['starter_village']);

  // Legacy save migration test
  const legacySave = { id: 'usr_legacy', name: 'Legacy', level: 1, schemaVersion: 0 };
  const migrated = migratePlayerSave(legacySave);
  assert.deepEqual(migrated.visitedAreas, ['starter_village']);
});

test('3. First-Time Exploration Tracking & No Duplicates', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_travel_vis_test';
  await game.start(playerId, 'Traveler');

  // Level up player to 2 so lead_quarry travel is valid
  const playerToLevel = await game.getPlayer(playerId);
  playerToLevel.heroXp = 100; // Hero level 2 threshold
  playerToLevel.level = 2;
  await game.savePlayer(playerToLevel);

  // Travel to Sector 2
  const res1 = await game.travel(playerId, 'lead_quarry');
  assert.equal(res1.success, true);
  
  let player = await game.getPlayer(playerId);
  assert.deepEqual(player.visitedAreas, ['starter_village', 'lead_quarry']);

  // Re-visit Sector 2
  const res2 = await game.travel(playerId, 'lead_quarry');
  assert.equal(res2.success, true);

  player = await game.getPlayer(playerId);
  assert.deepEqual(player.visitedAreas, ['starter_village', 'lead_quarry']); // No duplicate
});

test('4. Four-State Areas Embed Rendering', async () => {
  const game = await createGameInstance();
  const player = {
    currentAreaId: 'lead_quarry',
    visitedAreas: ['starter_village', 'lead_quarry'],
    level: 5,
    quests: {}
  };
  const allAreas = game.engine.content.getAll('areas');
  const availableAreas = game.engine.world.getAvailable(player);

  const embed = createAreasEmbed(player, allAreas, availableAreas, game.engine.content);
  assert.ok(embed.description.includes('📍 **🪨 Sector 02 — Lead Quarry** *(Current Location)*'));
  assert.ok(embed.description.includes('✅ **🏡 Starter Village** *(Explored)*'));
  assert.ok(embed.description.includes('🟢 **🏜️ Sector 03 — Sand Dunes** *(Unlocked)*'));
  assert.ok(embed.description.includes('🔒 **✨ Sector 15 — Celestial Sanctuary**'));
});

test('5. World Exploration & Location Yield Multipliers', async () => {
  const game = await createGameInstance();
  const content = game.engine.content;

  // Player explored up to Sector 4 (Titanium Caverns)
  const player = {
    currentAreaId: 'titanium_caverns',
    visitedAreas: ['starter_village', 'lead_quarry', 'sand_dunes', 'titanium_caverns']
  };

  // Copper ore intro is Sector 1 (index 0). Highest explored is Sector 4 (index 3).
  // New sectors explored after intro = 3 - 0 = 3. Permanent bonus = 1 + 3 * 0.5 = 2.5x.
  const copperMultInNewest = getGatheringQuantityMultiplier(player, 'copper_ore', content);
  assert.equal(copperMultInNewest, 2.5); // Highest explored sector does NOT receive x2 location mult

  // Travel back to older explored sector: Lead Quarry (Sector 2, index 1 < 3)
  player.currentAreaId = 'lead_quarry';
  // Copper & Lead are native to Lead Quarry area resources.
  // Permanent bonus for Lead (intro index 1): highest (3) - intro (1) = 2 -> 1 + 2 * 0.5 = 2.0x.
  // Location mult = 2.0x (older sector & native).
  // Total mult for lead_ore = 2.0 * 2.0 = 4.0x.
  const leadMultInOlder = getGatheringQuantityMultiplier(player, 'lead_ore', content);
  assert.equal(leadMultInOlder, 4.0);
});

test('6. Cache Parity & Cache Invalidation', async () => {
  const game = await createGameInstance();
  const content = game.engine.content;

  clearSectorResourceCache();
  const idxCached = getResourceIntroSectorIndex('copper_ore', content);
  assert.equal(idxCached, 0);

  // Second call uses cache
  const idxCached2 = getResourceIntroSectorIndex('copper_ore', content);
  assert.equal(idxCached2, 0);

  clearSectorResourceCache();
  const idxAfterClear = getResourceIntroSectorIndex('copper_ore', content);
  assert.equal(idxAfterClear, 0);
});

test('7. Economy Safety - Multipliers ONLY alter gathered quantity, NOT XP, Gold or Sell Prices', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_econ_safety';
  await game.start(playerId, 'SafetyHero');

  const player = await game.getPlayer(playerId);
  player.visitedAreas = ['starter_village', 'lead_quarry', 'sand_dunes', 'titanium_caverns'];
  player.currentAreaId = 'lead_quarry';
  await game.savePlayer(player);

  // Copper item sell value must remain un-multiplied
  const copperDef = game.engine.content.getItem('copper_ore');
  assert.equal(copperDef.sellValue ?? copperDef.value, 0.5);

  // Claim single activity and check XP & currency rewards
  game.engine.activities.start(player, 'mine_copper');
  player.currentActivity.lastClaimed -= 10000; // 4 cycles
  await game.savePlayer(player);

  const claimRes = await game.claimActivity(playerId);
  assert.equal(claimRes.xpGained, 40); // 10 XP * 4 cycles (NO multiplier on XP)
});

test('8. UX - .claim without active activity displays guidance embed', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_claim_ux';
  await game.start(playerId, 'ClaimUX');

  const claimRes = await game.claimActivity(playerId);
  assert.equal(claimRes, null);

  const guidanceEmbed = createNothingToClaimEmbed();
  assert.equal(guidanceEmbed.title, 'Nothing to Claim');
  assert.ok(guidanceEmbed.description.includes('You don\'t have an active gathering activity.'));
});

test('9. UX - .sell without arguments & quantity error handling', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_sell_ux';
  await game.start(playerId, 'SellUX');

  const player = await game.getPlayer(playerId);
  game.engine.inventory.addItem(player, 'copper_ore', 13);
  await game.savePlayer(player);

  const sellInfoEmbed = createSellInfoEmbed(player.inventory, game.engine.content);
  assert.equal(sellInfoEmbed.title, 'Sell Items');
  assert.ok(sellInfoEmbed.fields[0].value.includes('Copper Ore'));
  assert.ok(sellInfoEmbed.fields[0].value.includes('13'));

  // Requesting 20 when owning 13 cancels sale completely
  const sellRes = await game.sellItem(playerId, 'copper', 20);
  assert.equal(sellRes.success, false);
  assert.equal(sellRes.message, 'You only own 13 Copper Ore.');

  const checkPlayer = await game.getPlayer(playerId);
  assert.equal(checkPlayer.inventory['copper_ore'], 13); // 0 items sold!
});
