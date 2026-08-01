import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, EVENTS } from '../src/index.js';

test('Equipment system equip, inventory swap, stat aggregation, and events', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_hero_gear', 'GearHero');

  // Add items to inventory
  engine.inventory.addItem(player, 'iron_pickaxe', 1);
  engine.inventory.addItem(player, 'iron_sword', 1);
  engine.inventory.addItem(player, 'iron_helmet', 1);
  engine.inventory.addItem(player, 'lumberjack_ring', 1);

  const eventsRecorded = [];
  engine.events.on(EVENTS.EQUIPMENT_EQUIPPED, (d) => eventsRecorded.push({ type: EVENTS.EQUIPMENT_EQUIPPED, d }));
  engine.events.on(EVENTS.EQUIPMENT_UNEQUIPPED, (d) => eventsRecorded.push({ type: EVENTS.EQUIPMENT_UNEQUIPPED, d }));

  // 1. Equip Iron Pickaxe into weapon slot
  const equipRes1 = engine.equipment.equip(player, 'iron_pickaxe');
  assert.equal(equipRes1.success, true);
  assert.equal(equipRes1.slot, 'weapon');
  assert.equal(engine.inventory.hasItem(player, 'iron_pickaxe', 1), false);
  assert.equal(player.equipment.weapon.id, 'iron_pickaxe');

  // Check stats
  let stats = engine.equipment.getTotalStats(player);
  assert.equal(stats.miningPower, 15);
  assert.equal(stats.attack, 5);

  // 2. Equip Iron Sword into weapon slot (swaps out Iron Pickaxe!)
  const equipRes2 = engine.equipment.equip(player, 'iron_sword');
  assert.equal(equipRes2.success, true);
  assert.equal(equipRes2.unequipped.id, 'iron_pickaxe');
  assert.equal(engine.inventory.hasItem(player, 'iron_pickaxe', 1), true); // Returned to inventory!
  assert.equal(engine.inventory.hasItem(player, 'iron_sword', 1), false); // Removed from inventory!

  stats = engine.equipment.getTotalStats(player);
  assert.equal(stats.attack, 10);
  assert.equal(stats.criticalChance, 0.05);
  assert.equal(stats.miningPower || 0, 0);

  // 3. Equip Helmet and Ring
  engine.equipment.equip(player, 'iron_helmet');
  engine.equipment.equip(player, 'lumberjack_ring');

  stats = engine.equipment.getTotalStats(player);
  assert.equal(stats.attack, 10);
  assert.equal(stats.defense, 8);
  assert.equal(stats.health, 20);
  assert.equal(stats.woodcuttingPower, 10);
  assert.equal(stats.luck, 3);

  // 4. Unequip Helmet
  const unequipRes = engine.equipment.unequip(player, 'helmet');
  assert.equal(unequipRes.success, true);
  assert.equal(unequipRes.unequipped.id, 'iron_helmet');
  assert.equal(engine.inventory.hasItem(player, 'iron_helmet', 1), true);
  assert.equal(player.equipment.helmet, undefined);

  // Check event logs
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.EQUIPMENT_EQUIPPED), true);
  assert.equal(eventsRecorded.some(e => e.type === EVENTS.EQUIPMENT_UNEQUIPPED), true);
});

test('Prevent equipping items not in inventory or invalid items', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_gear_fail', 'FailHero');

  // Try equipping item not in inventory
  const res1 = engine.equipment.equip(player, 'iron_pickaxe');
  assert.equal(res1.success, false);
  assert.equal(res1.reason, 'item_not_in_inventory');

  // Try equipping non-equipable item (e.g. iron_ore)
  engine.inventory.addItem(player, 'iron_ore', 1);
  const res2 = engine.equipment.equip(player, 'iron_ore');
  assert.equal(res2.success, false);
  assert.equal(res2.reason, 'not_equipable');
});
