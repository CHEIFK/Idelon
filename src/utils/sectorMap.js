/**
 * Sector Registry & World Travel Utilities.
 * Single source of truth for all player-facing world navigation.
 * Platform-agnostic: only contains logical identifiers and gameplay metadata.
 */

export const WORLD_EXPLORATION_BONUS = 0.5;
export const OLDER_SECTOR_MULTIPLIER = 2;

export const SECTORS_REGISTRY = [
  {
    sector: 1,
    areaId: "starter_village",
    displayName: "Starter Village",
    requiredHeroLevel: 1,
    unlockType: "level",
    path: "mining",
    questId: null,
    icon: "starter_village",
    description: "A peaceful starting village for new adventurers."
  },
  {
    sector: 2,
    areaId: "lead_quarry",
    displayName: "Lead Quarry",
    requiredHeroLevel: 2,
    unlockType: "level",
    path: "mining",
    questId: null,
    icon: "lead_quarry",
    description: "A rocky quarry rich with lead deposits."
  },
  {
    sector: 3,
    areaId: "sand_dunes",
    displayName: "Sand Dunes",
    requiredHeroLevel: 3,
    unlockType: "level",
    path: "mining",
    questId: null,
    icon: "sand_dunes",
    description: "Arid desert dunes teeming with sand and bandits."
  },
  {
    sector: 4,
    areaId: "titanium_caverns",
    displayName: "Titanium Caverns",
    requiredHeroLevel: 5,
    unlockType: "level",
    path: "mining",
    questId: null,
    icon: "titanium_caverns",
    description: "Subterranean caverns laden with titanium ore."
  },
  {
    sector: 5,
    areaId: "beryllium_caves",
    displayName: "Beryllium Caves",
    requiredHeroLevel: 7,
    unlockType: "level",
    path: "mining",
    questId: null,
    icon: "beryllium_caves",
    description: "Glowing crystal caves containing rare beryllium."
  },
  {
    sector: 6,
    areaId: "thorium_depths",
    displayName: "Thorium Depths",
    requiredHeroLevel: 8,
    unlockType: "level",
    path: "mining",
    questId: null,
    icon: "thorium_depths",
    description: "Volatile depths radiating with thorium energy."
  },
  {
    sector: 7,
    areaId: "tungsten_core",
    displayName: "Tungsten Core",
    requiredHeroLevel: 9,
    unlockType: "level",
    path: "mining",
    questId: null,
    icon: "tungsten_core",
    description: "Dense molten core holding tungsten deposits."
  },
  {
    sector: 8,
    areaId: "whispering_woods",
    displayName: "Whispering Woods",
    requiredHeroLevel: 1,
    unlockType: "quest",
    path: "quest",
    questId: "chop_birch_quest",
    icon: "whispering_woods",
    description: "Ancient woodland home to wild wolves and timber."
  },
  {
    sector: 9,
    areaId: "iron_mines",
    displayName: "Iron Mines",
    requiredHeroLevel: 1,
    unlockType: "quest",
    path: "quest",
    questId: "first_steps",
    icon: "iron_mines",
    description: "Winding iron mines guarded by green slimes."
  },
  {
    sector: 10,
    areaId: "misty_mountains",
    displayName: "Misty Mountains",
    requiredHeroLevel: 2,
    unlockType: "level",
    path: "combat",
    questId: null,
    icon: "misty_mountains",
    description: "Fog-shrouded peaks inhabited by stone golems."
  },
  {
    sector: 11,
    areaId: "bandit_outpost",
    displayName: "Bandit Outpost",
    requiredHeroLevel: 3,
    unlockType: "level",
    path: "combat",
    questId: null,
    icon: "bandit_outpost",
    description: "Fortified camp of highway bandits and chief."
  },
  {
    sector: 12,
    areaId: "sunken_ruins",
    displayName: "Sunken Ruins",
    requiredHeroLevel: 5,
    unlockType: "level",
    path: "combat",
    questId: null,
    icon: "sunken_ruins",
    description: "Ancient flooded ruins overrun by skeletons."
  },
  {
    sector: 13,
    areaId: "dragon_spire",
    displayName: "Dragon Spire",
    requiredHeroLevel: 7,
    unlockType: "level",
    path: "combat",
    questId: null,
    icon: "dragon_spire",
    description: "Towering volcanic spire where drakes nest."
  },
  {
    sector: 14,
    areaId: "shadow_abyss",
    displayName: "Shadow Abyss",
    requiredHeroLevel: 8,
    unlockType: "level",
    path: "combat",
    questId: null,
    icon: "shadow_abyss",
    description: "Dark chasm filled with wraiths and vampires."
  },
  {
    sector: 15,
    areaId: "celestial_sanctuary",
    displayName: "Celestial Sanctuary",
    requiredHeroLevel: 10,
    unlockType: "level",
    path: "combat",
    questId: null,
    icon: "celestial_sanctuary",
    description: "Sacred realm guarded by demons and dragons."
  }
];

const resourceIntroCache = new Map();

export function clearSectorResourceCache() {
  resourceIntroCache.clear();
}

