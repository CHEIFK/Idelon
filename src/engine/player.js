import { CURRENT_SCHEMA_VERSION, migratePlayerSave } from '../../migrations/index.js';
import { DEFAULT_ATTRIBUTES } from './attributes.js';
import { getUnlockedAreaIdsForHeroLevel } from '../utils/sectorMap.js';

export function syncPlayerUnlockedAreas(player) {
  if (!player) return;

  // Rebuild the full persisted set so stale or future entries cannot survive.
  player.unlockedAreas = getUnlockedAreaIdsForHeroLevel(player.level);

  const unlocked = new Set(player.unlockedAreas);
  const visited = Array.isArray(player.visitedAreas) ? player.visitedAreas : [];
  player.visitedAreas = Array.from(new Set(
    ['starter_village', ...visited].filter(areaId => unlocked.has(areaId))
  ));

  if (!unlocked.has(player.currentAreaId)) {
    player.currentAreaId = 'starter_village';
  }
  if (!player.visitedAreas.includes(player.currentAreaId)) {
    player.visitedAreas.push(player.currentAreaId);
  }

  return player.unlockedAreas;
}

/**
 * Player module & entity definition with Data Integrity & Migration.
 */
export class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.createdTimestamp = Date.now();
    this.lastActiveTimestamp = Date.now();
    this.level = 1;
    this.heroXp = 0;
    this.currencies = { gold: 0, sterlings: 0 };
    this.attributes = { ...DEFAULT_ATTRIBUTES };
    this.activeBuffs = {};
    this.inventory = {};
    this.storage = {};
    this.skills = {};
    this.equipment = {};
    this.currentActivity = null;
    this.currentAreaId = 'starter_village';
    this.visitedAreas = ['starter_village'];
    this.unlockedAreas = ['starter_village'];
    this.tier = 1;
    this.rarity = 'Common';
    this.requiredSkill = null;
    this.schemaVersion = CURRENT_SCHEMA_VERSION;
  }
}

export class PlayerModule {
  constructor(database, contentLoader = null) {
    this.db = database;
    this.content = contentLoader;
  }

  create(id, name) {
    const player = new Player(id, name);
    syncPlayerUnlockedAreas(player);
    return player;
  }

  async load(id) {
    const rawData = await this.db.get('players', id);
    if (!rawData) return null;

    // Run automatic save migration & schema integrity repair
    const migratedData = migratePlayerSave(rawData);
    // The database key is authoritative. Never let a malformed payload take
    // ownership of another player's identity when it is loaded.
    if (typeof id === 'string' && id.length > 0) {
      migratedData.id = id;
    }
    const player = Object.assign(new Player(migratedData.id, migratedData.name), migratedData);

    this._synchronizeEquippedItems(player);

    syncPlayerUnlockedAreas(player);

    // Persist both schema migrations and repairs to current-version saves so
    // malformed state is not reintroduced on every load.
    const stateWasRepaired = JSON.stringify(rawData) !== JSON.stringify(player);
    if ((rawData.schemaVersion || 0) < CURRENT_SCHEMA_VERSION || stateWasRepaired) {
      await this.save(player);
    }

    return player;
  }

  _synchronizeEquippedItems(player) {
    if (!this.content || !player?.equipment || typeof player.equipment !== 'object') return;
    for (const item of Object.values(player.equipment)) {
      if (!item || typeof item.id !== 'string') continue;
      const definition = this.content.getEquipment(item.id);
      if (!definition) continue;
      const maxDurability = definition.maxDurability || 100;
      const durability = typeof item.durability === 'number' && Number.isFinite(item.durability)
        ? Math.max(0, Math.min(item.durability, maxDurability))
        : maxDurability;
      item.name = definition.name;
      item.slot = definition.slot;
      item.stats = { ...(definition.stats || {}) };
      item.maxDurability = maxDurability;
      item.durability = durability;
    }
  }

  async save(player) {
    syncPlayerUnlockedAreas(player);
    player.lastActiveTimestamp = Date.now();
    player.schemaVersion = CURRENT_SCHEMA_VERSION;
    await this.db.set('players', player.id, player);
    return true;
  }

  getStats(player) {
    return {
      id: player.id,
      name: player.name,
      level: player.level,
      currencies: { ...player.currencies }
    };
  }
}
