import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine/index.js';
import { GameService } from '../src/service/gameService.js';
import { commandRegistry } from '../src/discord/commands/index.js';
import * as embeds from '../src/discord/embeds.js';

test('Phase 3 Regression: Inventory embed with 120 items stays under Discord 4096 description limit', async () => {
  const engine = new Engine();
  await engine.init();
  const contentLoader = engine.content;

  const largeInventory = {};
  for (let i = 0; i < 120; i++) {
    largeInventory[`item_stack_long_name_${i}`] = 100 + i;
  }

  const embed = embeds.createInventoryEmbed('BigTrader', largeInventory, contentLoader);
  assert.ok(embed.description.length <= 4096, `Description length ${embed.description.length} exceeds 4096 limit`);
  assert.ok(embed.description.includes('more items'), 'Should truncate with "... and X more items" notice');
});

test('Phase 3 Regression: Bank storage embed with 120 items stays under Discord 4096 description limit', async () => {
  const engine = new Engine();
  await engine.init();
  const contentLoader = engine.content;

  const largeStorage = {};
  for (let i = 0; i < 120; i++) {
    largeStorage[`storage_stack_long_name_${i}`] = 500 + i;
  }

  const embed = embeds.createStorageEmbed('VaultMaster', largeStorage, contentLoader);
  assert.ok(embed.description.length <= 4096, `Description length ${embed.description.length} exceeds 4096 limit`);
  assert.ok(embed.description.includes('more items'), 'Should truncate with "... and X more items" notice');
});

test('Phase 3 Regression: Claim activity embed with 40 items stays under Discord 1024 field value limit', async () => {
  const engine = new Engine();
  await engine.init();
  const contentLoader = engine.content;

  const itemsGained = [];
  for (let i = 0; i < 40; i++) {
    itemsGained.push({ itemId: `ore_type_${i}`, amount: 50 + i });
  }

  const result = {
    mode: 'auto',
    cyclesCompleted: 100,
    xpGained: 500,
    itemsGained
  };

  const embed = embeds.createActivityResultEmbed('claim', result, contentLoader);
  const itemsField = embed.fields.find(f => f.name.includes('Items Obtained'));
  assert.ok(itemsField, 'Should contain Items Obtained field');
  assert.ok(itemsField.value.length <= 1024, `Field value length ${itemsField.value.length} exceeds 1024 limit`);
});

test('Phase 3 Regression: Command embeds pass contentLoader and format items properly', async () => {
  const engine = new Engine();
  await engine.init();
  const gameService = new GameService(engine);
  const user = { id: 'usr_p3_content', username: 'EmojiHero' };

  const invRes = await commandRegistry.handleTextMessage('.inv', user, gameService);
  assert.ok(invRes && invRes.embed, 'Inventory command should return embed');

  const balRes = await commandRegistry.handleTextMessage('.bal', user, gameService);
  assert.ok(balRes && balRes.embed, 'Balance command should return embed');
  assert.ok(balRes.embed.fields[0].name.includes('Gold'), 'Balance embed should include Gold field');
});

test('Phase 3 Regression: Shop preserves custom Discord emoji rendering', async () => {
  const engine = new Engine();
  await engine.init();

  const embed = embeds.createShopEmbed({
    currencies: { gold: 123 },
    inventorySellItems: [
      { id: 'copper_ore', quantity: 36, unitValue: 0.5 },
      { id: 'coal', quantity: 36, unitValue: 0.6 }
    ]
  }, engine.content);

  assert.ok(embed.description.includes('<:ore_item_copper:1532865357012930701>'));
  assert.ok(embed.description.includes('<:ore_item_coal:1532865354194489394>'));
  assert.equal(embed.description.includes('```'), false, 'Shop rows must not be inside a code block');
});
