import { createRequire } from 'node:module';
import { Engine } from './engine/index.js';
import { createGameService } from './service/index.js';
import { createDiscordBot } from './discord/index.js';

const require = createRequire(import.meta.url);
const initialData = require('./data/initialData.json');

/**
 * Creates and initializes a new headless Game Engine instance.
 * @returns {Promise<Engine>}
 */
export async function createEngine(options = {}) {
  const engine = new Engine(initialData, options);
  await engine.init();
  return engine;
}

/**
 * Creates a new GameService facade initialized with the engine.
 * @returns {Promise<import('./service/gameService.js').GameService>}
 */
export async function createGameInstance(options = {}) {
  const engine = await createEngine(options);
  return createGameService(engine);
}

/**
 * Creates a Discord Bot client connected to GameService.
 */
export async function createDiscordBotInstance(options = {}) {
  const gameService = await createGameInstance(options);
  return createDiscordBot(gameService);
}

export { Engine };
export * from './discord/index.js';
export * from './service/index.js';
export * from './content/index.js';
export * from './constants/index.js';
export * from './events/index.js';
export * from './engine/player.js';
export * from './engine/inventory.js';
export * from './engine/skills.js';
export * from './engine/activities/index.js';
export * from './engine/combat/index.js';
export * from './engine/equipment.js';
export * from './engine/crafting.js';
export * from './engine/economy.js';
export * from './engine/world.js';
export * from './engine/saveSystem.js';
export * from './engine/rewards.js';
export * from './engine/potions.js';
export * from './engine/progression.js';
export * from './database/adapter.js';
