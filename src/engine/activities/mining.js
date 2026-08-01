import { GatheringActivity } from './gathering.js';

export class MiningActivity extends GatheringActivity {
  startMining(player, activityId = 'mine_iron', contentLoader, eventsBus) {
    return this.start(player, activityId, contentLoader, eventsBus);
  }
}