export function getResourceIntroSectorIndex(itemId, contentLoader) {
  if (resourceIntroCache.has(itemId)) {
    return resourceIntroCache.get(itemId);
  }

  if (!contentLoader) return 0;

  for (let i = 0; i < SECTORS_REGISTRY.length; i++) {
    const areaId = SECTORS_REGISTRY[i].areaId;
    const areaDef = contentLoader.getArea(areaId);
    if (!areaDef || !Array.isArray(areaDef.resourceIds)) continue;

    for (const resId of areaDef.resourceIds) {
      const resDef = contentLoader.getResource(resId);
      if (resDef && resDef.resourceItemId === itemId) {
        resourceIntroCache.set(itemId, i);
        return i;
      }
    }
  }

  resourceIntroCache.set(itemId, 0);
  return 0;
}

export function getGatheringQuantityMultiplier(player, itemId, contentLoader) {
  if (!player) return 1.0;

  const introSectorIndex = getResourceIntroSectorIndex(itemId, contentLoader);

  // Highest explored sector index based on player.visitedAreas
  const visited = Array.isArray(player.visitedAreas) ? player.visitedAreas : ['starter_village'];
  let highestExploredIdx = 0;
  for (const vArea of visited) {
    const idx = SECTORS_REGISTRY.findIndex(s => s.areaId === vArea);
    if (idx > highestExploredIdx) {
      highestExploredIdx = idx;
    }
  }

  const newSectors = Math.max(0, highestExploredIdx - introSectorIndex);
  const permanentMultiplier = 1.0 + (newSectors * WORLD_EXPLORATION_BONUS);

  const currentSectorIdx = SECTORS_REGISTRY.findIndex(s => s.areaId === player.currentAreaId);
  const isOlderSector = currentSectorIdx !== -1 && currentSectorIdx < highestExploredIdx;

  // Check if resource is native to player's current area
  let isNative = false;
  if (contentLoader && player.currentAreaId) {
    const currentAreaDef = contentLoader.getArea(player.currentAreaId);
    if (currentAreaDef && Array.isArray(currentAreaDef.resourceIds)) {
      for (const resId of currentAreaDef.resourceIds) {
        const resDef = contentLoader.getResource(resId);
        if (resDef && resDef.resourceItemId === itemId) {
          isNative = true;
          break;
        }
      }
    }
  }

  const locationMultiplier = (isOlderSector && isNative) ? OLDER_SECTOR_MULTIPLIER : 1.0;

  return permanentMultiplier * locationMultiplier;
}

export function getSectorByAreaId(areaId) {
  return SECTORS_REGISTRY.find(s => s.areaId === areaId) || null;
}

export function getSectorNumber(areaId) {
  const sector = getSectorByAreaId(areaId);
  if (!sector) return null;
  if (sector.sector === 1) return null; // Starter Village is not numbered
  return sector.sector.toString().padStart(2, '0');
}

export function getSectorName(areaId) {
  const sector = getSectorByAreaId(areaId);
  return sector ? sector.displayName : 'Unknown Area';
}

export function getSectorLabel(areaId) {
  const sector = getSectorByAreaId(areaId);
  if (!sector) return 'Unknown Area';
  if (sector.sector === 1) return sector.displayName;
  const num = sector.sector.toString().padStart(2, '0');
  return `Sector ${num} — ${sector.displayName}`;
}

export function getOrderedAreas(allAreasList) {
  // Sort based on the registry order
  return [...allAreasList].sort((a, b) => {
    const idxA = SECTORS_REGISTRY.findIndex(s => s.areaId === a.id);
    const idxB = SECTORS_REGISTRY.findIndex(s => s.areaId === b.id);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });
}

export function resolveSectorToAreaId(input) {
  if (!input) return null;
  const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Try to match sector number formats like "2", "02", "sector 2", "sector 02", "s2", "s02"
  const match = normalized.match(/^(?:sector\s*|s)?0*([1-9]\d*)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    const sector = SECTORS_REGISTRY.find(s => s.sector === num);
    if (sector) return sector.areaId;
  }
  
  // Try matching displayName or areaId exactly
  const byName = SECTORS_REGISTRY.find(s => 
    s.areaId.toLowerCase() === normalized || 
    s.areaId.toLowerCase().replace(/_/g, ' ') === normalized ||
    s.displayName.toLowerCase() === normalized
  );
  
  if (byName) return byName.areaId;
  
  return null; // Return null if not found
}

export function getActivityOwningAreaId(activityDef, contentLoader) {
  if (activityDef?.areaId) {
    return activityDef.areaId;
  }
  if (!contentLoader || !activityDef) return 'starter_village';

  for (const sector of SECTORS_REGISTRY) {
    const areaDef = contentLoader.getArea(sector.areaId);
    if (!areaDef || !Array.isArray(areaDef.resourceIds)) continue;

    for (const resId of areaDef.resourceIds) {
      const resNode = contentLoader.getResource(resId);
      if (!resNode) continue;
      if (resId === activityDef.id || resNode.id === activityDef.id || activityDef.id.includes(resId.replace('_node', ''))) {
        return sector.areaId;
      }
    }
  }

  return 'starter_village';
}

export function isMiningActivityUnlocked(player, activityDef, contentLoader) {
  const owningAreaId = getActivityOwningAreaId(activityDef, contentLoader);
  const visited = Array.isArray(player?.visitedAreas) ? player.visitedAreas : ['starter_village'];
  return visited.includes(owningAreaId);
}
