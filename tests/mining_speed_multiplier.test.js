import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine/index.js';
import { GameService } from '../src/service/gameService.js';
import { SINGLE_RESOURCE_MINING_SPEED_MULTIPLIER, AUTO_MINING_SPEED_MULTIPLIER, getActivitySpeedMultiplier } from '../src/constants/index.js';
import { createAutoMineStartEmbed } from '../src/discord/embeds.js';

test('Mining Speed Multipliers: Single Source of Truth helper and constants', () => {
  assert.equal(SINGLE_RESOURCE_MINING_SPEED_MULTIPLIER, 3);
  assert.equal(AUTO_MINING_SPEED_MULTIPLIER, 1);

  assert.equal(getActivitySpeedMultiplier({ mode: 'auto' }), 1);
  assert.equal(getActivitySpeedMultiplier({ id: 'mine_copper', skillId: 'mining' }), 3);
  assert.equal(getActivitySpeedMultiplier({ id: 'woodcut_oak', skillId: 'woodcutting' }), 1);
});

test('Mining Speed: Auto Mining uses 1x speed and Single Resource Mining uses 3x speed in actual claim rewards', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);

  // 1. Test Auto Mining (1x speed)
  const autoUser = 'usr_auto_speed';
  await gameService.start(autoUser, 'AutoSpeedHero');
  await gameService.mineAuto(autoUser);

  const autoPlayer = await gameService.getPlayer(autoUser);
  const startTime = Date.now() - 30000; // 30 seconds ago
  autoPlayer.currentActivity.startTime = startTime;
  autoPlayer.currentActivity.lastClaimed = startTime;
  await gameService.savePlayer(autoPlayer);

  const autoClaim = await gameService.claimActivity(autoUser);
  // Auto mining in Starter Village has 2 unlocked ores (Copper & Coal, 2.5s duration each).
  // 30s elapsed / (2.5s * 2) = 6 cycles per ore -> 12 total cycles.
  assert.ok(autoClaim);
  assert.equal(autoClaim.cyclesCompleted, 12, 'Auto mining should yield 12 total cycles at 1x speed over 30s');

  // 2. Test Single Resource Mining (3x speed)
  const singleUser = 'usr_single_speed';
  await gameService.start(singleUser, 'SingleSpeedHero');
  await gameService.mine(singleUser, 'mine_copper');

  const singlePlayer = await gameService.getPlayer(singleUser);
  singlePlayer.currentActivity.startTime = startTime;
  singlePlayer.currentActivity.lastClaimed = startTime;
  await gameService.savePlayer(singlePlayer);

  const singleClaim = await gameService.claimActivity(singleUser);
  // Copper duration is 2.5s. At 3x speed, effective duration is 2.5s / 3 = 0.833s.
  // 30s elapsed / (2.5s / 3) = 36 cycles of Copper!
  assert.ok(singleClaim);
  assert.equal(singleClaim.cyclesCompleted, 36, 'Single resource mining should yield exactly 36 cycles (3x speed) over 30s');
  assert.equal(singleClaim.xpGained, 360, 'XP should reflect 36 cycles (10 XP/cycle * 36 = 360 XP)');
});

test('Mining UX: Auto Mining start embed matches new Tip and removes footer', async () => {
  const engine = new Engine();
  await engine.init();

  const mockResult = {
    activities: [
      { id: 'mine_copper', lootTableId: 'mining_copper_loot' },
      { id: 'mine_coal', lootTableId: 'mining_coal_loot' }
    ]
  };

  const embed = createAutoMineStartEmbed(mockResult, engine.content);
  assert.equal(embed.title, '⛏️ Auto Mining Started');
  assert.ok(embed.description.includes('Mining:'));

  const tipField = embed.fields.find(f => f.name === '💡 Tip:');
  assert.ok(tipField, 'Should contain 💡 Tip: field');
  assert.ok(tipField.value.includes('3× faster'));
  assert.equal(embed.footer, undefined, 'Footer line with Mining X resource(s) must be removed');
});
