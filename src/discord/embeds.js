/**
 * Idelon Discord Embed Visual Integration & Polish System.
 * Displays custom Discord emojis, fallbacks, clean layout fields, and RPG bot formatting.
 */

import { formatNumber } from '../utils/formatter.js';
import { SECTORS_REGISTRY, getSectorByAreaId, getSectorNumber, getSectorName, getSectorLabel, getOrderedAreas } from '../utils/sectorMap.js';

export const COLORS = {
  PRIMARY: 0x3498DB,   // Royal Blue
  SUCCESS: 0x2ECC71,   // Emerald Green
  WARNING: 0xF1C40F,   // Amber Gold
  ERROR: 0xE74C3C,     // Crimson Red
  GOLD: 0xF39C12,      // Gold Currency
  PURPLE: 0x9B59B6     // Epic Purple
};

const AREA_EMOJIS = {
  starter_village: '🏡',
  lead_quarry: '🪨',
  sand_dunes: '🏜️',
  titanium_caverns: '🦇',
  beryllium_caves: '🔮',
  thorium_depths: '🌋',
  tungsten_core: '☢️',
  whispering_woods: '🌲',
  iron_mines: '⛏️',
  misty_mountains: '⛰️',
  bandit_outpost: '🏴‍☠️',
  sunken_ruins: '🏛️',
  dragon_spire: '🐉',
  shadow_abyss: '🌌',
  celestial_sanctuary: '✨'
};

const ITEM_EMOJIS = {
  copper_ore: '🟠', coal: '⬛', lead_ore: '🩶', sand: '🏖️', graphite: '✏️',
  titanium_ore: '🛡️', silicon: '🔬', beryllium_ore: '🟢', thorium_ore: '⚛️',
  tungsten_ore: '🏋️', metaglass: '🪟', phase_fabric: '🧵', oxide: '🧪',
  carbide: '💎', surge_alloy: '⚡', scrap: '⚙️', spore_pod: '🧫',
  fissile_matter: '☢️', blast_compound: '💥', dormant_cyst: '🥚',
  iron_ore: '⛏️', silver_ore: '🪙', gold_ore: '🟡', mithril_ore: '💎',
  iron_bar: '🧱', copper_bar: '🧱', silver_bar: '🧱', gold_bar: '🧱', mithril_bar: '🧱',
  wood_log: '🪵', birch_log: '🪵', willow_log: '🪵', maple_log: '🪵', pine_log: '🪵',
  raw_shrimp: '🦐', cooked_shrimp: '🍤', raw_trout: '🐟', cooked_trout: '🎣', raw_beef: '🥩', cooked_beef: '🍖',
  iron_sword: '⚔️', bronze_sword: '⚔️', steel_sword: '🗡️', mithril_sword: '⚔️',
  iron_pickaxe: '⛏️', steel_pickaxe: '⛏️', iron_hatchet: '🪓', steel_hatchet: '🪓',
  iron_helmet: '🪖', bronze_helmet: '🪖', steel_helmet: '🪖',
  iron_chest: '🛡️', bronze_chest: '🛡️', steel_chest: '🛡️',
  lumberjack_ring: '💍', miner_ring: '💍', ruby_amulet: '📿', diamond_ring: '💎',
  gold: '🪙', sterlings: '✨'
};

