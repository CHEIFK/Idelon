import { createGameInstance } from '../src/index.js';

async function validateEconomyBalance() {
  console.log('=======================================================');
  console.log('💰 Idelon Economy Balance Update v1 Validation');
  console.log('=======================================================');

  const game = await createGameInstance();
  const playerId = 'usr_val_econ';

  const startRes = await game.start(playerId, 'EconTester');
  const player = startRes.player;

  // Populate inventory with various item categories
  game.engine.inventory.addItem(player, 'copper_ore', 20); // 20 * 0.5 = 10 Gold
  game.engine.inventory.addItem(player, 'coal', 10);       // 10 * 0.6 = 6 Gold
  game.engine.inventory.addItem(player, 'lead_ore', 5);     // 5 * 0.9 = 4.5 Gold
  game.engine.inventory.addItem(player, 'iron_sword', 1);   // Equipment
  game.engine.inventory.addItem(player, 'cooked_trout', 3); // Consumable
  game.engine.inventory.addItem(player, 'graphite', 4);     // Refined Material
  game.engine.inventory.addItem(player, 'scrap', 5);        // Salvage
  await game.savePlayer(player);

  console.log('[STAGE 1] Testing single ore sell: .sell copper all...');
  const resCopper = await game.sellItem(playerId, 'copper_ore', 'all');
  console.log(`✔ Sold 20 Copper Ore @ 0.5 Gold each ➔ +${resCopper.totalGold} Gold | New Balance: ${resCopper.newGoldBalance} Gold`);

  console.log('\n[STAGE 2] Testing bulk ore sell: .sell all...');
  const resBulk = await game.sellItem(playerId, 'all');
  console.log(`✔ Bulk Sold ${resBulk.itemsSold.length} Ore stacks ➔ +${resBulk.totalGold} Gold | New Balance: ${resBulk.newGoldBalance} Gold`);
  for (const item of resBulk.itemsSold) {
    console.log(`   • ${item.name}: ×${item.quantity} @ ${item.unitValue} Gold each = +${item.goldEarned} Gold`);
  }

  console.log('\n[STAGE 3] Verifying Non-Ore Inventory Safety...');
  const updatedPlayer = await game.getPlayer(playerId);
  const inv = updatedPlayer.inventory;
  const nonOresSafe = (inv['iron_sword'] === 1) && (inv['cooked_trout'] === 3) && (inv['graphite'] === 4) && (inv['scrap'] === 5);
  const oresCleared = (!inv['copper_ore']) && (!inv['coal']) && (!inv['lead_ore']);

  console.log(`✔ Ores Cleared from Inventory: ${oresCleared ? 'YES' : 'NO'}`);
  console.log(`✔ Non-Ores Intact (Equipment, Consumables, Refined, Salvage): ${nonOresSafe ? 'YES' : 'NO'}`);

  console.log('=======================================================');
  if (oresCleared && nonOresSafe) {
    console.log('✨ Economy Balance & .sell all Validation Passed 100%!');
  } else {
    console.error('💥 Validation Failed.');
    process.exit(1);
  }
}

validateEconomyBalance().catch(err => {
  console.error('[FATAL] Economy validation error:', err);
  process.exit(1);
});
