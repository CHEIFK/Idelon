import { GameService } from './gameService.js';
import { DevService } from './devService.js';

export function createGameService(engine) {
  return new GameService(engine);
}

export function createDevService(gameService, devUserIds = [], enabled = true) {
  return new DevService(gameService, devUserIds, enabled);
}

export { GameService, DevService };
