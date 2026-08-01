import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, EVENTS } from '../src/index.js';

test('Smelting as a data-driven crafting recipe (Copper Ore -> Copper Bar)', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_smith_1', 'BlacksmithHero');

  // Give player 4 Copper Ore (2 per copper bar)
  engine.inventory.addItem(player, 'copper_ore', 4);

  const eventsRecorded = [];
  engine.events.on(EVENTS.CRAFTING_STARTED, (d) => eventsRecorded.push({ type: EVENTS.CRAFTING_STARTED, d }));
  engine.events.on(EVENTS.ITEM_REMOVED, (d) => eventsRecorded.push({ type: EVENTS.ITEM_REMOVED, d }));
  engine.events.on(EVENTS.ITEM_ADDED, (d) => eventsRecorded.push({ type: EVENTS.ITEM_ADDED, d }));
  engine.events.on(EVENTS.XP_GAINED, (d) => eventsRecorded.push({ type: EVENTS.XP_GAINED, d }));
  engine.events.on(EVENTS.CRAFTING_COMPLETED, (d) => eventsRecorded.push({ type: EVENTS.CRAFTING_COMPLETED, d }));

  // Check canCraft
  const canCraftRes = engine.crafting.canCraft(player, 'smelt_copper_bar', 2);
  assert.equal(canCraftRes.canCraft, true);

  // Craft 2 Copper Bars
  const craftRes = engine.crafting.craft(player, 'smelt_copper_bar', 2);
  assert.equal(craftRes.success, true);
  assert.equal(craftRes.resultItemId, 'copper_bar');
  assert.equal(craftRes.resultAmount, 2);
  assert.equal(craftRes.xpGained, 24); // 12 * 2

  // Check Inventory
  assert.equal(engine.inventory.hasItem(player, 'copper_ore', 1), false);
  assert.equal(engine.inventory.hasItem(player, 'copper_bar', 2), true);

  // Check Smithing XP
  assert.equal(engine.skills.getXP(player, 'smithing'), 24);

  // Verify events
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.CRAFTING_STARTED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.ITEM_REMOVED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.ITEM_ADDED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.XP_GAINED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.CRAFTING_COMPLETED), true);
});

test('Complex crafting recipe requiring multiple ingredients (Iron Sword)', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_smith_2', 'Armorer');

  // Add 2 Iron Bars and 1 Wood Log
  engine.inventory.addItem(player, 'iron_bar', 2);
  engine.inventory.addItem(player, 'wood_log', 1);

  // Attempt crafting without enough materials first
  const failRes = engine.crafting.craft(player, 'craft_iron_sword', 2); // needs 4 iron bars
  assert.equal(failRes.success, false);
  assert.equal(failRes.reason, 'insufficient_materials');

  // Craft 1 Iron Sword
  const craftRes = engine.crafting.craft(player, 'craft_iron_sword', 1);
  assert.equal(craftRes.success, true);
  assert.equal(craftRes.resultItemId, 'iron_sword');
  assert.equal(craftRes.resultAmount, 1);

  // Verify items consumed & produced
  assert.equal(engine.inventory.hasItem(player, 'iron_bar', 1), false);
  assert.equal(engine.inventory.hasItem(player, 'wood_log', 1), false);
  assert.equal(engine.inventory.hasItem(player, 'iron_sword', 1), true);
});
