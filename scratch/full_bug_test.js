import { ContentLoader } from '../src/content/loader.js';
import { Engine } from '../src/engine/index.js';
import { GameService } from '../src/service/gameService.js';
import { DevService } from '../src/service/devService.js';
import { CURRENT_SCHEMA_VERSION, migratePlayerSave } from '../migrations/index.js';
import { DiscordBotClient } from '../src/discord/index.js';
import * as embeds from '../src/discord/embeds.js';

console.log("=================================================");
console.log("🧪 RUNNING IDELON COMPREHENSIVE BUG SUITE 🧪");
console.log("=================================================\n");

const bugsFound = [];

function recordBug(severity, module, title, description, reproduction) {
  bugsFound.push({ severity, module, title, description, reproduction });
}

// Initialize Engine and GameService
const engine = new Engine();
await engine.init();
const contentLoader = engine.content;
const gameService = new GameService(engine);
const devService = new DevService(gameService, ['dev_123']);

// -------------------------------------------------------------
// TEST 1: Inventory & Economy Negative Amount Exploit Test
// -------------------------------------------------------------
console.log("[TEST 1] Testing Inventory & Economy negative quantity operations...");

let testPlayer = engine.player.create('usr_test_1', 'TestHero');
testPlayer.inventory['copper_ore'] = 10;
testPlayer.currencies['gold'] = 100;

// Test removeItem with negative amount
engine.inventory.removeItem(testPlayer, 'copper_ore', -5);
if (testPlayer.inventory['copper_ore'] === 15) {
  recordBug(
    'CRITICAL',
    'InventoryModule (src/engine/inventory.js:13)',
    'Negative quantity in removeItem() generates items out of thin air',
    'Calling removeItem(player, itemId, -N) increases item quantity instead of rejecting negative amounts or returning false.',
    'engine.inventory.removeItem(player, "copper_ore", -5)'
  );
}

// Test removeCurrency with negative amount
engine.economy.removeCurrency(testPlayer, 'gold', -50);
if (testPlayer.currencies['gold'] === 150) {
  recordBug(
    'CRITICAL',
    'EconomyModule (src/engine/economy.js:13)',
    'Negative amount in removeCurrency() adds currency',
    'Calling removeCurrency(player, "gold", -N) adds N gold to the player balance because (-50 < 100) is true and balance -= -50.',
    'engine.economy.removeCurrency(player, "gold", -50)'
  );
}

// -------------------------------------------------------------
// TEST 2: GameService.sellItem Negative Amount Vulnerability
// -------------------------------------------------------------
console.log("[TEST 2] Testing GameService.sellItem with negative / invalid quantities...");
(async () => {
  const p2 = await gameService.getPlayer('usr_test_2');
  p2.inventory['copper_ore'] = 10;
  p2.currencies['gold'] = 100;
  await gameService.savePlayer(p2);

  // Attempt to sell negative copper
  const res = await gameService.sellItem('usr_test_2', 'copper_ore', -5);
  const updatedP2 = await gameService.getPlayer('usr_test_2');

  if (res.success && updatedP2.inventory['copper_ore'] === 15) {
    recordBug(
      'CRITICAL',
      'GameService (src/service/gameService.js:503)',
      'GameService.sellItem accepts negative quantities, duplicating items',
      'Calling sellItem(playerId, "copper_ore", -5) passes requestedCount = -5 down to removeItem(), increasing copper_ore by 5 and deducting gold.',
      'gameService.sellItem("usr_test_2", "copper_ore", -5)'
    );
  }
})();

// -------------------------------------------------------------
// TEST 3: Crafting Negative / Zero Quantity
// -------------------------------------------------------------
console.log("[TEST 3] Testing CraftingModule with negative / zero counts...");
let p3 = engine.player.create('usr_test_3', 'CraftHero');
p3.inventory['copper_ore'] = 20;

const craftRes = engine.crafting.craft(p3, 'copper_bar', -5);
if (craftRes.success) {
  recordBug(
    'HIGH',
    'CraftingModule (src/engine/crafting.js:57)',
    'CraftingModule accepts negative count values',
    'Calling craft(player, recipeId, -5) allows crafting negative items, altering material counts unexpectedly.',
    'engine.crafting.craft(player, "copper_bar", -5)'
  );
}

// -------------------------------------------------------------
// TEST 4: Text Command Parser Edge Cases & Bad Inputs
// -------------------------------------------------------------
console.log("[TEST 4] Testing Discord Text Command Parser & Command Handlers...");

const discordBot = new DiscordBotClient(gameService, devService);
const testUser = { id: 'usr_discord_test', username: 'DiscordTester' };

