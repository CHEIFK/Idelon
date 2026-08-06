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
    icon: "starter_village",
    description: "A peaceful starting village for new adventurers."
  },
  {
    sector: 2,
    areaId: "lead_quarry",
    displayName: "Lead Quarry",
    requiredHeroLevel: 5,
    icon: "lead_quarry",
    description: "A rocky quarry rich with lead deposits."
  },
  {
    sector: 3,
    areaId: "sand_dunes",
    displayName: "Sand Dunes",
    requiredHeroLevel: 10,
    icon: "sand_dunes",
    description: "Arid desert dunes teeming with sand and bandits."
  },
  {
    sector: 4,
    areaId: "titanium_caverns",
    displayName: "Titanium Caverns",
    requiredHeroLevel: 15,
    icon: "titanium_caverns",
    description: "Subterranean caverns laden with titanium ore."
  },
  {
    sector: 5,
    areaId: "beryllium_caves",
    displayName: "Beryllium Caves",
    requiredHeroLevel: 20,
    icon: "beryllium_caves",
    description: "Glowing crystal caves containing rare beryllium."
  },
  {
    sector: 6,
    areaId: "thorium_depths",
    displayName: "Thorium Depths",
    requiredHeroLevel: 25,
    icon: "thorium_depths",
    description: "Volatile depths radiating with thorium energy."
  },
  {
    sector: 7,
    areaId: "tungsten_core",
    displayName: "Tungsten Core",
    requiredHeroLevel: 30,
    icon: "tungsten_core",
    description: "Dense molten core holding tungsten deposits."
  },
  {
    sector: 8,
    areaId: "whispering_woods",
    displayName: "Whispering Woods",
    requiredHeroLevel: 35,
    icon: "whispering_woods",
    description: "Ancient woodland home to wild wolves and timber."
  },
  {
    sector: 9,
    areaId: "iron_mines",
    displayName: "Iron Mines",
    requiredHeroLevel: 40,
    icon: "iron_mines",
    description: "Winding iron mines guarded by green slimes."
  },
  {
    sector: 10,
    areaId: "misty_mountains",
    displayName: "Misty Mountains",
    requiredHeroLevel: 45,
    icon: "misty_mountains",
    description: "Fog-shrouded peaks inhabited by stone golems."
  },
  {
    sector: 11,
    areaId: "bandit_outpost",
    displayName: "Bandit Outpost",
    requiredHeroLevel: 50,
    icon: "bandit_outpost",
    description: "Fortified camp of highway bandits and chief."
  },
  {
    sector: 12,
    areaId: "sunken_ruins",
    displayName: "Sunken Ruins",
    requiredHeroLevel: 55,
    icon: "sunken_ruins",
    description: "Ancient flooded ruins overrun by skeletons."
  },
  {
    sector: 13,
    areaId: "dragon_spire",
    displayName: "Dragon Spire",
    requiredHeroLevel: 60,
    icon: "dragon_spire",
    description: "Towering volcanic spire where drakes nest."
  },
  {
    sector: 14,
    areaId: "shadow_abyss",
    displayName: "Shadow Abyss",
    requiredHeroLevel: 65,
    icon: "shadow_abyss",
    description: "Dark chasm filled with wraiths and vampires."
  },
  {
    sector: 15,
    areaId: "celestial_sanctuary",
    displayName: "Celestial Sanctuary",
    requiredHeroLevel: 70,
    icon: "celestial_sanctuary",
    description: "Sacred realm guarded by demons and dragons."
  }
];

function normalizeHeroLevel(heroLevel) {
  return typeof heroLevel === 'number' && Number.isFinite(heroLevel)
    ? Math.max(1, Math.floor(heroLevel))
    : 1;
}

/**
 * Check the only sector-unlock rule: the player's Hero Level must meet the
 * registry requirement for the target sector.
 */
export function isSectorUnlockedByHeroLevel(areaId, heroLevel) {
  const sector = getSectorByAreaId(areaId);
  return Boolean(sector) && normalizeHeroLevel(heroLevel) >= sector.requiredHeroLevel;
}

/**
 * Return the canonical sector set unlocked by a Hero Level.
 * Registry order is used only for stable persistence and display ordering;
 * each sector is evaluated by its own requiredHeroLevel.
 */
