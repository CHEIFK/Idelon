export const COMBAT_XP_MIN = 50;
export const COMBAT_XP_MAX = 150;

export const ACTIVITIES = {
  MINING_IRON: 'mine_iron',
  WOODCUTTING_OAK: 'woodcut_oak',
  FISHING_RAW_FISH: 'fish_raw',
  HUNTING_SMALL_GAME: 'hunt_small_game'
};

export const CURRENCIES = {
  GOLD: 'gold',
  GEMS: 'gems'
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
  QUEST_ACCEPTED: 'quest:accepted',
  QUEST_PROGRESS: 'quest:progress',
  QUEST_COMPLETED: 'quest:completed',
  XP_GAINED: 'skill:xpGained',
  ITEM_ADDED: 'inventory:itemAdded',
  ITEM_REMOVED: 'inventory:itemRemoved',
  PLAYER_LEVEL_UP: 'player:level_up',
  ITEM_OBTAINED: 'item:obtained',
  PLAYER_DIED: 'player:died',
  BOSS_KILLED: 'boss:killed'
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
