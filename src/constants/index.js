export const COMBAT_XP_MIN = 50;
export const COMBAT_XP_MAX = 150;

export const MAX_OFFLINE_MINING_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours base cap
export const OFFLINE_MINING_CAP_MS = MAX_OFFLINE_MINING_DURATION_MS;

export const ACTIVITIES = {
  MINING_IRON: 'mine_iron',
  WOODCUTTING_OAK: 'woodcut_oak',
  FISHING_RAW_FISH: 'fish_shrimp',
  HUNTING_SMALL_GAME: 'hunt_game'
};

export const CURRENCIES = {
  GOLD: 'gold',
  STERLINGS: 'sterlings'
};

export const EVENTS = {
  ACTIVITY_STARTED: 'activity:started',
  ACTIVITY_COMPLETED: 'activity:completed',
  CRAFTING_STARTED: 'crafting:started',
  CRAFTING_COMPLETED: 'crafting:completed',
  EQUIPMENT_EQUIPPED: 'equipment:equipped',
  EQUIPMENT_UNEQUIPPED: 'equipment:unequipped',
  COMBAT_STARTED: 'combat:started',
  COMBAT_TURN: 'combat:turn',
  COMBAT_VICTORY: 'combat:victory',
  COMBAT_DEFEAT: 'combat:defeat',
  COMBAT_LOOT_RECEIVED: 'combat:lootReceived',
  NPC_TALKED: 'npc:talked',
  AREA_ENTERED: 'area:entered',
  XP_GAINED: 'skill:xpGained',
  ITEM_ADDED: 'inventory:itemAdded',
  ITEM_REMOVED: 'inventory:itemRemoved',
  PLAYER_LEVEL_UP: 'player:level_up',
  ITEM_OBTAINED: 'item:obtained',
  PLAYER_DIED: 'player:died',
  BOSS_KILLED: 'boss:killed',
  POTION_USED: 'potion:used'
};

export const EQUIPMENT_SLOTS = [
  'weapon',
  'helmet',
  'chest',
  'legs',
  'boots',
  'gloves',
  'ring',
  'amulet',
  'shield'
];

export const SINGLE_RESOURCE_MINING_SPEED_MULTIPLIER = 3;
export const AUTO_MINING_SPEED_MULTIPLIER = 1;

export const AUTO_HUNT_CYCLE_MS = 30000; // 30 seconds per auto-hunt cycle
export const SINGLE_HUNT_SPEED_MULTIPLIER = 3;
export const AUTO_HUNT_SPEED_MULTIPLIER = 1;

export function getActivitySpeedMultiplier(activityState, player = null, potionModule = null) {
  if (!activityState) return 1;
  let baseMultiplier;
  if (activityState.mode === 'auto') baseMultiplier = AUTO_MINING_SPEED_MULTIPLIER;
  else if (activityState.skillId === 'mining' || (activityState.id && activityState.id.startsWith('mine_'))) {
    baseMultiplier = SINGLE_RESOURCE_MINING_SPEED_MULTIPLIER;
  } else {
    baseMultiplier = 1;
  }

  const hastePercent = potionModule && player && typeof potionModule.getModifier === 'function'
    ? potionModule.getModifier(player, 'haste')
    : 0;
  const hasteMultiplier = 1 + Math.max(0, hastePercent) / 100;
  return baseMultiplier * hasteMultiplier;
}
