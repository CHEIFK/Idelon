import { createGameInstance, createDevService, DiscordBotClient, createDiscordBot, commandRegistry } from '../src/index.js';
import * as embeds from '../src/discord/embeds.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    testResults.push({ name: testName, status: 'PASS', details });
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    testResults.push({ name: testName, status: 'FAIL', details });
    console.log(`  ❌ FAIL: ${testName} | ${details}`);
  }
}

async function runAuditTests() {
  console.log('=======================================================');
  console.log('🧪 Starting Discord Layer Deep Bug Audit & Fuzz Testing');
  console.log('=======================================================\n');

  const gameService = await createGameInstance();
  const devUserIds = ['123456789'];
  const devService = createDevService(gameService, devUserIds, true);
  const botClient = createDiscordBot(gameService, devService);
  const testUserId = 'test_user_fuzz_1';

  // Ensure test player exists
  await gameService.start(testUserId, 'FuzzTester');

  // =========================================================================
  // CATEGORY 1: Command Registry Matching & Text Command Alias Parsing
  // =========================================================================
  console.log('--- Category 1: Command Registry Matching & Text Command Alias Parsing ---');
  
  const requiredCommands = [
    'mine', 'sell', 'profile', 'inv', 'shop', 'claim',
    'hunt', 'travel', 'areas', 'equip', 'unequip',
    'deposit', 'withdraw', 'storage', 'skills', 'bal', 'start', 'help', 'dev'
  ];

  for (const cmdName of requiredCommands) {
    const cmd = commandRegistry.getCommand(cmdName);
    assert(cmd !== null, `Registry includes command '.${cmdName}'`, cmd ? `Found in category ${cmd.category}` : `Command '.${cmdName}' is MISSING from registry!`);
  }

  // Check alias '.inventory'
  const invAlias = commandRegistry.getCommand('inventory');
  assert(invAlias !== null, "Registry includes alias '.inventory'", invAlias ? 'Found' : "File 'inventory.js' exists but is NOT registered in commandRegistry!");

  // Test command case-insensitivity
  const uppercaseRes = await botClient.handleTextMessage('.PROFILE', { id: testUserId, username: 'FuzzTester' });
  assert(uppercaseRes && uppercaseRes.embed && uppercaseRes.embed.title?.includes('Profile'), "Text command supports UPPERCASE commands (e.g. '.PROFILE')", uppercaseRes ? 'Returned profile embed' : 'Failed to parse uppercase command');

  const mixedCaseRes = await botClient.handleTextMessage('.sElL', { id: testUserId, username: 'FuzzTester' });
  assert(mixedCaseRes && mixedCaseRes.embed, "Text command supports mixed-case commands (e.g. '.sElL')", mixedCaseRes ? 'Returned sell embed' : 'Failed');


  // =========================================================================
  // CATEGORY 2: Input Argument Parsing Edge Cases for Text Commands
  // =========================================================================
  console.log('\n--- Category 2: Input Argument Parsing Edge Cases for Text Commands ---');

  // 2.1 Non-numeric quantity in .sell copper abc
  // First give player some copper ore to test selling
  await devService.giveItem(devUserIds[0], testUserId, 'copper_ore', 10);
  const sellAbcRes = await botClient.handleTextMessage('.sell copper_ore abc', { id: testUserId, username: 'FuzzTester' });
  // If amount is invalid, it shouldn't try to sell item named 'copper_ore abc' or sell 1
  assert(
    sellAbcRes && sellAbcRes.embed && (sellAbcRes.embed.title?.includes('Failed') || sellAbcRes.embed.description?.includes('Invalid') || sellAbcRes.embed.title?.includes('Error')),
    "Text command '.sell copper_ore abc' rejects non-numeric quantity 'abc'",
    `Embed Title: '${sellAbcRes?.embed?.title}' | Description: '${sellAbcRes?.embed?.description}'`
  );

  // 2.2 Negative quantity in .sell copper_ore -5
  const profileBeforeSellNeg = await gameService.getProfile(testUserId);
  const goldBeforeSellNeg = profileBeforeSellNeg.currencies.gold || 0;
  const sellNegRes = await botClient.handleTextMessage('.sell copper_ore -5', { id: testUserId, username: 'FuzzTester' });
  const profileAfterSellNeg = await gameService.getProfile(testUserId);
  const goldAfterSellNeg = profileAfterSellNeg.currencies.gold || 0;
  assert(
    goldAfterSellNeg === goldBeforeSellNeg && (!sellNegRes?.embed?.title?.includes('Items Sold')),
    "Text command '.sell copper_ore -5' rejects negative quantity -5 without modifying gold/inventory",
    `Gold before: ${goldBeforeSellNeg}, Gold after: ${goldAfterSellNeg}, Title: '${sellNegRes?.embed?.title}'`
  );

  // 2.3 Zero quantity in .sell copper_ore 0
  const sellZeroRes = await botClient.handleTextMessage('.sell copper_ore 0', { id: testUserId, username: 'FuzzTester' });
  assert(
    sellZeroRes && sellZeroRes.embed && (!sellZeroRes.embed.title?.includes('Items Sold') || sellZeroRes.embed.description?.includes('Invalid')),
    "Text command '.sell copper_ore 0' does NOT default 0 to 1 and sell an item",
    `Title: '${sellZeroRes?.embed?.title}', Description: '${sellZeroRes?.embed?.description}'`
  );

  // 2.4 Negative deposit .deposit copper_ore -10
  const depositNegRes = await botClient.handleTextMessage('.deposit copper_ore -10', { id: testUserId, username: 'FuzzTester' });
  assert(
    depositNegRes && depositNegRes.embed && depositNegRes.embed.title?.includes('Failed'),
    "Text command '.deposit copper_ore -10' rejects negative deposit quantity",
    `Title: '${depositNegRes?.embed?.title}'`
  );

  // 2.5 Withdraw NaN .withdraw copper_ore NaN
  const withdrawNaNRes = await botClient.handleTextMessage('.withdraw copper_ore NaN', { id: testUserId, username: 'FuzzTester' });
  assert(
    withdrawNaNRes && withdrawNaNRes.embed && (withdrawNaNRes.embed.title?.includes('Failed') || withdrawNaNRes.embed.title?.includes('Error')),
    "Text command '.withdraw copper_ore NaN' rejects NaN quantity instead of defaulting to 1",
    `Title: '${withdrawNaNRes?.embed?.title}'`
  );

  // 2.6 Unregistered .equip non_existent
  const equipRes = await botClient.handleTextMessage('.equip iron_sword', { id: testUserId, username: 'FuzzTester' });
  assert(
    equipRes !== null && equipRes !== undefined,
    "Text command '.equip iron_sword' produces a valid response embed",
    equipRes ? `Title: ${equipRes.embed?.title}` : 'Command returned NULL because .equip is not registered!'
  );

  // 2.7 Multi-argument text option parsing for .dev give-item <target> <item> <amount>
  const devTextRes = await botClient.handleTextMessage(`.dev give-item ${testUserId} copper_ore 5`, { id: devUserIds[0], username: 'DevUser' });
  assert(
    devTextRes && devTextRes.embed && devTextRes.embed.title?.includes('Give Item') && devTextRes.embed.description?.includes('x5'),
    "Text command '.dev give-item <target> <item> <amount>' parses target, item, and amount correctly",
    `Title: '${devTextRes?.embed?.title}' | Description: '${devTextRes?.embed?.description}'`
  );


  // =========================================================================
  // CATEGORY 3: Embed Construction Bounds & Formatting
  // =========================================================================
  console.log('\n--- Category 3: Embed Construction Bounds & Formatting ---');

  function validateEmbedBounds(embed, embedName) {
    let valid = true;
    let errorMsg = '';

    if (embed.title && embed.title.length > 256) {
      valid = false;
      errorMsg += `Title length ${embed.title.length} > 256; `;
    }
    if (embed.description && embed.description.length > 4096) {
      valid = false;
      errorMsg += `Description length ${embed.description.length} > 4096; `;
    }
    let totalChars = (embed.title?.length || 0) + (embed.description?.length || 0) + (embed.footer?.text?.length || 0);

    if (Array.isArray(embed.fields)) {
      if (embed.fields.length > 25) {
        valid = false;
        errorMsg += `Fields count ${embed.fields.length} > 25; `;
      }
      embed.fields.forEach((f, idx) => {
        if (f.name && f.name.length > 256) {
          valid = false;
          errorMsg += `Field[${idx}] name length ${f.name.length} > 256; `;
        }
        if (f.value && String(f.value).length > 1024) {
          valid = false;
          errorMsg += `Field[${idx}] value length ${String(f.value).length} > 1024; `;
        }
        totalChars += (f.name?.length || 0) + String(f.value || '').length;
      });
    }

    if (totalChars > 6000) {
      valid = false;
      errorMsg += `Total characters ${totalChars} > 6000; `;
    }

    return { valid, errorMsg, totalChars };
  }

  // 3.1 Test large inventory embed bounds (add 50 items to inventory)
  const largeInv = {};
  for (let i = 1; i <= 60; i++) {
    largeInv[`test_item_type_${i}_with_a_very_long_descriptive_name_to_exceed_limits`] = 1000;
  }
  const largeInvEmbed = embeds.createInventoryEmbed('BigPlayer', largeInv, gameService.engine.content);
  const invBounds = validateEmbedBounds(largeInvEmbed, 'Large Inventory Embed');
  assert(invBounds.valid, "Inventory embed with 60 items stays within Discord 4096 description limit", invBounds.errorMsg || `Total chars: ${invBounds.totalChars}`);

  // 3.2 Test large storage embed bounds (add 60 items to storage)
  const largeStorageEmbed = embeds.createStorageEmbed('BigPlayer', largeInv, gameService.engine.content);
  const storageBounds = validateEmbedBounds(largeStorageEmbed, 'Large Storage Embed');
  assert(storageBounds.valid, "Storage embed with 60 items stays within Discord 4096 description limit", storageBounds.errorMsg || `Total chars: ${storageBounds.totalChars}`);

  // 3.3 Test auto-mine claim embed with many items gained
  const autoClaimResult = {
    mode: 'auto',
    cyclesCompleted: 100,
    xpGained: 5000,
    itemsGained: Array.from({ length: 40 }, (_, idx) => ({ itemId: `item_gain_${idx}_long_name`, amount: 9999 }))
  };
  const claimEmbed = embeds.createActivityResultEmbed('claim', autoClaimResult, gameService.engine.content);
  const claimBounds = validateEmbedBounds(claimEmbed, 'Claim Activity Embed');
  assert(claimBounds.valid, "Claim activity embed with 40 gained items stays within Discord field value 1024 limit", claimBounds.errorMsg || `Total chars: ${claimBounds.totalChars}`);

  // 3.4 Test embed formatting when optional parameters are missing
  let profileMissingAttrNoCrash = true;
  try {
    embeds.createProfileEmbed({ name: 'NoAttrPlayer' });
  } catch (e) {
    profileMissingAttrNoCrash = false;
  }
  assert(profileMissingAttrNoCrash, "createProfileEmbed handles profile object missing equipment/attributes without throwing", profileMissingAttrNoCrash ? 'Success' : 'Threw exception');

  // 3.5 Check inventory embed when contentLoader is omitted
  let invNoContentLoaderNoCrash = true;
  try {
    embeds.createInventoryEmbed('TestUser', { copper_ore: 5 });
  } catch (e) {
    invNoContentLoaderNoCrash = false;
  }
  assert(invNoContentLoaderNoCrash, "createInventoryEmbed handles missing contentLoader gracefully", invNoContentLoaderNoCrash ? 'Success' : 'Threw exception');


  // =========================================================================
  // CATEGORY 4: Discord Interaction Reply Logic
  // =========================================================================
  console.log('\n--- Category 4: Discord Interaction Reply Logic ---');

  // 4.1 Mock interaction with deferReply throwing error
  let botRunnerErrorHandled = true;
  const mockFailedDeferInteraction = {
    isChatInputCommand: () => true,
    commandName: 'profile',
    user: { id: testUserId, username: 'FuzzTester' },
    deferReply: async () => { throw new Error('Interaction token expired'); },
    editReply: async () => { throw new Error('Cannot edit reply on failed defer'); },
    reply: async () => { throw new Error('Cannot reply on expired interaction'); },
    deferred: false,
    replied: false
  };

  // Simulate slash command handler logic from botRunner.js
  try {
    await mockFailedDeferInteraction.deferReply().catch(() => {});
    const customInteraction = {
      commandName: mockFailedDeferInteraction.commandName,
      user: mockFailedDeferInteraction.user,
      options: { getString: () => null, getInteger: () => null }
    };
    const res = await botClient.handleCommandInteraction(customInteraction);
    if (res.embed) {
      await mockFailedDeferInteraction.editReply({ embeds: [res.embed] });
    }
  } catch (err) {
    botRunnerErrorHandled = false;
  }
  assert(
    !botRunnerErrorHandled,
    "botRunner.js catch block fails if deferReply() rejects and editReply() is called without checking deferred state",
    "Swallowing deferReply().catch() leads to unhandled editReply rejection when interaction token expired!"
  );

  // 4.2 Text command error notification handling
  // Simulate an error thrown inside command execution
  const invalidInteraction = { commandName: 'non_existent_command_test' };
  const handleInteractionRes = await botClient.handleCommandInteraction(invalidInteraction);
  assert(
    handleInteractionRes && handleInteractionRes.embed && handleInteractionRes.embed.title?.includes('Not Found'),
    "handleCommandInteraction returns error embed for unknown command instead of throwing unhandled error",
    `Embed Title: '${handleInteractionRes?.embed?.title}'`
  );


  // =========================================================================
  // CATEGORY 5: Edge Cases in Dev Commands
  // =========================================================================
  console.log('\n--- Category 5: Edge Cases in Dev Commands ---');

  // 5.1 Unauthorized dev execution
  const unauthDevRes = await devCmdExecute('give-item', 'unauthorized_user_999', { item: 'copper_ore', amount: 10 }, gameService, devService);
  assert(
    unauthDevRes && unauthDevRes.embed && unauthDevRes.embed.title?.includes('Permission Denied'),
    "Dev command rejects unauthorized user ID",
    `Title: '${unauthDevRes?.embed?.title}'`
  );

  // 5.2 Dev command missing subcommand
  const noSubcmdRes = await devCmdExecute(null, devUserIds[0], {}, gameService, devService);
  assert(
    noSubcmdRes && noSubcmdRes.embed && (noSubcmdRes.embed.title?.includes('Error') || noSubcmdRes.embed.description?.includes('Unknown')),
    "Dev command handles missing/null subcommand gracefully",
    `Title: '${noSubcmdRes?.embed?.title}', Description: '${noSubcmdRes?.embed?.description}'`
  );

  // 5.3 Dev teleport command missing required 'area' option
  const teleNoAreaRes = await devCmdExecute('teleport', devUserIds[0], { area: null }, gameService, devService);
  const playerAfterTeleNoArea = await gameService.getPlayer(testUserId);
  assert(
    playerAfterTeleNoArea.currentAreaId !== null && playerAfterTeleNoArea.currentAreaId !== undefined,
    "Dev teleport with null area option does NOT corrupt player's currentAreaId with null/undefined",
    `Player currentAreaId after teleport(null): ${playerAfterTeleNoArea.currentAreaId}`
  );

  // 5.4 Dev give-item command missing required 'item' option
  const giveNoItemRes = await devCmdExecute('give-item', devUserIds[0], { item: null, amount: 5 }, gameService, devService);
  const invAfterNoItem = await gameService.getInventory(testUserId);
  assert(
    !Object.keys(invAfterNoItem).includes('undefined') && !Object.keys(invAfterNoItem).includes('null'),
    "Dev give-item with null item option does NOT pollute inventory with 'undefined' or 'null' keys",
    `Inventory keys: [${Object.keys(invAfterNoItem).join(', ')}]`
  );

  // 5.5 Dev command disabled service handling
  const disabledDevRes = await devCmdExecute('give-item', devUserIds[0], { item: 'copper_ore' }, gameService, null);
  assert(
    disabledDevRes && disabledDevRes.embed && disabledDevRes.embed.title?.includes('Disabled'),
    "Dev command returns disabled embed when devService is null",
    `Title: '${disabledDevRes?.embed?.title}'`
  );

  console.log('\n=======================================================');
  console.log(`📊 Audit Test Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('=======================================================\n');
}

async function devCmdExecute(subcommand, userId, extraOptions = {}, gameService, devService, targetUserId = 'test_user_fuzz_1') {
  const mockOptions = {
    getString: (name) => {
      if (name === 'subcommand') return subcommand;
      if (name === 'target_user') return targetUserId;
      return extraOptions[name] !== undefined ? extraOptions[name] : null;
    },
    getInteger: (name) => {
      return extraOptions[name] !== undefined ? extraOptions[name] : null;
    }
  };
  const mockInteraction = {
    commandName: 'dev',
    user: { id: userId, username: 'DevUser' },
    options: mockOptions
  };
  const devCmd = commandRegistry.getCommand('dev');
  return devCmd.execute(mockInteraction, gameService, devService);
}

runAuditTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
