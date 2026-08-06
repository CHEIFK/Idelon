import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance, ACTIVITIES } from '../src/index.js';
import { getXpForLevel } from '../src/engine/progression.js';

test('GameService high-level public API orchestration pipeline', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_svc_1';

  // 1. Start Session / Login
  const startRes = await game.start(playerId, 'ServiceHero');
  assert.equal(startRes.success, true);
  assert.equal(startRes.profile.name, 'ServiceHero');

  // 2. Profile Inspection
  const profile = await game.getProfile(playerId);
  assert.equal(profile.name, 'ServiceHero');
  assert.equal(profile.currentAreaId, 'starter_village');

  // 3. Mining & Claiming
  const mineRes = await game.mine(playerId, 'mine_copper');
  assert.ok(mineRes);

  const claimRes = await game.claimActivity(playerId);
  assert.ok(claimRes);

  // 4. Talk to NPC
  const talkRes = await game.talkToNpc(playerId, 'guide');
  assert.equal(talkRes.npc.id, 'guide');

  // 5. Fight Enemy
  const fightRes = await game.fight(playerId, 'goblin');
  assert.equal(fightRes.success, true);
  assert.equal(fightRes.victory, true);

  // 6. Travel
  const traveler = await game.getPlayer(playerId);
  traveler.heroXp = getXpForLevel(40);
  await game.savePlayer(traveler);
  const travelRes = await game.travel(playerId, 'iron_mines');
  assert.equal(travelRes.success, true);

  // 7. Getters verification
  const inventory = await game.getInventory(playerId);
  assert.ok(typeof inventory === 'object');

  const equipment = await game.getEquipment(playerId);
  assert.ok(typeof equipment === 'object');

  const skills = await game.getSkills(playerId);
  assert.ok(typeof skills === 'object');
});