(async () => {
  // Test selling negative quantity via text command: .sell copper -10
  const pDisc = await gameService.getPlayer('usr_discord_test');
  pDisc.inventory['copper_ore'] = 10;
  await gameService.savePlayer(pDisc);

  const resText = await discordBot.handleTextMessage('.sell copper -10', testUser);
  const afterDisc = await gameService.getPlayer('usr_discord_test');

  if (afterDisc.inventory['copper_ore'] === 20) {
    recordBug(
      'CRITICAL',
      'Discord Command Handler (src/discord/commands/economy/sell.js)',
      'Discord .sell command accepts negative numbers, enabling item duplication',
      'Executing `.sell copper -10` passed count="-10" directly to gameService.sellItem, resulting in 10 additional copper_ore added to inventory.',
      'discordBot.handleTextMessage(".sell copper -10", user)'
    );
  }

  // Test selling non-numeric quantity: .sell copper abc
  const resAbc = await discordBot.handleTextMessage('.sell copper abc', testUser);
  if (resAbc.embed && resAbc.embed.title.includes('Success')) {
    recordBug(
      'HIGH',
      'Discord Command Handler (src/discord/commands/economy/sell.js)',
      'Discord .sell command accepts invalid non-numeric quantity "abc"',
      'Executing `.sell copper abc` fell back to default quantity 1 or parsed as NaN without user warning.',
      'discordBot.handleTextMessage(".sell copper abc", user)'
    );
  }
})();

// -------------------------------------------------------------
// TEST 5: Offline Progress & Activity Elapsed Time Anomalies
// -------------------------------------------------------------
console.log("[TEST 5] Testing Offline Progression calculation boundaries...");
let p5 = engine.player.create('usr_test_5', 'TimeHero');
engine.activities.start(p5, 'mine_copper');

// Set activity start time in the future (clock skew)
p5.currentActivity.startTime = Date.now() + 1000000;
const futureClaim = engine.activities.claim(p5);
if (futureClaim.cyclesCompleted > 0) {
  recordBug(
    'HIGH',
    'ActivitiesModule (src/engine/activities/gathering.js)',
    'Activity claim processes positive cycles when startTime is in the future',
    'If startTime > now due to server clock skew, elapsed time is negative, but cycles calculation might not handle negative correctly.',
    'Set player.currentActivity.startTime to future timestamp and run claim()'
  );
}

// Set activity start time 100 years in the past (overflow test)
p5.currentActivity.startTime = Date.now() - (100 * 365 * 24 * 3600 * 1000);
const hugeClaim = engine.activities.claim(p5);
if (!Number.isFinite(hugeClaim.cyclesCompleted) || Number.isNaN(hugeClaim.xpGained)) {
  recordBug(
    'HIGH',
    'ActivitiesModule (src/engine/activities/gathering.js)',
    'Extreme offline duration causes NaN or non-finite values',
    'Submitting an extremely large elapsed time causes NaN or Infinity XP / items.',
    'Set startTime 100 years ago and run claim()'
  );
}

// -------------------------------------------------------------
// TEST 6: Content Loader Cross-Reference Verification
// -------------------------------------------------------------
console.log("[TEST 6] Validating Content Loader & Data Schemas...");

try {
  contentLoader.validate();
  console.log("  ✔ ContentLoader internal validation passed.");
} catch (err) {
  recordBug(
    'HIGH',
    'ContentLoader (src/content/loader.js)',
    'Content Validation Error',
    err.message,
    'contentLoader.validate()'
  );
}

// Check for items referenced in recipes/loot tables that lack valid sell values or names
for (const item of contentLoader.getAll('items')) {
  if (item.sellValue === undefined && item.value === undefined) {
    recordBug(
      'MEDIUM',
      'Data Definition (src/data/items.json)',
      `Item '${item.id}' missing sellValue/value`,
      `Item ${item.id} has no defined sell value.`,
      `contentLoader.getItem("${item.id}")`
    );
  }
}

// -------------------------------------------------------------
// TEST 7: Equipment System Swap & Slot Safety
// -------------------------------------------------------------
console.log("[TEST 7] Testing Equipment System swap & slot safety...");

let p7 = engine.player.create('usr_test_7', 'GearHero');
p7.inventory['iron_sword'] = 1;
p7.inventory['bronze_sword'] = 1;

// Equip iron_sword
engine.equipment.equip(p7, 'iron_sword');

// Swap with bronze_sword
const swapRes = engine.equipment.equip(p7, 'bronze_sword');