export function getUnlockedAreaIdsForHeroLevel(heroLevel) {
  return SECTORS_REGISTRY
    .filter(sector => isSectorUnlockedByHeroLevel(sector.areaId, heroLevel))
    .map(sector => sector.areaId);
}

/**
 * Return only visited areas that are still valid under the current Hero
 * Level. This keeps legacy skill/quest-based exploration from bypassing the
 * current world progression rules.
 */
export function getVisitedAreaIdsForPlayer(player) {
  const visited = Array.isArray(player?.visitedAreas) ? player.visitedAreas : ['starter_village'];
  return Array.from(new Set(
    ['starter_village', ...visited].filter(areaId => isSectorUnlockedByHeroLevel(areaId, player?.level))
  ));
}

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
  const visited = getVisitedAreaIdsForPlayer(player);
  let highestExploredIdx = 0;
  for (const vArea of visited) {
    const idx = SECTORS_REGISTRY.findIndex(s => s.areaId === vArea);
    if (idx > highestExploredIdx) {
      highestExploredIdx = idx;
    }
  }

  const newSectors = Math.max(0, highestExploredIdx - introSectorIndex);
  const permanentMultiplier = 1.0 + (newSectors * WORLD_EXPLORATION_BONUS);

  const currentSectorIdx = getCurrentLocationSectorIndex(player);
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

export function getSectorIndex(areaId) {
  const idx = SECTORS_REGISTRY.findIndex(s => s.areaId === areaId);
  return idx === -1 ? 0 : idx;
}

export function getCurrentLocationSectorIndex(player) {
  const currentArea = player?.currentAreaId || 'starter_village';
  if (!isSectorUnlockedByHeroLevel(currentArea, player?.level)) return 0;
  return getSectorIndex(currentArea);
}

export function isMiningActivityUnlocked(player, activityDef, contentLoader) {
  const owningAreaId = getActivityOwningAreaId(activityDef, contentLoader);
  const visited = Array.isArray(player?.visitedAreas) ? player.visitedAreas : ['starter_village'];

  // Sector access is derived from Hero Level. `unlockedAreas` is persisted as
  // a compatibility/cache field, but must never become a second authority.
  if (!isSectorUnlockedByHeroLevel(owningAreaId, player?.level) || !visited.includes(owningAreaId)) return false;

  // Skill levels still gate resource activities; this is intentionally
  // separate from sector access, which is Hero-Level-only.
  const skillLevel = player?.skills?.[activityDef?.skillId]?.level || 1;
  if (typeof activityDef?.levelReq === 'number' && skillLevel < activityDef.levelReq) return false;

  const currentSectorIdx = getCurrentLocationSectorIndex(player);
  const owningSectorIdx = getSectorIndex(owningAreaId);

  // Available ONLY if owning sector <= player's current sector location
  return owningSectorIdx <= currentSectorIdx;
}

/**
 * Get all enemy IDs available in the player's visited areas up to current sector location.
 * Used by Auto Hunt to build the enemy pool.
 */
export function getEnemiesForVisitedAreas(player, contentLoader) {
  if (!contentLoader) return [];
  const visited = getVisitedAreaIdsForPlayer(player);
  const currentSectorIdx = getCurrentLocationSectorIndex(player);
  const enemyIds = new Set();

  for (const areaId of visited) {
    const areaSectorIdx = getSectorIndex(areaId);
    if (areaSectorIdx > currentSectorIdx) continue; // Skip future sectors relative to current location

    const areaDef = contentLoader.getArea(areaId);
    if (areaDef && Array.isArray(areaDef.enemyIds)) {
      for (const eid of areaDef.enemyIds) {
        enemyIds.add(eid);
      }
    }
  }
  return Array.from(enemyIds);
}

/**
 * Get the highest explored sector entry for a player based on visitedAreas.
 */
export function getHighestExploredSector(player) {
  const visited = getVisitedAreaIdsForPlayer(player);
  let highestIdx = 0;
  for (const areaId of visited) {
    const idx = getSectorIndex(areaId);
    if (idx > highestIdx) {
      highestIdx = idx;
    }
  }
  return SECTORS_REGISTRY[highestIdx] || SECTORS_REGISTRY[0];
}

