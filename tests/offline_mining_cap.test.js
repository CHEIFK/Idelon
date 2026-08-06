import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameService } from '../src/service/gameService.js';
import { ContentLoader } from '../src/content/loader.js';
import { GatheringActivity } from '../src/engine/activities/gathering.js';
import { SkillsModule } from '../src/engine/skills.js';
import { InventoryModule } from '../src/engine/inventory.js';
import { EconomyModule } from '../src/engine/economy.js';
import { EngineEventEmitter } from '../src/events/index.js';
import { MAX_OFFLINE_MINING_DURATION_MS, OFFLINE_MINING_CAP_MS } from '../src/constants/index.js';

function createMockEngine() {
  const content = new ContentLoader();
  content.loadAll();
  const events = new EngineEventEmitter();
  const skills = new SkillsModule();
  const inventory = new InventoryModule(events);
  const economy = new EconomyModule(events);
  const gathering = new GatheringActivity();

  const memoryStore = new Map();
  const player = {
    save: async (p) => { memoryStore.set(p.id, JSON.parse(JSON.stringify(p))); return true; },
    load: async (id) => {
      const data = memoryStore.get(id);
      if (!data) return null;
      return JSON.parse(JSON.stringify(data));
    },
    create: (id, name) => ({
      id,
      name,
      level: 1,
      heroXp: 0,
      currentAreaId: 'starter_village',
      visitedAreas: ['starter_village'],
      unlockedAreas: ['starter_village'],
      currentActivity: null,
      inventory: {},
      skills: { mining: { xp: 0, level: 1 } },
      currencies: { gold: 0, sterlings: 0 },
      equipment: {}
    })
  };

  const engine = {
    content,
    events,
    skills,
    inventory,
    economy,
    equipment: { getTotalStats: () => ({}) },
    player,
    activities: gathering
  };
  gathering.setEngine(engine);
  return engine;
}

test('Offline Mining Cap - Constant definitions', () => {
  assert.equal(MAX_OFFLINE_MINING_DURATION_MS, 12 * 60 * 60 * 1000, 'MAX_OFFLINE_MINING_DURATION_MS must be 12 hours (43,200,000 ms)');
  assert.equal(OFFLINE_MINING_CAP_MS, 12 * 60 * 60 * 1000, 'OFFLINE_MINING_CAP_MS must equal 12 hours');
});

test('Offline Mining Cap - Single Resource Mining (1h, 10h, 12h, 13h, 24h, 7d, 1y)', async () => {
  const engine = createMockEngine();
  const gameService = new GameService(engine);

  const ONE_HOUR = 60 * 60 * 1000;
  const TEN_HOURS = 10 * ONE_HOUR;
  const TWELVE_HOURS = 12 * ONE_HOUR;
  const THIRTEEN_HOURS = 13 * ONE_HOUR;
  const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;
  const SEVEN_DAYS = 7 * TWENTY_FOUR_HOURS;
  const ONE_YEAR = 365 * TWENTY_FOUR_HOURS;

  const testDurations = [
    { name: '1 hour offline', duration: ONE_HOUR, expectedCappedMs: ONE_HOUR },
    { name: '10 hours offline', duration: TEN_HOURS, expectedCappedMs: TEN_HOURS },
    { name: '12 hours offline', duration: TWELVE_HOURS, expectedCappedMs: TWELVE_HOURS },
    { name: '13 hours offline', duration: THIRTEEN_HOURS, expectedCappedMs: TWELVE_HOURS },
    { name: '24 hours offline', duration: TWENTY_FOUR_HOURS, expectedCappedMs: TWELVE_HOURS },
    { name: '7 days offline', duration: SEVEN_DAYS, expectedCappedMs: TWELVE_HOURS },
    { name: '1 year offline', duration: ONE_YEAR, expectedCappedMs: TWELVE_HOURS }
  ];

  for (const t of testDurations) {
    const playerId = `player_single_${t.name.replace(/\s+/g, '_')}`;
    await gameService.start(playerId, 'Tester');

    // Start single mining copper
    await gameService.mine(playerId, 'mine_copper');
    const player = await gameService.getPlayer(playerId);

    // Simulate time elapsed
    player.currentActivity.lastClaimed = Date.now() - t.duration;
    await gameService.savePlayer(player);

    // Claim rewards
    const result = await gameService.claimActivity(playerId);
    assert.ok(result, `Result returned for ${t.name}`);
    assert.ok(
      result.elapsedMs >= t.expectedCappedMs && result.elapsedMs <= MAX_OFFLINE_MINING_DURATION_MS,
      `Elapsed ms for ${t.name} stays within the expected cap`
    );

    // Copper duration is 2500ms / 3 (single multiplier) = 833.33ms per cycle
    const effectiveDurationMs = 2500 / 3;
    const expectedCycles = Math.floor(t.expectedCappedMs / effectiveDurationMs);
    assert.equal(result.cyclesCompleted, expectedCycles, `Cycles completed for ${t.name} matches 12-hour cap limit`);

    // Verify immediate second claim returns 0 completed cycles (extra offline time discarded)
    const secondResult = await gameService.claimActivity(playerId);
    assert.equal(secondResult.cyclesCompleted, 0, `Second claim for ${t.name} returns 0 cycles as excess time was discarded`);
  }
});

