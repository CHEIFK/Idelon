import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance } from '../src/index.js';
import { createTravelSuccessEmbed } from '../src/discord/embeds.js';

test('Auto Mining automatically includes newly unlocked resources after travelling to a newly unlocked sector', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_auto_unlock_test';
  await game.start(playerId, 'AutoUnlockHero');

  let player = await game.getPlayer(playerId);
  player.heroXp = 1100; // Hero level 5 threshold
  player.level = 5;
  player.skills.mining = { level: 5, xp: 1100 }; // Resource skill gates remain independent
  await game.savePlayer(player);

  // 1. Start Auto Mining in Starter Village
  const startRes = await game.mineAuto(playerId);
  assert.equal(startRes.success, true);

  player = await game.getPlayer(playerId);
  const initialActivity = { ...player.currentActivity };
  assert.ok(initialActivity.ids.includes('mine_copper'));
  assert.ok(initialActivity.ids.includes('mine_coal'));
  assert.equal(initialActivity.ids.includes('mine_lead'), false);

  const originalStartTime = initialActivity.startTime;
  const originalLastClaimed = initialActivity.lastClaimed;

  // Wait a moment to ensure timestamp wouldn't naturally be equal if reset
  await new Promise(r => setTimeout(r, 10));

  // 2. Travel to Lead Quarry (Sector 02)
  const travelRes = await game.travel(playerId, 'lead_quarry');
  assert.equal(travelRes.success, true);

  // 3. Verify Auto Mining session automatically includes Lead Ore
  player = await game.getPlayer(playerId);
  const updatedActivity = player.currentActivity;
  assert.ok(updatedActivity.ids.includes('mine_copper'));
  assert.ok(updatedActivity.ids.includes('mine_coal'));
  assert.ok(updatedActivity.ids.includes('mine_lead'), 'Lead Ore is automatically added to Auto Mining');

  // 4. Verify existing progress & session timestamps are preserved without reset
  assert.equal(updatedActivity.startTime, originalStartTime, 'startTime is preserved');
  assert.equal(updatedActivity.lastClaimed, originalLastClaimed, 'lastClaimed is preserved');
  assert.equal(updatedActivity.mode, 'auto', 'mode is still auto');

  // 5. Reach Hero Level 10 before travelling to Sand Dunes (Sector 03).
  player = await game.getPlayer(playerId);
  player.heroXp = 4600; // Hero level 10 threshold
  await game.savePlayer(player);
  await game.travel(playerId, 'sand_dunes');
  player = await game.getPlayer(playerId);
  assert.ok(player.currentActivity.ids.includes('mine_sand'), 'Sand is automatically added to Auto Mining');
});

test('Travel embed displays newly available resources and guidance tips', async () => {
  const game = await createGameInstance();
  const content = game.engine.content;

  // Test 1: Travel to Lead Quarry
  const embedLead = createTravelSuccessEmbed(null, 'lead_quarry', content);
  assert.equal(embedLead.title, '🗺️ Travel Successful');
  assert.ok(embedLead.description.includes('You have arrived at **🪨 Sector 02 — Lead Quarry**.'));
  assert.ok(embedLead.description.includes('⛏️ **New Resources**'), 'Includes New Resources header');
  assert.ok(embedLead.description.includes('• Lead Ore'), 'Lists Lead Ore');
  assert.ok(embedLead.description.includes('💡 **Tip:**'), 'Includes Tip header');
  assert.ok(embedLead.description.includes('Use `.mine` to automatically mine all unlocked resources.'), 'Shows .mine auto tip');
  assert.ok(embedLead.description.includes('Or use `.mine lead` to focus on Lead at **3× speed**.'), 'Shows .mine lead single resource tip');

  // Test 2: Travel to Sand Dunes
  const embedSand = createTravelSuccessEmbed(null, 'sand_dunes', content);
  assert.ok(embedSand.description.includes('• Sand'));
  assert.ok(embedSand.description.includes('Or use `.mine sand` to focus on Sand at **3× speed**.'));

  // Test 3: Travel to Whispering Woods (no mineable resources)
  const embedWoods = createTravelSuccessEmbed(null, 'whispering_woods', content);
  assert.ok(!embedWoods.description.includes('⛏️ **New Resources**'), 'Omits New Resources section for non-mining areas');
});
