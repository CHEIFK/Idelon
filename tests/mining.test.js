import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, ACTIVITIES, EVENTS } from '../src/index.js';

test('Mining activity lifecycle with offline progression and content loader integration', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_mining_1', 'MinerHero');

  const eventsRecorded = [];
  engine.events.on(EVENTS.ACTIVITY_STARTED, (data) => eventsRecorded.push({ type: EVENTS.ACTIVITY_STARTED, data }));
  engine.events.on(EVENTS.ITEM_ADDED, (data) => eventsRecorded.push({ type: EVENTS.ITEM_ADDED, data }));
  engine.events.on(EVENTS.XP_GAINED, (data) => eventsRecorded.push({ type: EVENTS.XP_GAINED, data }));
  engine.events.on(EVENTS.ACTIVITY_COMPLETED, (data) => eventsRecorded.push({ type: EVENTS.ACTIVITY_COMPLETED, data }));

  // 1. Start Mining (uses content loader definition for 'mine_iron')
  const startResult = engine.activities.start(player, ACTIVITIES.MINING_IRON);
  assert.ok(startResult, 'Mining activity started');
  assert.equal(player.currentActivity.id, ACTIVITIES.MINING_IRON);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.ACTIVITY_STARTED), true);

  // 2. Simulate offline time for 3 cycles (3 cycles of durationMs / 3 at 3x speed)
  const durationMs = engine.content.getActivity(ACTIVITIES.MINING_IRON).durationMs;
  player.currentActivity.lastClaimed -= ((durationMs / 3) * 3 + 100);

  // 3. Claim rewards
  const claimResult = engine.activities.claim(player);

  assert.equal(claimResult.cyclesCompleted, 3);
  assert.equal(claimResult.xpGained, 45); // 15 XP per cycle * 3
  assert.ok(engine.inventory.hasItem(player, 'iron_ore', 3));
  assert.equal(engine.economy.getCurrencies(player).gold, 3);

  // 4. Verify events emitted
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.ITEM_ADDED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.XP_GAINED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.ACTIVITY_COMPLETED), true);
});

test('Gathering system reuse: Woodcutting uses same underlying gathering mechanics', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_lumberjack', 'LumberJack');

  const startRes = engine.activities.start(player, ACTIVITIES.WOODCUTTING_OAK);
  assert.ok(startRes);

  // Simulate 6 seconds (2 cycles)
  player.currentActivity.lastClaimed -= 6500;

  const claimRes = engine.activities.claim(player);
  assert.equal(claimRes.cyclesCompleted, 2);
  assert.equal(claimRes.xpGained, 20); // 10 XP * 2
  assert.ok(engine.inventory.hasItem(player, 'wood_log', 2));
});

test('Level requirement check prevents starting high level activity', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_novice', 'Novice');

  // Inject a high level activity definition into content loader for woodcutting
  engine.content.categories.activities.set('woodcut_yew', {
    id: 'woodcut_yew',
    name: 'Chop Yew Tree',
    skillId: 'woodcutting',
    levelReq: 50,
    durationMs: 5000,
    lootTableId: 'woodcut_oak_loot'
  });

  const res = engine.activities.start(player, 'woodcut_yew');
  assert.equal(res, null);
});