test('Offline Mining Cap - Auto Mining (1h, 10h, 12h, 13h, 24h, 7d, 1y)', async () => {
  const engine = createMockEngine();
  const gameService = new GameService(engine);

  const ONE_HOUR = 60 * 60 * 1000;
  const TEN_HOURS = 10 * ONE_HOUR;
  const TWELVE_HOURS = 12 * ONE_HOUR;
  const THIRTEEN_HOURS = 13 * ONE_HOUR;
  const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;
  const SEVEN_DAYS = 7 * TWENTY_FOUR_HOURS;
  const ONE_YEAR = 365 * TWENTY_FOUR_HOURS;

  const testDurations = [
    { name: '1 hour offline', duration: ONE_HOUR, expectedCappedMs: ONE_HOUR },
    { name: '10 hours offline', duration: TEN_HOURS, expectedCappedMs: TEN_HOURS },
    { name: '12 hours offline', duration: TWELVE_HOURS, expectedCappedMs: TWELVE_HOURS },
    { name: '13 hours offline', duration: THIRTEEN_HOURS, expectedCappedMs: TWELVE_HOURS },
    { name: '24 hours offline', duration: TWENTY_FOUR_HOURS, expectedCappedMs: TWELVE_HOURS },
    { name: '7 days offline', duration: SEVEN_DAYS, expectedCappedMs: TWELVE_HOURS },
    { name: '1 year offline', duration: ONE_YEAR, expectedCappedMs: TWELVE_HOURS }
  ];

  // Benchmark cycles for 12 hours auto mining
  let twelveHourAutoCycles = null;

  for (const t of testDurations) {
    const playerId = `player_auto_${t.name.replace(/\s+/g, '_')}`;
    await gameService.start(playerId, 'Tester');

    // Start auto mining
    await gameService.mineAuto(playerId);
    const player = await gameService.getPlayer(playerId);

    // Simulate time elapsed
    player.currentActivity.lastClaimed = Date.now() - t.duration;
    await gameService.savePlayer(player);

    // Claim rewards
    const result = await gameService.claimActivity(playerId);
    assert.ok(result, `Result returned for ${t.name}`);
    assert.ok(
      result.elapsedMs >= t.expectedCappedMs && result.elapsedMs <= MAX_OFFLINE_MINING_DURATION_MS,
      `Elapsed ms for ${t.name} stays within the expected cap`
    );

    if (t.duration === TWELVE_HOURS) {
      twelveHourAutoCycles = result.cyclesCompleted;
    } else if (t.duration > TWELVE_HOURS) {
      assert.equal(result.cyclesCompleted, twelveHourAutoCycles, `Auto mining cycles for ${t.name} strictly equals 12-hour cap cycles`);
    }

    // Verify immediate second claim returns 0 completed cycles (extra offline time discarded)
    const secondResult = await gameService.claimActivity(playerId);
    assert.equal(secondResult.cyclesCompleted, 0, `Second auto claim for ${t.name} returns 0 cycles as excess time was discarded`);
  }
});