if (p7.equipment.weapon.id !== 'bronze_sword' || p7.inventory['iron_sword'] !== 1) {
  recordBug(
    'HIGH',
    'EquipmentModule (src/engine/equipment.js)',
    'Equipment swap fails to return previous weapon to inventory properly',
    'Swapping weapon did not leave bronze_sword equipped or failed to return iron_sword to inventory.',
    'equip("iron_sword") then equip("bronze_sword")'
  );
}

// Unequip bronze_sword
engine.equipment.unequip(p7, 'weapon');
if (p7.equipment.weapon || p7.inventory['bronze_sword'] !== 1) {
  recordBug(
    'MEDIUM',
    'EquipmentModule (src/engine/equipment.js)',
    'Unequip fails to return item to inventory',
    'Unequipping weapon did not properly return bronze_sword to inventory.',
    'unequip("weapon")'
  );
}

// -------------------------------------------------------------
// TEST 8: Save Schema & Legacy Migration Audit
// -------------------------------------------------------------
console.log("[TEST 8] Testing Save Schema & Legacy Migrations...");

const legacyV0Save = {
  id: 'legacy_user_1',
  name: 'OldHero',
  inventory: { copper_ore: 5 },
  skills: { mining: { level: 2, xp: 100 } }
};

const migrationRes = migratePlayerSave(legacyV0Save);
if (migrationRes.schemaVersion !== CURRENT_SCHEMA_VERSION || !migrationRes.attributes) {
  recordBug(
    'HIGH',
    'Save System (migrations/index.js)',
    'Legacy v0 save migration missing schemaVersion attributes initialization',
    'Migrated save failed to set schemaVersion to current version or initialize default attributes object.',
    'migratePlayerSave(legacyV0Save)'
  );
}

// -------------------------------------------------------------
// TEST 9: Discord Embed Field Length & Null Safety
// -------------------------------------------------------------
console.log("[TEST 9] Testing Discord Embed formatting safety...");

let emptyInventoryEmbed = embeds.createInventoryEmbed('EmptyUser', {}, contentLoader);
if (!emptyInventoryEmbed.title || !emptyInventoryEmbed.description) {
  recordBug(
    'MEDIUM',
    'Discord Embeds (src/discord/embeds.js)',
    'createInventoryEmbed handles empty inventory poorly',
    'Empty inventory embed produced invalid title or description.',
    'createInventoryEmbed("EmptyUser", {}, contentLoader)'
  );
}

// Test embed output with giant inventory
const hugeInventory = {};
for (let i = 0; i < 50; i++) {
  hugeInventory[`item_${i}`] = 1000;
}
const hugeEmbed = embeds.createInventoryEmbed('HugeUser', hugeInventory, contentLoader);

// Discord description character limit is 4096
if (hugeEmbed.description && hugeEmbed.description.length > 4096) {
  recordBug(
    'HIGH',
    'Discord Embeds (src/discord/embeds.js:186)',
    'createInventoryEmbed exceeds Discord 4096 character description limit',
    `Description character length for 50 inventory items was ${hugeEmbed.description.length}, exceeding Discord's max limit of 4096 characters, which will cause API error 50035.`,
    'createInventoryEmbed("HugeUser", 50_items_inventory, contentLoader)'
  );
}

const hugeShopEmbed = embeds.createShopEmbed({
  inventorySellItems: Array(50).fill(null).map((_, i) => ({
    id: `item_${i}`,
    name: `Item ${i}`,
    category: 'Ore',
    quantity: 100,
    unitValue: 1,
    totalValue: 100
  })),
  currencies: { gold: 500 }
}, contentLoader);

if (hugeShopEmbed.description && hugeShopEmbed.description.length > 4096) {
  recordBug(
    'HIGH',
    'Discord Embeds (src/discord/embeds.js:468)',
    'createShopEmbed exceeds Discord 4096 character description limit',
    `Shop embed description length was ${hugeShopEmbed.description.length}, exceeding Discord's limit of 4096 chars when player has many items.`,
    'createShopEmbed(50_items_shop, contentLoader)'
  );
}

// -------------------------------------------------------------
// SUMMARY & REPORT
// -------------------------------------------------------------
setTimeout(() => {
  console.log("\n=================================================");
  console.log(`📊 TEST COMPLETE - FOUND ${bugsFound.length} BUG(S)`);
  console.log("=================================================\n");

  bugsFound.forEach((b, i) => {
    console.log(`[BUG #${i + 1}] [${b.severity}] ${b.module}`);
    console.log(`Title: ${b.title}`);
    console.log(`Description: ${b.description}`);
    console.log(`Reproduction: ${b.reproduction}\n`);
  });
}, 200);
