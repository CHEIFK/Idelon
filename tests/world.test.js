import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, EVENTS } from '../src/index.js';

test('NPC dialogue, Area travel, and Quest progression pipeline', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_traveler_1', 'Wanderer');

  const eventsRecorded = [];
  engine.events.on(EVENTS.NPC_TALKED, (d) => eventsRecorded.push({ type: EVENTS.NPC_TALKED, d }));
  engine.events.on(EVENTS.AREA_ENTERED, (d) => eventsRecorded.push({ type: EVENTS.AREA_ENTERED, d }));
  engine.events.on(EVENTS.QUEST_ACCEPTED, (d) => eventsRecorded.push({ type: EVENTS.QUEST_ACCEPTED, d }));
  engine.events.on(EVENTS.QUEST_PROGRESS, (d) => eventsRecorded.push({ type: EVENTS.QUEST_PROGRESS, d }));
  engine.events.on(EVENTS.QUEST_COMPLETED, (d) => eventsRecorded.push({ type: EVENTS.QUEST_COMPLETED, d }));

  // 1. Talk to NPC (Elder Guide)
  const talkRes = engine.world.npc.talk(player, 'guide');
  assert.equal(talkRes.npc.id, 'guide');
  assert.equal(talkRes.questsProvided.includes('first_steps'), true);

  // 2. Check Available Areas & Attempt locked area travel
  let availableAreas = engine.world.getAvailable(player);
  assert.equal(availableAreas.length, 1);
  assert.equal(availableAreas[0].id, 'starter_village');

  const lockedTravelRes = engine.world.travel(player, 'iron_mines');
  assert.equal(lockedTravelRes.success, false);
  assert.equal(lockedTravelRes.reason, 'area_locked');

  // Travel to Starter Village
  const travelRes = engine.world.travel(player, 'starter_village');
  assert.equal(travelRes.success, true);
  assert.equal(player.currentAreaId, 'starter_village');

  // 3. Accept Quest: First Steps (gather 3 iron_ore)
  const acceptRes = engine.quests.accept(player, 'first_steps');
  assert.equal(acceptRes.success, true);
  assert.equal(player.quests['first_steps'].status, 'active');

  // 4. Update Quest Progress by adding items
  engine.inventory.addItem(player, 'iron_ore', 3);
  engine.quests.update(player, EVENTS.ITEM_ADDED, { playerId: player.id, itemId: 'iron_ore', amount: 3 });

  assert.equal(player.quests['first_steps'].progress, 3);

  // 5. Complete Quest
  const completeRes = engine.quests.complete(player, 'first_steps');
  assert.equal(completeRes.success, true);
  assert.equal(player.quests['first_steps'].status, 'completed');
  assert.equal(engine.skills.getXP(player, 'mining'), 50);

  // 6. Verify Iron Mines unlocked & Travel now succeeds!
  availableAreas = engine.world.getAvailable(player);
  assert.equal(availableAreas.length, 2);

  const mineTravelRes = engine.world.travel(player, 'iron_mines');
  assert.equal(mineTravelRes.success, true);
  assert.equal(player.currentAreaId, 'iron_mines');

  // Verify events logged
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.NPC_TALKED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.AREA_ENTERED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.QUEST_ACCEPTED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.QUEST_PROGRESS), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.QUEST_COMPLETED), true);
});

test('Quest enemy defeat objective tracking', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_traveler_2', 'Slayer');

  // Accept Slay Goblins quest
  engine.quests.accept(player, 'slay_goblins');
  assert.equal(player.quests['slay_goblins'].progress, 0);

  // Simulate defeating 2 goblins
  engine.quests.update(player, EVENTS.COMBAT_VICTORY, { playerId: player.id, enemyId: 'goblin' });
  engine.quests.update(player, EVENTS.COMBAT_VICTORY, { playerId: player.id, enemyId: 'goblin' });

  assert.equal(player.quests['slay_goblins'].progress, 2);

  const compRes = engine.quests.complete(player, 'slay_goblins');
  assert.equal(compRes.success, true);
  assert.equal(engine.skills.getXP(player, 'combat'), 100);
});