export function formatName(id) {
  if (!id) return '';
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function getItemDisplay(itemId, contentLoader) {
  const itemDef = contentLoader?.getItem(itemId);
  const name = itemDef?.name || formatName(itemId);

  let emoji = ITEM_EMOJIS[itemId] || '📦';
  if (itemDef?.discordEmoji && itemDef.discordEmoji.trim().length > 0) {
    emoji = itemDef.discordEmoji.trim();
  }

  const category = itemDef?.category || 'Item';
  const levelStr = itemDef?.miningLevel ? ` | Mining Lv.${itemDef.miningLevel}` : '';
  const valueStr = `Value: ${formatNumber(itemDef?.value || 5)} Gold`;

  return {
    id: itemId,
    name,
    emoji,
    category,
    miningLevel: itemDef?.miningLevel || null,
    label: `${emoji} ${name}`,
    details: `*${category}${levelStr} • ${valueStr}*`,
    value: itemDef?.value || 5,
    icon: itemDef?.icon || 'icons/icon_0001.png'
  };
}

export function getAreaDisplay(areaId, contentLoader) {
  const sector = SECTORS_REGISTRY.find(s => s.areaId === areaId);
  const name = sector ? sector.displayName : (contentLoader?.getArea(areaId)?.name || formatName(areaId));
  const emoji = AREA_EMOJIS[areaId] || '🗺️';
  const labelText = sector ? getSectorLabel(areaId) : name;
  return { name, emoji, label: `${emoji} ${labelText}` };
}

export function createErrorEmbed(title, message) {
  return {
    title: `❌ ${title}`,
    description: message,
    color: COLORS.ERROR
  };
}

export function createProfileEmbed(profile, contentLoader) {
  const areaDisplay = getAreaDisplay(profile.currentAreaId, contentLoader);

  const fields = [
    { name: '🌟 Hero Level', value: `Level **${formatNumber(profile.level || 1)}**`, inline: true },
    { name: '✨ Total Hero XP', value: `**${formatNumber(profile.heroXp || 0)}** XP`, inline: true },
    { name: '🗺️ Current Location', value: areaDisplay.label, inline: true }
  ];

  if (profile.equippedStats && Object.keys(profile.equippedStats).length > 0) {
    const statsStr = Object.entries(profile.equippedStats)
      .map(([stat, val]) => `• **${formatName(stat)}**: \`+${formatNumber(val)}\``)
      .join('\n');
    fields.push({ name: '🛡️ Equipped Item Stat Bonuses', value: statsStr, inline: false });
  }

  return {
    title: `👤 ${profile.name}'s Hero Profile`,
    color: COLORS.PRIMARY,
    fields,
    footer: { text: `Player ID: ${profile.id} • Idelon RPG Engine v1.0` }
  };
}

export function createInventoryEmbed(playerName, inventory, contentLoader) {
  const entries = Object.entries(inventory || {});
  
  if (entries.length === 0) {
    return {
      title: `🎒 ${playerName}'s Inventory`,
      description: '*No items in inventory.*',
      color: COLORS.PRIMARY
    };
  }

  const lines = entries.map(([itemId, qty]) => {
    const display = getItemDisplay(itemId, contentLoader);
    return `${display.emoji} **${display.name}** ×**${formatNumber(qty)}**\n   ${display.details}`;
  });

  return {
    title: `🎒 ${playerName}'s Inventory`,
    description: lines.join('\n\n'),
    fields: [
      { name: '📊 Inventory Usage', value: `Slots Used: **${formatNumber(entries.length)}**`, inline: true }
    ],
    color: COLORS.PRIMARY
  };
}

export function createStorageEmbed(playerName, storage, contentLoader) {
  const entries = Object.entries(storage || {});
  
  if (entries.length === 0) {
    return {
      title: `🏦 ${playerName}'s Bank Storage`,
      description: '*No items in bank storage.*',
      color: COLORS.PRIMARY
    };
  }

  const lines = entries.map(([itemId, qty]) => {
    const display = getItemDisplay(itemId, contentLoader);
    return `${display.emoji} **${display.name}** ×**${formatNumber(qty)}**\n   ${display.details}`;
  });

  return {
    title: `🏦 ${playerName}'s Bank Storage`,
    description: lines.join('\n\n'),
    fields: [
      { name: '📊 Storage Summary', value: `Item Stacks Vaulted: **${formatNumber(entries.length)}**`, inline: true }
    ],
    color: COLORS.PRIMARY
  };
}

export function createEquipmentEmbed(playerName, equipment, contentLoader) {
  const entries = Object.entries(equipment || {});
  
  if (entries.length === 0) {
    return {
      title: `🛡️ ${playerName}'s Equipped Gear`,
      description: '*No gear currently equipped.*',
      color: COLORS.PRIMARY
    };
  }

  const lines = entries.map(([slot, item]) => {
    const display = getItemDisplay(item.id, contentLoader);
    return `• **${formatName(slot)}**: ${display.label}`;
  });

  return {
    title: `🛡️ ${playerName}'s Equipped Gear`,
    description: lines.join('\n'),
    color: COLORS.PRIMARY
  };
}

export function createSkillsEmbed(playerName, skills) {
  const entries = Object.entries(skills || {});
  
  if (entries.length === 0) {
    return {
      title: `✨ ${playerName}'s Skill Mastery`,
      description: '*No skill XP earned yet.*',
      color: COLORS.PRIMARY
    };
  }

  const lines = entries.map(([skillId, data]) => {
    return `✨ **${formatName(skillId)}**: Level **${formatNumber(data.level || 1)}** \`(${formatNumber(data.xp || 0)} Total XP)\``;
  });

  return {
    title: `✨ ${playerName}'s Skill Mastery`,
    description: lines.join('\n'),
    color: COLORS.PRIMARY
  };
}

export function createActivityResultEmbed(action, result, contentLoader) {
  if (!result) {
    return createErrorEmbed('Activity Error', 'Failed to execute activity.');
  }

  if (action === 'mine' || action === 'start') {
    const actName = formatName(result.id);
    return {
      title: `⛏️ Gathering Activity Started`,
      description: `Started activity **${actName}**! Check back later and use \`/claim\` to gather your loot.`,
      color: COLORS.SUCCESS
    };
  }

  // Auto-mine claim — aggregated across multiple resources
  if (result.mode === 'auto') {
    if (result.cyclesCompleted <= 0) {
      return {
        title: '⛏️ Auto Mining — Nothing Yet',
        description: 'Not enough time has passed to complete any mining cycles. Check back soon!',
        color: COLORS.WARNING
      };
    }

    const itemsStr = result.itemsGained?.length > 0
      ? result.itemsGained.map(i => {
          const display = getItemDisplay(i.itemId, contentLoader);
          return `${display.emoji} **${display.name}**: +**${formatNumber(i.amount)}** (${display.category})`;
        }).join('\n')
      : '*No items obtained.*';

    const fields = [
      { name: '⏱️ Completed Cycles', value: `**${formatNumber(result.cyclesCompleted)}** Cycles`, inline: true },
      { name: '✨ Skill XP Gained', value: `+**${formatNumber(result.xpGained)}** XP`, inline: true },
      { name: '📦 Items Obtained', value: itemsStr, inline: false }
    ];

    if (result.miningProgress) {
      const mp = result.miningProgress;
      fields.push({
        name: '📊 Progress',
        value: `Mining Level: **${formatNumber(mp.level)}**\nTotal Mining XP: **${formatNumber(mp.totalXp)} XP**\nNext Level (${formatNumber(mp.level + 1)}): **${formatNumber(mp.remaining)} XP** remaining`,
        inline: false
      });
    }

    return {
      title: `🎉 Claimed Activity Rewards`,
      fields,
      color: COLORS.SUCCESS
    };
  }

  // Single-activity claim
  const itemsStr = result.itemsGained?.length > 0
    ? result.itemsGained.map(i => {
        const display = getItemDisplay(i.itemId, contentLoader);
        return `${display.emoji} **${display.name}**: +**${formatNumber(i.amount)}** (${display.category})`;
      }).join('\n')
    : '*No items obtained.*';

  const fields = [
    { name: '⏱️ Completed Cycles', value: `**${formatNumber(result.cyclesCompleted)}** Cycles`, inline: true },
    { name: '✨ Skill XP Gained', value: `+**${formatNumber(result.xpGained)}** XP`, inline: true },
    { name: '📦 Items Obtained', value: itemsStr, inline: false }
  ];

  if (result.miningProgress) {
    const mp = result.miningProgress;
    fields.push({
      name: '📊 Progress',
      value: `Mining Level: **${formatNumber(mp.level)}**\nTotal Mining XP: **${formatNumber(mp.totalXp)} XP**\nNext Level (${formatNumber(mp.level + 1)}): **${formatNumber(mp.remaining)} XP** remaining`,
      inline: false
    });
  }

  return {
    title: `🎉 Claimed Activity Rewards`,
    fields,
    color: COLORS.SUCCESS
  };
}

export function createLevelUpEmbed(levelUp, playerName = 'Adventurer') {
  const unlocksStr = levelUp.unlocks && levelUp.unlocks.length > 0
    ? levelUp.unlocks.map(u => `- ${u}`).join('\n')
    : '- None';

  return {
    title: 'LEVEL UP!',
    description: `Congratulations, **${playerName}**!`,
    fields: [
      { name: 'Mining Level', value: `**${formatNumber(levelUp.from)}** -> **${formatNumber(levelUp.to)}**`, inline: true },
      { name: 'Rewards', value: `+**${formatNumber(levelUp.sterlingsAwarded)}** Sterlings`, inline: true },
      { name: 'New Unlocks', value: unlocksStr, inline: false }
    ],
    color: COLORS.GOLD
  };
}

export function createBalanceEmbed(balance, playerName = 'Adventurer', contentLoader = null) {
  const goldDisplay = getItemDisplay('gold', contentLoader);
  const sterlingsDisplay = getItemDisplay('sterlings', contentLoader);

  const goldEmoji = goldDisplay?.emoji && goldDisplay.emoji !== '📦' ? goldDisplay.emoji : '💰';
  const sterlingEmoji = sterlingsDisplay?.emoji && sterlingsDisplay.emoji !== '📦' ? sterlingsDisplay.emoji : '✨';

  return {
    title: `Account Balance`,
    fields: [
      { name: `${goldEmoji} Gold:`, value: `**${formatNumber(balance.gold ?? 0)}**`, inline: true },
      { name: `${sterlingEmoji} Sterlings:`, value: `**${formatNumber(balance.sterlings ?? 0)}**`, inline: true }
    ],
    color: COLORS.GOLD
  };
}

/**
 * Auto-mine start embed: lists every ore currently being mined.
 */
export function createAutoMineStartEmbed(result, contentLoader) {
  const lines = (result.activities || []).map(act => {
    // Derive the primary item from the activity's loot table
    const lt = contentLoader?.getLootTable(act.lootTableId);
    const primaryItemId = lt?.entries?.[0]?.itemId;
    const display = primaryItemId ? getItemDisplay(primaryItemId, contentLoader) : null;
    const label = display ? display.label : formatName(act.id);
    return `${label}`;
  });

  return {
    title: '⛏️ Auto Mining Started',
    description: `**Mining:**\n${lines.join('\n')}`,
    fields: [
      { name: '\u200b', value: 'Use `.claim` later to collect all rewards.', inline: false }
    ],
    color: COLORS.SUCCESS,
    footer: { text: `Mining ${result.ids?.length || 0} resource(s) • Tip: Use .mine <copper|coal|lead|...> to mine a single ore.` }
  };
}

export function createCombatResultEmbed(result, contentLoader) {
  if (!result.success) {
    return createErrorEmbed('Combat Encounter Failed', `Reason: ${result.reason}`);
  }

  const title = result.victory ? '⚔️ Encounter Victory!' : '💀 Defeated in Battle!';
  const color = result.victory ? COLORS.SUCCESS : COLORS.ERROR;
  const lootStr = result.loot?.length > 0
    ? result.loot.map(l => {
        const display = getItemDisplay(l.itemId, contentLoader);
        return `${display.emoji} **${display.name}**: ×**${formatNumber(l.amount)}**`;
      }).join('\n')
    : '*No items dropped.*';

  return {
    title,
    fields: [
      { name: '⏱️ Turn Count', value: `**${formatNumber(result.turnsCount)}** Turns`, inline: true },
      { name: '✨ Combat XP', value: `+**${formatNumber(result.xpGained)}** XP`, inline: true },
      { name: '💰 Gold Looted', value: `+**${formatNumber(result.currenciesGained?.gold || 0)}** Gold`, inline: true },
      { name: '📦 Enemy Drop Rewards', value: lootStr, inline: false }
    ],
    color
  };
}

export function createCraftResultEmbed(result, contentLoader) {
  if (!result.success) {
    return createErrorEmbed('Crafting Failed', `Reason: ${result.reason}`);
  }

  const display = getItemDisplay(result.resultItemId, contentLoader);

  return {
    title: `🔨 Crafting Complete`,
    description: `Successfully crafted ×**${formatNumber(result.resultAmount)}** ${display.label}!`,
    fields: [
      { name: '✨ Crafting XP', value: `+**${formatNumber(result.xpGained)}** XP`, inline: true }
    ],
    color: COLORS.SUCCESS
  };
}

export function createShopEmbed(shopData, contentLoader) {
  const sellItems = shopData.inventorySellItems || [];

  if (sellItems.length === 0) {
    return {
      title: `🏪 Town Merchant Shop`,
      description: '*No sellable items in inventory.*',
      fields: [
        { name: '💰 Gold Purse Balance', value: `**${formatNumber(shopData.currencies?.gold || 0)}** Gold`, inline: false }
      ],
      color: COLORS.GOLD
    };
  }

  const lines = sellItems.map(item => {
    const display = getItemDisplay(item.id, contentLoader);
    return `${display.emoji} **${display.name}**\n   Category: **${display.category}**${display.miningLevel ? ` | Mining Lv. **${formatNumber(display.miningLevel)}**` : ''}\n   Owned: **${formatNumber(item.quantity)}** | Price: **${formatNumber(item.unitValue)} Gold** each | Total Value: **${formatNumber(item.totalValue)} Gold**`;
  });

  return {
    title: `🏪 Town Merchant Shop`,
    description: lines.join('\n\n'),
    fields: [
      { name: '💰 Gold Purse Balance', value: `**${formatNumber(shopData.currencies?.gold || 0)}** Gold`, inline: false }
    ],
    color: COLORS.GOLD,
    footer: { text: 'Use /sell <item> <amount> to sell your items.' }
  };
}

export function createEnemiesEmbed(areaId, enemiesList, contentLoader) {
  const areaDisplay = getAreaDisplay(areaId, contentLoader);

  if (!enemiesList || enemiesList.length === 0) {
    return {
      title: `⚔️ Enemies in ${areaDisplay.label}`,
      description: '*No wild enemies inhabit this area.*',
      color: COLORS.PRIMARY
    };
  }

  const lines = enemiesList.map(enemy => {
    return `👹 **${enemy.name}** \`[ID: ${enemy.id}]\`\n   Level: **${formatNumber(enemy.level)}** | HP: **${formatNumber(enemy.hp)}** | Attack: **${formatNumber(enemy.attack)}**`;
  });

  return {
    title: `⚔️ Enemies in ${areaDisplay.label}`,
    description: lines.join('\n\n'),
    color: COLORS.PRIMARY,
    footer: { text: 'Use /fight <enemy_id> to enter battle!' }
  };
}

export function createAreasEmbed(playerOrAreaId, allAreas, availableAreas, contentLoader) {
  const currentAreaId = typeof playerOrAreaId === 'string' ? playerOrAreaId : (playerOrAreaId?.currentAreaId || 'starter_village');
  const visitedAreas = Array.isArray(playerOrAreaId?.visitedAreas) ? playerOrAreaId.visitedAreas : ['starter_village'];
  const visitedSet = new Set(visitedAreas);
  const availableSet = new Set(availableAreas.map(a => a.id));
  const orderedAreas = getOrderedAreas(allAreas);

  const lines = orderedAreas.map(area => {
    const display = getAreaDisplay(area.id, contentLoader);
    const isCurrent = area.id === currentAreaId;
    const isExplored = visitedSet.has(area.id);
    const isUnlocked = availableSet.has(area.id);

    if (isCurrent) {
      return `📍 **${display.label}** *(Current Location)*`;
    } else if (isExplored) {
      return `✅ **${display.label}** *(Explored)*`;
    } else if (isUnlocked) {
      return `🟢 **${display.label}** *(Unlocked)*`;
    } else {
      const sector = SECTORS_REGISTRY.find(s => s.areaId === area.id);
      const reqMsg = sector?.unlockType === 'level' 
        ? `Requires Hero Level ${formatNumber(sector.requiredHeroLevel)}` 
        : 'Requires Quest Unlock';
      const labelText = sector ? getSectorLabel(area.id) : display.name;
      return `🔒 **${display.emoji} ${labelText}** - *${reqMsg}*`;
    }
  });

  return {
    title: `🗺️ World Regions & Areas`,
    description: lines.join('\n\n'),
    color: COLORS.PRIMARY,
    footer: { text: 'Use /travel <sector> to travel to an unlocked area.' }
  };
}

export function createNothingToClaimEmbed() {
  return {
    title: 'Nothing to Claim',
    description: `You don't have an active gathering activity.\n\nStart one first using:\n\`.mine\`\n\nor mine a specific resource:\n\`.mine copper\`\n\`.mine coal\`\n\`.mine lead\`\n\nOnce your activity has been running for a while, use:\n\`.claim\`\nto collect your resources and XP.`,
    color: COLORS.PRIMARY
  };
}

export function createSellInfoEmbed(inventory, contentLoader) {
  const ownedOres = [];
  for (const [itemId, qty] of Object.entries(inventory || {})) {
    if (qty <= 0) continue;
    const itemDef = contentLoader?.getItem(itemId);
    if (itemDef && itemDef.category === 'Ore') {
      const display = getItemDisplay(itemId, contentLoader);
      ownedOres.push(`${display.emoji} **${display.name}** ×**${formatNumber(qty)}**`);
    }
  }

  const fields = [];
  if (ownedOres.length > 0) {
    fields.push({
      name: 'Available Ores',
      value: ownedOres.join('\n'),
      inline: false
    });
  }

  return {
    title: 'Sell Items',
    description: `You can sell your ores using one of these commands:\n\n\`.sell all\`\nSells every ore in your inventory.\n\n\`.sell <ore>\`\nExample:\n\`.sell copper\`\nSells all Copper Ore.\n\n\`.sell <ore> <quantity>\`\nExamples:\n\`.sell copper 20\`\n\`.sell coal 100\`\n\`.sell lead 50\`\nSells only the specified quantity.`,
    fields,
    color: COLORS.PRIMARY
  };
}

export function createResourceLockedEmbed(owningAreaId, contentLoader) {
  const sectorNumStr = getSectorNumber(owningAreaId) || '01';
  const sectorName = getSectorName(owningAreaId);

  return {
    title: 'Resource Locked',
    description: `You haven't explored Sector ${sectorNumStr} — ${sectorName} yet.\n\nTravel there first using:\n\n\`.travel ${sectorNumStr}\``,
    color: COLORS.PRIMARY
  };
}

export function createSectorUnlockEmbed(areaId, contentLoader) {
  const display = getAreaDisplay(areaId, contentLoader);
  const sectorNum = getSectorNumber(areaId);
  const titleStr = sectorNum ? `Sector ${sectorNum} Unlocked!` : `New Area Unlocked!`;
  
  return {
    title: `🗺️ ${titleStr}`,
    description: `You can now travel to **${display.label}**.`,
    color: COLORS.SUCCESS
  };
}

export function createTravelSuccessEmbed(fromAreaId, toAreaId, contentLoader) {
  const toDisplay = getAreaDisplay(toAreaId, contentLoader);
  
  return {
    title: `🗺️ Travel Successful`,
    description: `You have arrived at **${toDisplay.label}**.`,
    color: COLORS.SUCCESS
  };
}

export function createHelpEmbed() {
  return {
    title: `🎮 Idelon Game Commands`,
    description: 'Welcome to Idelon! Use the slash commands below to play.',
    fields: [
      { name: '👤 Player Commands', value: '`/start` • `/profile` • `/skills`', inline: false },
      { name: '⛏️ Activity Commands', value: '`/mine` • `/claim`', inline: false },
      { name: '🎒 Inventory & Vault', value: '`/inv` • `/storage` • `/deposit` • `/withdraw`', inline: false },
      { name: '⚔️ Combat Commands', value: '`/fight` • `/enemies`', inline: false },
      { name: '🗺️ World Commands', value: '`/travel <sector>` • `/areas`', inline: false },
      { name: '🏪 Economy Commands', value: '`/bal` • `/shop` • `/sell`', inline: false },
      { name: '🛠️ Admin Toolkit', value: '`/dev`', inline: false }
    ],
    color: COLORS.PRIMARY,
    footer: { text: 'Idelon Idle RPG Engine v1.0 • Mining Progression System v1' }
  };
}