/**
 * Get active mining areas up to player's current location sector.
 */
export function getActiveMiningAreas(player, contentLoader) {
  const visited = getVisitedAreaIdsForPlayer(player);
  const currentSectorIdx = getCurrentLocationSectorIndex(player);

  const activeAreas = [];
  for (const sector of SECTORS_REGISTRY) {
    const idx = sector.sector - 1;
    if (idx > currentSectorIdx) break;
    if (!visited.includes(sector.areaId)) continue;

    const areaDef = contentLoader?.getArea(sector.areaId);
    if (areaDef && Array.isArray(areaDef.resourceIds) && areaDef.resourceIds.some(r => r.includes('node') || r.includes('ore') || r.includes('sand') || r.includes('coal'))) {
      activeAreas.push(sector);
    }
  }
  return activeAreas.length > 0 ? activeAreas : [SECTORS_REGISTRY[0]];
}

/**
 * Get active hunting areas up to player's current location sector.
 */
export function getActiveHuntingAreas(player, contentLoader) {
  const visited = getVisitedAreaIdsForPlayer(player);
  const currentSectorIdx = getCurrentLocationSectorIndex(player);

  const activeAreas = [];
  for (const sector of SECTORS_REGISTRY) {
    const idx = sector.sector - 1;
    if (idx > currentSectorIdx) break;
    if (!visited.includes(sector.areaId)) continue;

    const areaDef = contentLoader?.getArea(sector.areaId);
    if (areaDef && Array.isArray(areaDef.enemyIds) && areaDef.enemyIds.length > 0) {
      activeAreas.push(sector);
    }
  }
  return activeAreas.length > 0 ? activeAreas : [SECTORS_REGISTRY[0]];
}

/**
 * Dynamically calculate the highest sector the player can farm consistently (80-90%+ win rate).
 * Considers Hero Level, Attributes, Weapon, Armor, Equipment bonuses, Max HP, Damage dealt & received.
 */
export function getRecommendedSectorForPlayer(player, contentLoader, customPlayerStats = null) {
  if (!contentLoader || !player) return SECTORS_REGISTRY[0];

  const level = player.level || 1;
  const attributes = player.attributes || {};
  const str = attributes.strength || 1;
  const att = (10 + level * 2) + ((player.equippedStats?.attack) || 0) + (str - 1);
  const def = (player.equippedStats?.defense) || 0;
  const maxHp = 100 + (level * 10) + ((player.equippedStats?.health) || 0);

  const pStats = customPlayerStats || { attack: att, strength: str - 1, defense: def, maxHp };

  const currentSectorIdx = getCurrentLocationSectorIndex(player);
  const visited = getVisitedAreaIdsForPlayer(player);

  let bestSector = SECTORS_REGISTRY[0];

  for (let i = currentSectorIdx - 1; i >= 0; i--) {
    const sectorDef = SECTORS_REGISTRY[i];
    if (!visited.includes(sectorDef.areaId)) continue;

    const areaDef = contentLoader.getArea(sectorDef.areaId);
    if (!areaDef || !Array.isArray(areaDef.enemyIds) || areaDef.enemyIds.length === 0) {
      bestSector = sectorDef;
      break;
    }

    // Test player performance against native monsters in this area
    let areaFarmable = true;
    for (const enemyId of areaDef.enemyIds) {
      const enemyDef = contentLoader.getEnemy(enemyId);
      if (!enemyDef) continue;

      const pDmg = Math.max(1, (pStats.attack + (pStats.strength || 0) * 1.5) - (enemyDef.defense || 0));
      const turnsToKill = Math.ceil((enemyDef.hp || 30) / pDmg);
      const eDmgPerTurn = Math.max(1, (enemyDef.attack || 5) - pStats.defense);
      const totalDamageTaken = turnsToKill * eDmgPerTurn;

      // 80-90%+ win rate threshold: total damage taken in a fight must be under 45% of max HP
      if (totalDamageTaken >= pStats.maxHp * 0.45) {
        areaFarmable = false;
        break;
      }
    }

    if (areaFarmable) {
      bestSector = sectorDef;
      break;
    }
  }

  return bestSector;
}
