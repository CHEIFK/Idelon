/**
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {Record<string, number>} currencies
 * @property {Record<string, number>} inventory
 * @property {Record<string, {xp: number, level: number}>} skills
 * @property {Record<string, any>} equipment
 * @property {Record<string, any>} quests
 * @property {ActivityState | null} currentActivity
 */

/**
 * @typedef {Object} ActivityState
 * @property {string} id
 * @property {number} startTime
 * @property {number} lastClaimed
 */

/**
 * @typedef {Object} ItemDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {number} [value]
 * @property {string} [slot]
 */

export {};
