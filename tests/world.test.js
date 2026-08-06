import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, EVENTS } from '../src/index.js';
import { GameService } from '../src/service/gameService.js';

test('NPC dialogue and Area travel pipeline', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_traveler_1', 'Wanderer');

  const eventsRecorded = [];
  engine.events.on(EVENTS.NPC_TALKED, (d) => eventsRecorded.push({ type: EVENTS.NPC_TALKED, d }));
  engine.events.on(EVENTS.AREA_ENTERED, (d) => eventsRecorded.push({ type: EVENTS.AREA_ENTERED, d }));

  // 1. Talk to NPC (Elder Guide)
  const talkRes = engine.world.npc.talk(player, 'guide');
  assert.equal(talkRes.npc.id, 'guide');

  // 2. Check Available Areas & Attempt locked area travel
  let availableAreas = engine.world.getAvailable(player);
  assert.ok(availableAreas.some(a => a.id === 'starter_village'));

  const lockedTravelRes = engine.world.travel(player, 'lead_quarry');
  assert.equal(lockedTravelRes.success, false);
  assert.equal(lockedTravelRes.reason, 'area_locked');

  // Travel to Starter Village
  const travelRes = engine.world.travel(player, 'starter_village');
  assert.equal(travelRes.success, true);
  assert.equal(player.currentAreaId, 'starter_village');

  // 3. Reach Hero Level 5 to unlock Lead Quarry
  player.level = 5;
  availableAreas = engine.world.getAvailable(player);
  assert.ok(availableAreas.some(a => a.id === 'lead_quarry'));

  const leadTravelRes = engine.world.travel(player, 'lead_quarry');
  assert.equal(leadTravelRes.success, true);
  assert.equal(player.currentAreaId, 'lead_quarry');

  // Verify events logged
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.NPC_TALKED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.AREA_ENTERED), true);
});

test('NPC dialogue is restricted to the NPC current area', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  await gameService.start('usr_npc_scope', 'Local Hero');

  const blocked = await gameService.talkToNpc('usr_npc_scope', 'high_priest');
  assert.equal(blocked.success, false);
  assert.equal(blocked.reason, 'npc_not_in_area');

  const allowed = await gameService.talkToNpc('usr_npc_scope', 'guide');
  assert.equal(allowed.success, true);
  assert.equal(allowed.npc.id, 'guide');
});
