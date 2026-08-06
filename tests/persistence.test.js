import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEngine } from '../src/index.js';

test('SQLite player documents survive an engine restart', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'idelon-'));
  const databasePath = path.join(tempDir, 'players.sqlite');

  try {
    const firstEngine = await createEngine({ databasePath });
    const player = firstEngine.player.create('usr_restart', 'Restart Hero');
    player.currencies.gold = 42;
    player.inventory.copper_ore = 3;
    player.hp = 77;
    player.currentActivity = {
      id: 'mine_copper',
      skillId: 'mining',
      startTime: 1,
      lastClaimed: 1
    };
    await firstEngine.player.save(player);
    await firstEngine.shutdown();

    const secondEngine = await createEngine({ databasePath });
    const loaded = await secondEngine.player.load('usr_restart');
    await secondEngine.shutdown();

    assert.equal(loaded.id, 'usr_restart');
    assert.equal(loaded.currencies.gold, 42);
    assert.equal(loaded.inventory.copper_ore, 3);
    assert.equal(loaded.hp, 77);
    assert.equal(loaded.currentActivity.id, 'mine_copper');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
