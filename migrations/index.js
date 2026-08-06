import { migrate001 } from './001-add-tier.js';
import { migrate002 } from './002-add-rarity.js';
import { migrate003 } from './003-add-requiredSkill.js';
import { migrate004 } from './004-add-sterlings.js';
import { migrate005 } from './005-refactor-currencies.js';
import { migrate006 } from './006-add-hero-attributes.js';
import { migrate007 } from './007-add-active-buffs.js';
import { DEFAULT_ATTRIBUTES } from '../src/engine/attributes.js';
import { getHeroLevel } from '../src/engine/progression.js';
import { SECTORS_REGISTRY, getUnlockedAreaIdsForHeroLevel } from '../src/utils/sectorMap.js';

export const CURRENT_SCHEMA_VERSION = 7;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStackMap(value) {
  if (!isRecord(value)) return {};
  const result = {};
  for (const [itemId, quantity] of Object.entries(value)) {
    if (!itemId || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) continue;
    const wholeQuantity = Math.floor(quantity);
    if (Number.isSafeInteger(wholeQuantity) && wholeQuantity > 0) result[itemId] = wholeQuantity;
  }
  return result;
}

function normalizeSkills(value) {
  if (!isRecord(value)) return {};
  const result = {};
  for (const [skillId, rawSkill] of Object.entries(value)) {
    if (!skillId || !isRecord(rawSkill)) continue;
    const hasValidXp = typeof rawSkill.xp === 'number' && Number.isFinite(rawSkill.xp) && rawSkill.xp >= 0;
    const xp = hasValidXp ? Math.min(rawSkill.xp, Number.MAX_SAFE_INTEGER) : 0;
    const rawLevel = typeof rawSkill.level === 'number' && Number.isFinite(rawSkill.level) && rawSkill.level >= 1
      ? Math.floor(rawSkill.level)
      : 1;
    // Existing saves may contain a deliberately progressed skill with an XP
    // value from an older table. Preserve that valid level, but never allow
    // malformed XP to preserve a malformed level.
    result[skillId] = { xp, level: hasValidXp ? Math.min(rawLevel, 100) : getHeroLevel(xp) };
  }
  return result;
}

function normalizeEquipment(value) {
  if (!isRecord(value)) return {};
  const result = {};
  for (const [slot, rawItem] of Object.entries(value)) {
    if (!slot || !rawItem) continue;
    const item = typeof rawItem === 'string' ? { id: rawItem } : rawItem;
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id) continue;
    const stats = isRecord(item.stats)
      ? Object.fromEntries(Object.entries(item.stats).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)))
      : {};
    const maxDurability = typeof item.maxDurability === 'number' && Number.isFinite(item.maxDurability) && item.maxDurability > 0
      ? item.maxDurability
      : 100;
    const durability = typeof item.durability === 'number' && Number.isFinite(item.durability)
      ? Math.max(0, Math.min(item.durability, maxDurability))
      : maxDurability;
    result[slot] = {
      id: item.id,
      name: typeof item.name === 'string' ? item.name : item.id,
      slot: typeof item.slot === 'string' ? item.slot : slot,
      stats,
      durability,
      maxDurability
    };
  }
  return result;
}

