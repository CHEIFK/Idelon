import { CURRENT_SCHEMA_VERSION, migratePlayerSave } from '../../migrations/index.js';

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
    this.inventory = {};
    this.storage = {};
    this.skills = {};
    this.equipment = {};
    this.quests = {};
    this.currentActivity = null;
    this.currentAreaId = 'starter_village';
    this.visitedAreas = ['starter_village'];
    this.tier = 1;
    this.rarity = 'Common';
    this.requiredSkill = null;
    this.schemaVersion = CURRENT_SCHEMA_VERSION;
  }
}

export class PlayerModule {
  constructor(database) {
    this.db = database;
  }

  create(id, name) {
    return new Player(id, name);
  }

  async load(id) {
    const rawData = await this.db.get('players', id);
    if (!rawData) return null;

    // Run automatic save migration & schema integrity repair
    const migratedData = migratePlayerSave(rawData);
    const player = Object.assign(new Player(migratedData.id, migratedData.name), migratedData);
    
    // Auto-save migrated save state if schema version was updated
    if ((rawData.schemaVersion || 0) < CURRENT_SCHEMA_VERSION) {
      await this.save(player);
    }

    return player;
  }

  async save(player) {
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
