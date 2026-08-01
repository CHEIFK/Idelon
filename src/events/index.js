import { EventEmitter } from 'node:events';

/**
 * Engine Event Bus for decoupling state changes from UI listeners (Discord, Web, etc.)
 */
export class EngineEventEmitter extends EventEmitter {}

export const gameEvents = new EngineEventEmitter();
