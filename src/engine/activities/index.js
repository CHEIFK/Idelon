import { GatheringActivity } from './gathering.js';
import { MiningActivity } from './mining.js';
import { WoodcuttingActivity } from './woodcutting.js';
import { FishingActivity } from './fishing.js';
import { HuntingActivity } from './hunting.js';

export class ActivitiesModule {
  constructor(engine = null) {
    this.engine = engine;
    this.gathering = new GatheringActivity(engine);
    this.mining = new MiningActivity(engine);
    this.woodcutting = new WoodcuttingActivity(engine);
    this.fishing = new FishingActivity(engine);
    this.hunting = new HuntingActivity(engine);
  }

  setEngine(engine) {
    this.engine = engine;
    this.gathering.setEngine(engine);
    this.mining.setEngine(engine);
    this.woodcutting.setEngine(engine);
    this.fishing.setEngine(engine);
    this.hunting.setEngine(engine);
  }

  start(player, activityId) {
    return this.gathering.start(player, activityId);
  }

  claim(player) {
    return this.gathering.claim(player);
  }

  stop(player) {
    return this.gathering.stop(player);
  }
}

export { GatheringActivity, MiningActivity, WoodcuttingActivity, FishingActivity, HuntingActivity };