function normalizeActiveBuffs(value) {
  if (!isRecord(value)) return {};

  const result = {};
  for (const [buffType, rawBuff] of Object.entries(value)) {
    if (!buffType || !isRecord(rawBuff)) continue;

    const amount = typeof rawBuff.amount === 'number' && Number.isFinite(rawBuff.amount) && rawBuff.amount > 0
      ? rawBuff.amount
      : null;
    const expiresAt = typeof rawBuff.expiresAt === 'number' && Number.isFinite(rawBuff.expiresAt) && rawBuff.expiresAt > 0
      ? rawBuff.expiresAt
      : null;
    if (amount === null || expiresAt === null) continue;

    const durationMs = typeof rawBuff.durationMs === 'number' && Number.isFinite(rawBuff.durationMs) && rawBuff.durationMs > 0
      ? rawBuff.durationMs
      : Math.max(1, expiresAt - Date.now());
    const lastAppliedAt = typeof rawBuff.lastAppliedAt === 'number' && Number.isFinite(rawBuff.lastAppliedAt) && rawBuff.lastAppliedAt > 0
      ? rawBuff.lastAppliedAt
      : Date.now();

    result[buffType] = {
      potionType: typeof rawBuff.potionType === 'string' && rawBuff.potionType ? rawBuff.potionType : buffType,
      stat: typeof rawBuff.stat === 'string' && rawBuff.stat ? rawBuff.stat : buffType,
      amount,
      durationMs,
      expiresAt,
      lastAppliedAt,
      ...(typeof rawBuff.effectLabel === 'string' && rawBuff.effectLabel
        ? { effectLabel: rawBuff.effectLabel }
        : {}),
      ...(typeof rawBuff.sourcePotionId === 'string' && rawBuff.sourcePotionId
        ? { sourcePotionId: rawBuff.sourcePotionId }
        : {})
    };
  }
  return result;
}

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
  if (currentVersion < 6) {
    data = migrate006(data);
  }
  if (currentVersion < 7) {
    data = migrate007(data);
  }

  // Ensure default fallbacks for missing properties
  data.id             = typeof data.id === 'string' && data.id ? data.id : 'usr_unknown';
  data.name           = typeof data.name === 'string' && data.name ? data.name : 'Unknown Adventurer';
  const validAreaIds = new Set(SECTORS_REGISTRY.map(sector => sector.areaId));
  data.currentAreaId  = validAreaIds.has(data.currentAreaId) ? data.currentAreaId : 'starter_village';
  data.inventory      = normalizeStackMap(data.inventory);
  data.storage        = normalizeStackMap(data.storage);
  data.equipment      = normalizeEquipment(data.equipment);
  data.skills         = normalizeSkills(data.skills);
  data.activeBuffs    = normalizeActiveBuffs(data.activeBuffs);
  
  data.attributes     = {
    ...DEFAULT_ATTRIBUTES,
    ...(data.attributes && typeof data.attributes === 'object' ? data.attributes : {})
  };

  const totalSkillXp  = Object.values(data.skills).reduce(
    (sum, s) => Math.min(Number.MAX_SAFE_INTEGER, sum + s.xp),
    0
  );
  const savedHeroXp = typeof data.heroXp === 'number' && Number.isFinite(data.heroXp) && data.heroXp >= 0
    ? Math.min(data.heroXp, Number.MAX_SAFE_INTEGER)
    : 0;
  data.heroXp         = Math.max(savedHeroXp, totalSkillXp);
  data.level          = getHeroLevel(data.heroXp);

  data.currencies     = isRecord(data.currencies) ? data.currencies : { gold: 0, sterlings: 0 };
  data.currencies.gold      = typeof data.currencies.gold === 'number' && Number.isFinite(data.currencies.gold) && data.currencies.gold <= Number.MAX_SAFE_INTEGER ? Math.max(0, data.currencies.gold) : 0;
  data.currencies.sterlings = typeof data.currencies.sterlings === 'number' && Number.isFinite(data.currencies.sterlings) && data.currencies.sterlings <= Number.MAX_SAFE_INTEGER ? Math.max(0, data.currencies.sterlings) : 0;
  delete data.sterlings;
  delete data.currencies.gems;

  // Ensure visitedAreas is an array containing starter_village with no duplicates
  if (!Array.isArray(data.visitedAreas)) {
    data.visitedAreas = ['starter_village'];
  } else {
    data.visitedAreas = Array.from(new Set(['starter_village', ...data.visitedAreas.filter(areaId => validAreaIds.has(areaId))]));
  }
  data.unlockedAreas = getUnlockedAreaIdsForHeroLevel(data.level);
  const unlockedAreaIds = new Set(data.unlockedAreas);
  data.visitedAreas = data.visitedAreas.filter(areaId => unlockedAreaIds.has(areaId));
  if (!unlockedAreaIds.has(data.currentAreaId)) {
    data.currentAreaId = 'starter_village';
  }
  if (!data.visitedAreas.includes(data.currentAreaId)) {
    data.visitedAreas.push(data.currentAreaId);
  }

  if (isRecord(data.currentActivity)) {
    const activity = data.currentActivity;
    const validSingle = typeof activity.id === 'string' && activity.id.length > 0;
    const validAuto = activity.mode === 'auto' && Array.isArray(activity.ids) && activity.ids.length > 0 && activity.ids.every(id => typeof id === 'string' && id.length > 0);
    if (!validSingle && !validAuto) {
      data.currentActivity = null;
    } else {
      const now = Date.now();
      activity.startTime = typeof activity.startTime === 'number' && Number.isFinite(activity.startTime)
        ? Math.max(0, Math.min(activity.startTime, now))
        : now;
      activity.lastClaimed = typeof activity.lastClaimed === 'number' && Number.isFinite(activity.lastClaimed)
        ? Math.max(0, Math.min(activity.lastClaimed, now))
        : activity.startTime;
      if (validAuto) {
        activity.ids = Array.from(new Set(activity.ids));
        const rawStartedAt = isRecord(activity.activityStartedAt) ? activity.activityStartedAt : {};
        activity.activityStartedAt = Object.fromEntries(Object.entries(rawStartedAt)
          .filter(([id, value]) => activity.ids.includes(id) && typeof value === 'number' && Number.isFinite(value))
          .map(([id, value]) => [id, Math.max(activity.lastClaimed, Math.min(value, now))]));
      }
    }
  } else {
    data.currentActivity = null;
  }

  data.attributes = Object.fromEntries(Object.entries(data.attributes).map(([key, value]) => [
    key,
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : (DEFAULT_ATTRIBUTES[key] || 1)
  ]));

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
    unlockedAreas: ['starter_village'],
    inventory: {},
    storage: {},
    equipment: {},
    skills: {},
    currencies: { gold: 0, sterlings: 0 },
    attributes: { ...DEFAULT_ATTRIBUTES },
    activeBuffs: {},
    tier: 1,
    rarity: 'Common',
    requiredSkill: null,
    schemaVersion: CURRENT_SCHEMA_VERSION
  };
}
