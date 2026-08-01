import { migrate001 } from './001-add-tier.js';
import { migrate002 } from './002-add-rarity.js';
import { migrate003 } from './003-add-requiredSkill.js';
import { migrate004 } from './004-add-sterlings.js';
import { migrate005 } from './005-refactor-currencies.js';
import { getHeroLevel } from '../src/engine/progression.js';

export const CURRENT_SCHEMA_VERSION = 5;

/**
 * Migration Manager & Data Integrity Infrastructure.
 */
export function migratePlayerSave(rawSave) {
  if (!rawSave || typeof rawSave !== 'object') {
    console.warn('[MIGRATION] Corrupted or invalid save payload. Repairing with default save schema...');
    return createDefaultPlayerSave('usr_default', 'Default Adventurer');
  }

  let data = { ...rawSave };
  let currentVersion = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  if (currentVersion < 1) {
    data = migrate001(data);
  }
  if (currentVersion < 2) {
    data = migrate002(data);
  }
  if (currentVersion < 3) {
    data = migrate003(data);
  }
  if (currentVersion < 4) {
    data = migrate004(data);
  }
  if (currentVersion < 5) {
    data = migrate005(data);
  }

  // Ensure default fallbacks for missing properties
  data.id             = data.id || 'usr_unknown';
  data.name           = data.name || 'Unknown Adventurer';
  data.currentAreaId  = data.currentAreaId || 'starter_village';
  data.inventory      = data.inventory  && typeof data.inventory  === 'object' ? data.inventory  : {};
  data.storage        = data.storage    && typeof data.storage    === 'object' ? data.storage    : {};
  data.equipment      = data.equipment  && typeof data.equipment  === 'object' ? data.equipment  : {};
  data.skills         = data.skills     && typeof data.skills     === 'object' ? data.skills     : {};
  
  const totalSkillXp  = Object.values(data.skills).reduce((sum, s) => sum + (s?.xp || 0), 0);
  data.heroXp         = typeof data.heroXp === 'number' ? Math.max(data.heroXp, totalSkillXp) : totalSkillXp;
  data.level          = getHeroLevel(data.heroXp);

  data.currencies     = data.currencies && typeof data.currencies === 'object' ? data.currencies : { gold: 0, sterlings: 0 };
  data.currencies.gold      = typeof data.currencies.gold === 'number' ? data.currencies.gold : 0;
  data.currencies.sterlings = typeof data.currencies.sterlings === 'number' ? data.currencies.sterlings : 0;
  delete data.sterlings;
  delete data.currencies.gems;

  // Ensure visitedAreas is an array containing starter_village with no duplicates
  if (!Array.isArray(data.visitedAreas)) {
    data.visitedAreas = ['starter_village'];
  } else {
    data.visitedAreas = Array.from(new Set(['starter_village', ...data.visitedAreas]));
  }

  data.schemaVersion  = CURRENT_SCHEMA_VERSION;

  return data;
}

export function validatePlayerSave(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    errors.push('Save payload is not an object.');
    return { valid: false, errors, warnings };
  }

  if (!data.id)   errors.push("Missing required field 'id'.");
  if (!data.name) errors.push("Missing required field 'name'.");
  if (typeof data.schemaVersion !== 'number') {
    warnings.push("Missing 'schemaVersion', assuming legacy save.");
  } else if (data.schemaVersion < CURRENT_SCHEMA_VERSION) {
    warnings.push(`Save schemaVersion (${data.schemaVersion}) is behind current (${CURRENT_SCHEMA_VERSION}). Migration required.`);
  }

  if (!data.inventory  || typeof data.inventory  !== 'object') warnings.push("Missing or invalid 'inventory' object.");
  if (!data.storage    || typeof data.storage    !== 'object') warnings.push("Missing or invalid 'storage' object.");
  if (!data.currencies || typeof data.currencies !== 'object') warnings.push("Missing or invalid 'currencies' object.");

  return { valid: errors.length === 0, errors, warnings };
}

export function createDefaultPlayerSave(id = 'usr_123', name = 'Hero') {
  return {
    id,
    name,
    level: 1,
    heroXp: 0,
    currentAreaId: 'starter_village',
    visitedAreas: ['starter_village'],
    inventory: {},
    storage: {},
    equipment: {},
    skills: {},
    currencies: { gold: 0, sterlings: 0 },
    tier: 1,
    rarity: 'Common',
    requiredSkill: null,
    schemaVersion: CURRENT_SCHEMA_VERSION
  };
}
