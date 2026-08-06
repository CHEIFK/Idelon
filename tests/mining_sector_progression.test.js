import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance } from '../src/index.js';
import { ContentLoader } from '../src/content/loader.js';
import { COMBAT_XP_MIN, COMBAT_XP_MAX } from '../src/constants/index.js';
import { isMiningActivityUnlocked, getActivityOwningAreaId } from '../src/utils/sectorMap.js';
import { createResourceLockedEmbed } from '../src/discord/embeds.js';

test('1. Explicit areaId Resolution takes precedence', async () => {
  const game = await createGameInstance();
  const content = game.engine.content;

  const explicitAct = { id: 'mine_custom', skillId: 'mining', areaId: 'titanium_caverns' };
  const owningArea = getActivityOwningAreaId(explicitAct, content);
  assert.equal(owningArea, 'titanium_caverns');
});

test('2. Automatic Area Resolution fallback when areaId is omitted', async () => {
  const game = await createGameInstance();
  const content = game.engine.content;

  // mine_lead maps to lead_node which lives in lead_quarry
  const implicitAct = { id: 'mine_lead', skillId: 'mining' };
  const owningArea = getActivityOwningAreaId(implicitAct, content);
  assert.equal(owningArea, 'lead_quarry');
});

test('3. Content Validation Fails for 0 Matching Areas', async () => {
  const loader = new ContentLoader();
  loader.loadAll();
  
  // Inject an unresolvable mining activity without areaId
  loader.categories.activities.set('mine_unresolvable', {
    id: 'mine_unresolvable',
    name: 'Mine Unknown',
    skillId: 'mining'
  });

  assert.throws(() => {
    loader.validate();
  }, (err) => err.message.includes('could not resolve to any owning area'));
});

test('4. Content Validation Fails for Multiple Matching Areas when areaId is omitted', async () => {
  const loader = new ContentLoader();
  loader.loadAll();
  
  // Add another area that also references lead_node
  loader.categories.areas.set('duplicate_lead_area', {
    id: 'duplicate_lead_area',
    name: 'Duplicate Quarry',
    levelReq: 1,
    resourceIds: ['lead_node']
  });

  // Inject a mining activity without areaId that matches multiple areas
  loader.categories.activities.set('mine_lead_ambiguous', {
    id: 'mine_lead_ambiguous',
    name: 'Ambiguous Lead',
    skillId: 'mining'
  });

  assert.throws(() => {
    loader.validate();
  }, (err) => err.message.includes('matched multiple owning areas'));
});

test('5. Sector Exploration Gating for Mining (Lead, Sand, Titanium)', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_area_unlock_test';
  await game.start(playerId, 'AreaExplorer');

  // Starter Village -> Copper, Coal available; Lead locked
  let resAuto = await game.mineAuto(playerId);
  let actIds = resAuto.activities.map(a => a.id);
  assert.ok(actIds.includes('mine_copper'));
  assert.ok(actIds.includes('mine_coal'));
  assert.ok(!actIds.includes('mine_lead'));

  // Travel to Sector 2 (Lead Quarry) -> Lead unlocked!
  const p1 = await game.getPlayer(playerId);
  p1.heroXp = 1100; // Hero level 5
  p1.skills.mining = { level: 2, xp: 200 }; // Lead resource skill requirement
  await game.savePlayer(p1);
  await game.travel(playerId, 'lead_quarry');

  resAuto = await game.mineAuto(playerId);
  actIds = resAuto.activities.map(a => a.id);
  assert.ok(actIds.includes('mine_lead'));
  assert.ok(!actIds.includes('mine_sand'));

  // Travel to Sector 3 (Sand Dunes) -> Sand unlocked!
  const p2 = await game.getPlayer(playerId);
  p2.heroXp = 4600; // Hero level 10
  p2.skills.mining = { level: 3, xp: 300 }; // Sand resource skill requirement
  await game.savePlayer(p2);
  await game.travel(playerId, 'sand_dunes');

  resAuto = await game.mineAuto(playerId);
  actIds = resAuto.activities.map(a => a.id);
  assert.ok(actIds.includes('mine_sand'));
  assert.ok(!actIds.includes('mine_titanium'));

  // Travel to Sector 4 (Titanium Caverns) -> Titanium unlocked!
  const p3 = await game.getPlayer(playerId);
  p3.heroXp = 10600; // Hero level 15 threshold
  p3.skills.mining = { level: 5, xp: 1100 }; // Titanium resource skill requirement
  await game.savePlayer(p3);
  await game.travel(playerId, 'titanium_caverns');

  resAuto = await game.mineAuto(playerId);
  actIds = resAuto.activities.map(a => a.id);
  assert.ok(actIds.includes('mine_titanium'));
});

test('6. Manual Mining (.mine lead) locked guidance embed', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_manual_mine_test';
  await game.start(playerId, 'ManualMiner');

  // Player in Starter Village attempts manual .mine lead
  const res = await game.mine(playerId, 'mine_lead');
  assert.equal(res.success, false);
  assert.equal(res.reason, 'sector_locked');
  assert.equal(res.owningAreaId, 'lead_quarry');

  const lockedEmbed = createResourceLockedEmbed(res.owningAreaId, game.engine.content);
  assert.equal(lockedEmbed.title, 'Resource Locked');
  assert.ok(lockedEmbed.description.includes('Sector 02 — Lead Quarry'));
  assert.ok(lockedEmbed.description.includes('.travel 02'));
});

test('7. Configurable Combat XP - XP generated within COMBAT_XP_MIN and COMBAT_XP_MAX bounds', async () => {
  const game = await createGameInstance();
  const player = game.engine.player.create('usr_xp_bound_test', 'XpTester');

  // Equip strong gear to win fights quickly
  game.engine.inventory.addItem(player, 'iron_sword', 1);
  game.engine.equipment.equip(player, 'iron_sword');

  const xpValues = [];
  for (let i = 0; i < 30; i++) {
    const res = game.engine.combat.start(player, 'goblin');
    if (res.victory) {
      assert.ok(res.xpGained >= COMBAT_XP_MIN, `XP ${res.xpGained} should be >= ${COMBAT_XP_MIN}`);
      assert.ok(res.xpGained <= COMBAT_XP_MAX, `XP ${res.xpGained} should be <= ${COMBAT_XP_MAX}`);
      xpValues.push(res.xpGained);
    }
  }

  // Assert randomness (not all 30 runs produced identical XP)
  const uniqueXP = new Set(xpValues);
  assert.ok(uniqueXP.size > 1, 'Combat XP should have random variance across fights');
});
