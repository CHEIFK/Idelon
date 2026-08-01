import { GatheringActivity } from './gathering.js';

export class WoodcuttingActivity extends GatheringActivity {
  startWoodcutting(player, activityId = 'woodcut_oak', contentLoader, eventsBus) {
    return this.start(player, activityId, contentLoader, eventsBus);
  }
}
