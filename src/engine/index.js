import { DatabaseAdapter } from '../database/adapter.js';
import { gameEvents } from '../events/index.js';
import { ContentLoader } from '../content/index.js';
import { PlayerModule } from './player.js';
import { InventoryModule } from './inventory.js';
import { SkillsModule } from './skills.js';
import { ActivitiesModule } from './activities/index.js';
import { CombatModule } from './combat/index.js';
import { EquipmentModule } from './equipment.js';
import { CraftingModule } from './crafting.js';
import { EconomyModule } from './economy.js';
import { WorldModule } from './world.js';
import { SaveSystemModule } from './saveSystem.js';
import { RewardsModule } from './rewards.js';
import { AttributeModule } from './attributes.js';
import { PotionModule } from './potions.js';

export class Engine {
  constructor(gameData = {}, options = {}) {
    this.data = gameData;
    this.events = gameEvents;
    this.database = new DatabaseAdapter(options.databasePath);
    this.content = new ContentLoader();
    
    // Core Engine Sub-modules
    this.player = new PlayerModule(this.database, this.content);
    this.attributes = new AttributeModule(this);
    this.potions = new PotionModule(this);
    this.inventory = new InventoryModule();
    this.skills = new SkillsModule(this);
    this.activities = new ActivitiesModule(this);
    this.combat = new CombatModule(this);
    this.equipment = new EquipmentModule(this);
    this.crafting = new CraftingModule(this);
    this.economy = new EconomyModule();
    this.world = new WorldModule(this);
    this.saveSystem = new SaveSystemModule(this.database, this.player);
    this.rewards = new RewardsModule();
  }

  async init() {
    await this.database.connect();
    this.content.loadAll();
    return this;
  }

  async shutdown() {
    await this.database.disconnect();
  }
}
