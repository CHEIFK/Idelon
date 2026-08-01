import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameInstance, ACTIVITIES } from '../src/index.js';

test('Economy pipeline: claim -> inventory -> shop -> sell', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_econ_1';

  // 1. Start mining activity & claim rewards
  await game.start(playerId, 'MinerHero');
  await game.mine(playerId, ACTIVITIES.MINING_COPPER || 'mine_copper');

  // Fast forward activity timestamp by 1 hour to accumulate completed cycles
  const player = await game.getPlayer(playerId);
  player.currentActivity.lastClaimed -= 3600000;
  await game.savePlayer(player);

  const claimRes = await game.claimActivity(playerId);
  assert.ok(claimRes.itemsGained.length > 0);

  // 2. Inspect inventory
  const inventory = await game.getInventory(playerId);
  const claimedOreQty = inventory['copper_ore'] || 0;
  assert.ok(claimedOreQty > 0);

  // 3. Inspect shop
  const shopData = await game.getShop(playerId);
  const sellableOre = shopData.inventorySellItems.find(i => i.id === 'copper_ore');
  assert.ok(sellableOre);
  assert.equal(sellableOre.unitValue, 0.5);

  // 4. Sell partial stack
  const initialGold = (await game.getProfile(playerId)).currencies.gold;
  const partialSellRes = await game.sellItem(playerId, 'copper_ore', 1);
  assert.equal(partialSellRes.success, true);
  assert.equal(partialSellRes.count, 1);
  assert.equal(partialSellRes.totalGold, 0.5);
  assert.equal(partialSellRes.newGoldBalance, Number((initialGold + 0.5).toFixed(2)));
});

test('.sell all / sellItem(playerId, "all") sells ONLY ores and preserves non-ores', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_econ_bulk';

  await game.start(playerId, 'BulkMerchant');
  const player = await game.getPlayer(playerId);

  // Add 10 Copper Ore (0.5 gold each = 5 gold), 5 Coal (0.6 gold each = 3 gold), 1 Iron Sword (Equipment), 10 Oak Logs (Resource)
  game.engine.inventory.addItem(player, 'copper_ore', 10);
  game.engine.inventory.addItem(player, 'coal', 5);
  game.engine.inventory.addItem(player, 'iron_sword', 1);
  game.engine.inventory.addItem(player, 'wood_log', 10);
  await game.savePlayer(player);

  // Execute .sell all
  const resAll = await game.sellItem(playerId, 'all');

  assert.equal(resAll.success, true);
  assert.equal(resAll.isSellAllOres, true);
  assert.equal(resAll.itemsSold.length, 2);
  assert.equal(resAll.totalGold, 8); // 5 + 3 = 8 Gold

  // Verify non-ores remain in inventory untouched
  const inv = await game.getInventory(playerId);
  assert.equal(inv['copper_ore'], undefined);
  assert.equal(inv['coal'], undefined);
  assert.equal(inv['iron_sword'], 1);
  assert.equal(inv['wood_log'], 10);
});

test('Item name normalization & case-insensitive matching for selling', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_econ_2';

  await game.start(playerId, 'NameHero');
  const player = await game.getPlayer(playerId);

  // Add 100 iron ore to inventory and save
  game.engine.inventory.addItem(player, 'iron_ore', 100);
  await game.savePlayer(player);

  // Case 1: "iron_ore"
  const res1 = await game.sellItem(playerId, 'iron_ore', 10);
  assert.equal(res1.success, true);
  assert.equal(res1.count, 10);

  // Case 2: "iron ore"
  const res2 = await game.sellItem(playerId, 'iron ore', 10);
  assert.equal(res2.success, true);
  assert.equal(res2.count, 10);

  // Case 3: "Iron Ore"
  const res3 = await game.sellItem(playerId, 'Iron Ore', 10);
  assert.equal(res3.success, true);
  assert.equal(res3.count, 10);

  // Case 4: "iron" (partial match)
  const res4 = await game.sellItem(playerId, 'iron', 10);
  assert.equal(res4.success, true);
  assert.equal(res4.count, 10);

  // Remaining quantity should be 60
  const inv = await game.getInventory(playerId);
  assert.equal(inv['iron_ore'], 60);

  // Case 5: Sell all
  const resAll = await game.sellItem(playerId, 'Iron Ore', 'all');
  assert.equal(resAll.success, true);
  assert.equal(resAll.count, 60);
  const invAfter = await game.getInventory(playerId);
  assert.equal(invAfter['iron_ore'], undefined);
});

test('Invalid item names and zero ownership error handling', async () => {
  const game = await createGameInstance();
  const playerId = 'usr_econ_3';

  await game.start(playerId, 'InvalidHero');

  // Attempt selling item player does not own
  const resUnowned = await game.sellItem(playerId, 'iron_ore', 5);
  assert.equal(resUnowned.success, false);
  assert.equal(resUnowned.reason, 'insufficient_items');

  // Attempt selling non-existent item
  const resInvalid = await game.sellItem(playerId, 'non_existent_unreal_item_99', 5);
  assert.equal(resInvalid.success, false);
  assert.equal(resInvalid.reason, 'insufficient_items');
});
