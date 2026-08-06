import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/index.js';
import { GameService } from '../src/service/gameService.js';
import { calculateDamage } from '../src/engine/combat/damage.js';
import { createTravelSuccessEmbed, createInstantCombatEmbed } from '../src/discord/embeds.js';

test('Instant Hunt (.hunt): fights all enemies from visited areas instantly', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_autohunt_1', username: 'HunterOne' };
  await gameService.start(user.id, user.username);

  // Execute instant hunt
  const result = await gameService.huntInstant(user.id);
  assert.equal(result.success, true);
  assert.ok(result.enemiesDefeated.length > 0, 'Should include starter village enemies');

  const player = await gameService.getPlayer(user.id);
  assert.equal(player.currentHunt, undefined, 'player.currentHunt should not exist');
});

test('Focused Instant Hunt (.hunt goblin): fights matching enemies instantly', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_focusedhunt_1', username: 'GoblinSlayer' };
  await gameService.start(user.id, user.username);

  const result = await gameService.huntInstant(user.id, 'goblin');
  assert.equal(result.success, true);
  assert.ok(result.enemiesDefeated.length > 0);
  assert.ok(result.enemiesDefeated.every(e => e.id.includes('goblin')), 'All defeated enemies should be goblins');
});

test('Instant Hunt dynamically includes new monsters after travelling', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_travel_hunt', username: 'Explorer' };
  await gameService.start(user.id, user.username);

  // Level up player to allow travel to sector 3 (sand_dunes)
  const playerBefore = await gameService.getPlayer(user.id);
  playerBefore.heroXp = 5000;
  playerBefore.level = 5;
  await gameService.savePlayer(playerBefore);

  // Travel to sand_dunes (Sector 3)
  await gameService.travel(user.id, 'sand_dunes');

  const result = await gameService.huntInstant(user.id);
  assert.equal(result.success, true);
  assert.ok(result.enemiesDefeated.some(e => e.id === 'bandit'), 'Bandit should be defeated in sand dunes');
});

test('Instant Hunt rewards: accumulates XP, gold, and drops instantly', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_claim_hunt', username: 'LootCollector' };
  await gameService.start(user.id, user.username);

  // Boost player level & stats so player wins fights easily
  const player = await gameService.getPlayer(user.id);
  player.level = 10;
  await gameService.savePlayer(player);

  const claimRes = await gameService.huntInstant(user.id);
  assert.ok(claimRes.enemiesDefeated.length > 0, 'Should have defeated enemies');
  assert.ok(claimRes.xpGained > 0, 'Should have earned XP');
  assert.ok(claimRes.currenciesGained.gold > 0, 'Should have looted gold');
});

test('Equipment Durability & Auto-Replacement on breakage', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_durability', 'Knight');

  // Add equipment with low durability
  engine.inventory.addItem(player, 'bronze_sword', 1);
  engine.equipment.equip(player, 'bronze_sword');

  // Set durability to 1
  player.equipment.weapon.durability = 1;

  // Add backup iron_sword to inventory
  engine.inventory.addItem(player, 'iron_sword', 1);

  // Reduce durability by 5 (should break bronze_sword and auto-equip iron_sword)
  const res = engine.equipment.reduceDurability(player, 5, engine.content, engine.inventory, engine.events);
  assert.equal(res.broken.length, 1);
  assert.equal(res.broken[0].itemId, 'bronze_sword');
  assert.equal(player.equipment.weapon.id, 'iron_sword', 'Should auto-equip iron_sword from inventory');
});

test('Auto-Equip Best: automatically equips superior gear looted into inventory', async () => {
  const engine = await createEngine();
  const player = engine.player.create('usr_auto_equip', 'Hero');
  player.level = 5;

  // Equip bronze sword
  engine.inventory.addItem(player, 'bronze_sword', 1);
  engine.equipment.equip(player, 'bronze_sword');
  assert.equal(player.equipment.weapon.id, 'bronze_sword');

  // Add iron sword to inventory and call autoEquipBest
  engine.inventory.addItem(player, 'iron_sword', 1);
  const equipRes = engine.equipment.autoEquipBest(player, engine.content, engine.inventory, engine.events);
  assert.equal(equipRes.equipped.length, 1);
  assert.equal(equipRes.equipped[0].newItem.id, 'iron_sword');
  assert.equal(player.equipment.weapon.id, 'iron_sword');
  assert.equal(player.inventory['bronze_sword'], 1, 'Previous gear moved to inventory');
});

test('Strength attribute increases damage output in combat calculations', () => {
  const weakAttacker = { attack: 10, strength: 0 };
  const strongAttacker = { attack: 10, strength: 10 };
  const defender = { defense: 2 };

  const weakDmg = calculateDamage(weakAttacker, defender, false);
  const strongDmg = calculateDamage(strongAttacker, defender, false);

  assert.ok(strongDmg > weakDmg, `Strong damage (${strongDmg}) should exceed weak damage (${weakDmg})`);
  assert.equal(strongDmg - weakDmg, 15, '10 strength * 1.5 = 15 extra damage');
});

test('Player death during instant hunt respawns with 1 HP', async () => {
  const engine = await createEngine();
  const gameService = new GameService(engine);
  const user = { id: 'usr_death_test', username: 'FallenHero' };
  await gameService.start(user.id, user.username);

  // Unlock tungsten_core and set combat level so dark_knight is accessible
  const player = await gameService.getPlayer(user.id);
  player.heroXp = 43600; // Hero level 30 unlocks Tungsten Core
  player.level = 30;
  player.skills = player.skills || {};
  player.skills.combat = { level: 10, xp: 5000 };
  player.visitedAreas.push('tungsten_core');
  player.currentAreaId = 'tungsten_core';
  player.hp = 1;
  await gameService.savePlayer(player);

  const res = await gameService.huntInstant(user.id, 'dark_knight');
  assert.equal(res.playerDied, true);

  const pAfter = await gameService.getPlayer(user.id);
  assert.equal(pAfter.hp, 1, 'Player should respawn with 1 HP');
});

test('Travel embed displays both mineable resources AND native monsters with tips', async () => {
  const engine = await createEngine();
  const embed = createTravelSuccessEmbed('starter_village', 'sand_dunes', engine.content);

  assert.ok(embed.description.includes('New Resources'), 'Should show resources');
  assert.ok(embed.description.includes('Sand'), 'Should mention Sand');
  assert.ok(embed.description.includes('Monsters Here'), 'Should show monsters section');
  assert.ok(embed.description.includes('Highway Bandit') || embed.description.includes('Bandit'), 'Should mention Bandit');
  assert.ok(embed.description.includes('.hunt'), 'Should include .hunt tip');
  assert.ok(embed.description.includes('.mine'), 'Should include .mine tip');
});
