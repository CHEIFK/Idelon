/**
 * Idelon Discord Embed Visual Integration & Polish System.
 * Displays custom Discord emojis, fallbacks, clean layout fields, and RPG bot formatting.
 */

import { formatNumber } from '../utils/formatter.js';
import { SECTORS_REGISTRY, getSectorByAreaId, getSectorNumber, getSectorName, getSectorLabel, getOrderedAreas, getActivityOwningAreaId, getHighestExploredSector, getActiveMiningAreas, getActiveHuntingAreas, getVisitedAreaIdsForPlayer } from '../utils/sectorMap.js';

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
  gold: '🪙', sterlings: '✨',
  slime_gel: '🫧', spider_fang: '🦷', spider_silk: '🕸️', orc_tusk: '🦴',
  troll_hide: '🧶', bone_fragment: '💀', spectral_essence: '👻', vampire_fang: '🧛',
  drake_claw: '🐲', wyvern_scale: '❄️', shadow_shard: '🌑', stone_fragment: '🪨', demon_horn: '😈'
};

const SKILL_DISPLAY = [
  { id: 'mining', label: '⛏ Mining' },
  { id: 'combat', label: '⚔ Combat' },
  { id: 'woodcutting', label: '🪓 Woodcutting' },
  { id: 'fishing', label: '🎣 Fishing' },
  { id: 'smithing', label: '🔥 Smithing' }
];

export function formatLinesWithLimit(lines, separator = '\n\n', maxChars = 4000) {
  if (!Array.isArray(lines) || lines.length === 0) return '';
  let result = '';
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const candidate = result.length > 0 ? result + separator + lines[i] : lines[i];
    if (candidate.length > maxChars - 40) {
      const remaining = lines.length - count;
      return result + separator + `*... and ${remaining} more items*`;
    }
    result = candidate;
    count++;
  }
  return result;
}

export function formatName(id) {
  if (!id) return '';
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function getItemDisplay(itemId, contentLoader) {
  const itemDef = contentLoader?.getItem(itemId)
    || contentLoader?.getEquipment(itemId)
    || contentLoader?.getPotion(itemId);
  const name = itemDef?.name || formatName(itemId);

  let emoji = itemDef?.emoji || ITEM_EMOJIS[itemId] || '📦';
  if (itemDef?.discordEmoji && itemDef.discordEmoji.trim().length > 0) {
    emoji = itemDef.discordEmoji.trim();
  }

  const category = itemDef?.category
    || (contentLoader?.getEquipment(itemId) ? 'Equipment' : (contentLoader?.getPotion(itemId) ? 'Potion' : 'Item'));
  const levelStr = itemDef?.miningLevel ? ` | Mining Lv.${itemDef.miningLevel}` : '';
  const valueStr = `Value: ${formatNumber(itemDef?.value ?? 5)} Gold`;

  return {
    id: itemId,
    name,
    emoji,
    category,
    miningLevel: itemDef?.miningLevel || null,
    label: `${emoji} ${name}`,
    details: `*${category}${levelStr} • ${valueStr}*`,
    value: itemDef?.value ?? 5,
    icon: itemDef?.icon || 'icons/icon_0001.png'
  };
}

export function getAreaDisplay(areaId, contentLoader) {
  const sector = SECTORS_REGISTRY.find(s => s.areaId === areaId);
  const name = sector ? sector.displayName : (contentLoader?.getArea(areaId)?.name || formatName(areaId));
  const emoji = AREA_EMOJIS[areaId] || '🗺️';
  const labelText = sector ? `${emoji} ${getSectorLabel(areaId)}` : `${emoji} ${name}`;
  return { name, emoji, label: labelText };
}

export function createErrorEmbed(title, message) {
  return {
    title: `❌ ${title}`,
    description: message,
    color: COLORS.ERROR
  };
}

export function createWelcomeEmbed() {
  return {
    title: '🎮 Welcome to Idelon',
    description: [
      '━━━━━━━━━━━━━━',
      '',
      'Mine resources, hunt monsters, upgrade your gear, and explore stronger sectors.',
      '',
      '━━━━━━━━━━━━━━',
      '',
      'Quick Start',
      '',
      '.mine      Gather resources',
      '.hunt      Fight monsters',
      '.travel    Explore sectors',
      '.areas     World Regions',
      '.profile   Player profile',
      '.stats     View your hero',
      '',
      '━━━━━━━━━━━━━━',
      '',
      '💡 Tips',
      '',
      '• Use .mine copper, .mine coal, .mine lead, etc. to mine a single resource 3× faster.',
      '• .claim collects mining rewards.',
      '• Hunting is instant.',
      '• Better gear unlocks stronger sectors.',
      '',
      '━━━━━━━━━━━━━━'
    ].join('\n'),
    color: COLORS.PRIMARY
  };
}

export function renderHealthBar(current, max, length = 10) {
  if (!Number.isInteger(length) || length < 0) return '';
  const safeMax = Math.max(1, max || 1);
  const safeCurrent = Math.max(0, Math.min(typeof current === 'number' ? current : safeMax, safeMax));
  const fillRatio = safeCurrent / safeMax;
  const filled = Math.round(fillRatio * length);
  const empty = length - filled;
  return '🟩'.repeat(filled) + '⬛'.repeat(empty);
}

export function createProfileEmbed(profile, contentLoader, skills = null, buffs = []) {
  const maxHp = profile.maxHp ?? 110;
  const hp = typeof profile.hp === 'number' ? profile.hp : maxHp;
  const area = getAreaDisplay(profile.currentAreaId, contentLoader);
  const skillData = skills || profile.skills || {};
  const skillLines = SKILL_DISPLAY.map(({ id, label }) => `${label} Lv.${formatNumber(skillData[id]?.level || 1)}`);
  const skillRows = [skillLines.slice(0, 2), skillLines.slice(2, 4), skillLines.slice(4)]
    .filter(row => row.length > 0)
    .map(row => row.join(' • '));
  const activeBuffLines = formatActiveBuffLines(buffs, contentLoader);

  return {
    title: `👤 ${profile.name}`,
    description: [
      `⭐ Hero Lv.${formatNumber(profile.level || 1)} • 🏅 ${profile.battleRank || 'Recruit'}`,
      `❤️ ${formatNumber(hp)} / ${formatNumber(maxHp)} HP`,
      `💰 ${formatNumber(profile.currencies?.gold || 0)} Gold`,
      `📍 ${area.label}`,
      '',
      '━━━━━━━━━━━━━━',
      '',
      '✨ Active Buffs',
      ...(activeBuffLines.length > 0 ? activeBuffLines : ['None']),
      '',
      '📜 Skills',
      ...skillRows,
      '',
      '━━━━━━━━━━━━━━',
      '',
      '💡 Use `.stats` for detailed hero statistics.'
    ].join('\n'),
    color: COLORS.PRIMARY
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
    description: formatLinesWithLimit(lines, '\n\n', 4000),
    fields: [
      { name: '📊 Inventory Usage', value: `Slots Used: **${formatNumber(entries.length)}**`, inline: true }
    ],
    color: COLORS.PRIMARY
  };
}

export function createHuntInventoryEmbed(playerName, inventorySummary, contentLoader, notice = null) {
  const inventory = inventorySummary?.inventory || {};
  const entries = Object.entries(inventory);
  const itemLines = entries.length > 0
    ? entries.map(([itemId, quantity]) => {
      const display = getItemDisplay(itemId, contentLoader);
      return `${display.emoji} ${display.name} ×${formatNumber(quantity)}`;
    })
    : ['*Inventory is empty.*'];
  const itemText = formatLinesWithLimit(itemLines, '\n', 3500);

  const description = [
    notice ? `✅ ${notice}` : null,
    `💰 **Gold:** ${formatNumber(inventorySummary?.gold || 0)}`,
    '',
    itemText
  ].filter(value => value !== null).join('\n');

  return {
    title: `🎒 ${playerName}'s Inventory`,
    description,
    fields: [
      {
        name: '📦 Inventory Usage',
        value: `Slots Used: **${formatNumber(inventorySummary?.slotsUsed ?? entries.length)}**`,
        inline: false
      }
    ],
    color: COLORS.PRIMARY
  };
}

export function createHuntConsumablesEmbed(consumables = [], notice = null) {
  const owned = Array.isArray(consumables) ? consumables.filter(potion => Number(potion.owned) > 0) : [];
  const lines = owned.length > 0
    ? owned.map(potion => `${potion.emoji || '🧪'} ${potion.name} ×${formatNumber(potion.owned)}`)
    : ['No consumables available.'];

  return {
    title: '🧪 Consumables',
    description: [notice ? `✅ ${notice}` : null, formatLinesWithLimit(lines, '\n', 3500)]
      .filter(value => value !== null)
      .join('\n'),
    color: COLORS.PRIMARY
  };
}

export function createHuntConsumableSelectEmbed(consumables = []) {
  const owned = Array.isArray(consumables) ? consumables.filter(potion => Number(potion.owned) > 0) : [];
  const lines = owned.length > 0
    ? owned.map(potion => `${potion.emoji || '🧪'} ${potion.name} ×${formatNumber(potion.owned)}`)
    : ['No consumables available.'];

  return {
    title: '🧪 Select Consumable',
    description: formatLinesWithLimit(lines, '\n', 3500),
    color: COLORS.PRIMARY
  };
}

export function createHuntConsumableUseEmbed(potion, quantity = 1) {
  const owned = Math.max(0, Number(potion?.owned || 0));
  const safeQuantity = Math.max(1, Math.min(owned || 1, Number(quantity || 1)));
  return {
    title: '🧪 Use Consumable',
    fields: [
      { name: 'Item', value: `${potion?.emoji || '🧪'} ${potion?.name || 'Consumable'}`, inline: false },
      { name: 'Owned', value: formatNumber(owned), inline: true },
      { name: 'Quantity', value: `×${formatNumber(safeQuantity)}`, inline: true },
      { name: 'Effect', value: potion?.effectLabel || potion?.description || 'Consumable effect', inline: false }
    ],
    color: COLORS.PRIMARY
  };
}

const HUNT_EQUIPMENT_SLOT_LABELS = Object.freeze({
  weapon: '⚔ Weapon',
  mainHand: '⚔ Weapon',
  offHand: '🛡 Off-hand',
  helmet: '🪖 Helmet',
  chest: '🥋 Chestplate',
  legs: '👖 Pants',
  boots: '🥾 Boots',
  gloves: '🧤 Gloves',
  ring: '💍 Ring',
  amulet: '📿 Amulet',
  shield: '🛡 Shield'
});

export function createHuntEquipmentEmbed(equipment = {}, contentLoader, selectedSlot = null, notice = null) {
  const slotOrder = Object.keys(HUNT_EQUIPMENT_SLOT_LABELS);
  const entries = Object.entries(equipment || {}).sort(([a], [b]) => {
    const aIndex = slotOrder.indexOf(a);
    const bIndex = slotOrder.indexOf(b);
    return (aIndex < 0 ? slotOrder.length : aIndex) - (bIndex < 0 ? slotOrder.length : bIndex);
  });

  const lines = entries.length > 0
    ? entries.map(([slot, item]) => {
      const display = getItemDisplay(item.id, contentLoader);
      const durability = Number.isFinite(item.durability) && Number.isFinite(item.maxDurability)
        ? `\n${formatNumber(item.durability)} / ${formatNumber(item.maxDurability)}`
        : '';
      const marker = selectedSlot === slot ? '▶ ' : '';
      return `${marker}${HUNT_EQUIPMENT_SLOT_LABELS[slot] || `🛡 ${formatName(slot)}`}\n${display.emoji} ${display.name}${durability}`;
    })
    : ['No gear equipped.'];

  return {
    title: '🛡️ Equipment',
    description: [notice ? `✅ ${notice}` : null, formatLinesWithLimit(lines, '\n\n', 3500)]
      .filter(value => value !== null)
      .join('\n'),
    color: COLORS.PRIMARY
  };
}

export function createHuntEquipmentInventoryEmbed(items = [], selectedItemId = null, notice = null) {
  const entries = Array.isArray(items) ? items : [];
  const lines = entries.length > 0
    ? entries.map(item => {
      const marker = selectedItemId === item.id ? '▶ ' : '';
      return `${marker}${item.display?.emoji || '📦'} ${item.display?.name || item.name || formatName(item.id)} ×${formatNumber(item.quantity)}`;
    })
    : ['No equippable items in inventory.'];

  return {
    title: '🎒 Equipment Inventory',
    description: [notice ? `❌ ${notice}` : null, formatLinesWithLimit(lines, '\n', 3500)]
      .filter(value => value !== null)
      .join('\n'),
    color: COLORS.PRIMARY
  };
}

export function createHuntSellMenuEmbed() {
  return {
    title: '💰 Sell Items',
    description: 'Choose what you would like to sell.',
    color: COLORS.GOLD
  };
}

export function createHuntSaleConfirmationEmbed(group, items, contentLoader) {
  const saleItems = Array.isArray(items) ? items : [];
  const lines = saleItems.map(item => {
    const display = getItemDisplay(item.id, contentLoader);
    return `${display.emoji} ${display.name} ×${formatNumber(item.quantity)}`;
  });
  const totalGold = saleItems.reduce((sum, item) => sum + (item.totalValue || 0), 0);
  const itemText = lines.length > 0 ? formatLinesWithLimit(lines, '\n', 3200) : '*Nothing is available to sell.*';

  return {
    title: `${group.emoji} Confirm Sale`,
    description: [
      `The following ${group.name.toLowerCase()} will be sold:`,
      '',
      itemText,
      '',
      '━━━━━━━━━━━━━━',
      '',
      `💰 **Total Gold:** ${formatNumber(totalGold)}`
    ].join('\n'),
    color: COLORS.GOLD
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
    description: formatLinesWithLimit(lines, '\n\n', 4000),
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

    const itemLines = result.itemsGained?.length > 0
      ? result.itemsGained.map(i => {
          const display = getItemDisplay(i.itemId, contentLoader);
          return `${display.emoji} **${display.name}**: +**${formatNumber(i.amount)}** (${display.category})`;
        })
      : ['*No items obtained.*'];

    const itemsStr = formatLinesWithLimit(itemLines, '\n', 1000);

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
  const itemLines = result.itemsGained?.length > 0
    ? result.itemsGained.map(i => {
        const display = getItemDisplay(i.itemId, contentLoader);
        return `${display.emoji} **${display.name}**: +**${formatNumber(i.amount)}** (${display.category})`;
      })
    : ['*No items obtained.*'];

  const itemsStr = formatLinesWithLimit(itemLines, '\n', 1000);

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

export function createLevelUpSummaryEmbed(levelUps, playerName = 'Adventurer', contentLoader = null) {
  const levelUpsList = Array.isArray(levelUps) ? levelUps : [levelUps];
  if (levelUpsList.length === 0) return null;

  const first = levelUpsList[0];
  const last = levelUpsList[levelUpsList.length - 1];

  const skillId = first.skillId || 'mining';
  const skillName = formatName(skillId);

  const startLevel = first.from;
  const endLevel = last.to;

  const totalSterlings = levelUpsList.reduce((sum, lu) => sum + (lu.sterlingsAwarded || 0), 0);

  // Aggregate and deduplicate item unlocks (excluding area entries ending with (area))
  const rawUnlocks = levelUpsList.flatMap(lu => lu.unlocks || []);
  const itemUnlocks = [];
  const seenUnlocks = new Set();

  for (const unlock of rawUnlocks) {
    if (typeof unlock !== 'string') continue;
    if (unlock.endsWith('(area)')) continue;
    const lower = unlock.toLowerCase();
    if (!seenUnlocks.has(lower)) {
      seenUnlocks.add(lower);
      itemUnlocks.push(unlock);
    }
  }

  // Only a Hero-Level summary may render sector notifications. Skill-level
  // payloads can contain legacy unlockedAreaIds, but those must never appear
  // as skill progression rewards.
  const isHeroLevelSummary = levelUpsList.every(lu => lu?.skillId === 'hero');
  const rawAreaIds = isHeroLevelSummary
    ? levelUpsList.flatMap(lu => lu.unlockedAreaIds || [])
    : [];
  const uniqueAreaIds = Array.from(new Set(rawAreaIds));

  // Sort sectors in progression order
  uniqueAreaIds.sort((a, b) => {
    const numA = getSectorNumber(a) || 999;
    const numB = getSectorNumber(b) || 999;
    return numA - numB;
  });

  const sectorLines = uniqueAreaIds.map(areaId => {
    const display = getAreaDisplay(areaId, contentLoader);
    const sectorRaw = getSectorNumber(areaId);
    const sectorInt = sectorRaw ? parseInt(sectorRaw, 10) : null;
    const sectorNumStr = sectorInt ? String(sectorInt).padStart(2, '0') : '';
    const sectorName = display.name;
    const emoji = display.emoji;
    const travelCmd = sectorInt ? `.travel ${sectorInt}` : `.travel ${areaId}`;

    return `${emoji} Sector ${sectorNumStr} — ${sectorName}\nUse: \`${travelCmd}\``;
  });

  const fields = [
    {
      name: `⭐ ${skillName} Level`,
      value: `Level ${startLevel} → Level ${endLevel}`,
      inline: false
    },
    {
      name: '🎁 Total Rewards',
      value: `• +${formatNumber(totalSterlings)} Sterlings`,
      inline: false
    }
  ];

  if (itemUnlocks.length > 0) {
    fields.push({
      name: '🔓 New Unlocks',
      value: itemUnlocks.map(u => `• ${u}`).join('\n'),
      inline: false
    });
  }

  if (sectorLines.length > 0) {
    fields.push({
      name: '🗺️ New Sectors',
      value: sectorLines.join('\n\n'),
      inline: false
    });
  }

  return {
    title: `🎉 ${skillName} Level Up!`,
    description: `Congratulations, **${playerName}**!`,
    fields,
    color: COLORS.GOLD
  };
}

export function createLevelUpEmbed(levelUp, playerName = 'Adventurer', contentLoader = null) {
  return createLevelUpSummaryEmbed(levelUp, playerName, contentLoader);
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
      { name: '\u200b', value: 'Use `.claim` later to collect your resources and XP.', inline: false },
      { name: '💡 Tip:', value: 'Use `.mine copper`, `.mine coal`, `.mine lead`, etc. to mine a single resource **3× faster**.', inline: false }
    ],
    color: COLORS.SUCCESS
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
  const gold = formatNumber(shopData.currencies?.gold || 0);

  const itemDisplays = sellItems.map(item => ({
    item,
    display: getItemDisplay(item.id, contentLoader),
    quantity: formatNumber(item.quantity),
    price: formatNumber(item.unitValue)
  }));

  const nameWidth = itemDisplays.reduce((width, entry) => Math.max(width, entry.display.name.length), 0);
  const quantityWidth = itemDisplays.reduce((width, entry) => Math.max(width, entry.quantity.length), 0);
  const priceWidth = itemDisplays.reduce((width, entry) => Math.max(width, entry.price.length), 0);
  const nbsp = '\u00a0';
  const padEnd = (value, width) => value + nbsp.repeat(Math.max(0, width - value.length));
  const padStart = (value, width) => nbsp.repeat(Math.max(0, width - value.length)) + value;

  const itemLines = itemDisplays.map(({ display, quantity, price }) => {
    return `${display.emoji}${nbsp}${padEnd(display.name, nameWidth)}${nbsp.repeat(2)}×${padStart(quantity, quantityWidth)}${nbsp.repeat(2)}${padStart(price, priceWidth)}g`;
  });

  const itemsText = itemLines.length > 0
    ? formatLinesWithLimit(itemLines, '\n', 3800)
    : '*No sellable items in inventory.*';

  return {
    title: '🏪 Town Merchant',
    description: [
      `💰 **Gold:** ${gold}`,
      '',
      '📦 **Sellable Items**',
      '',
      itemsText,
      '',
      'Use:',
      '`.sell <item> <amount>`',
      '`.sell all`'
    ].join('\n'),
    color: COLORS.GOLD
  };
}

export function createPotionShopEmbed(shopData, contentLoader) {
  const potions = Array.isArray(shopData?.potions) ? shopData.potions : [];
  const gold = formatNumber(shopData?.currencies?.gold || 0);
  const groups = new Map();

  // Map insertion order is the canonical order from potions.json.
  for (const potion of potions) {
    if (!groups.has(potion.potionType)) groups.set(potion.potionType, []);
    groups.get(potion.potionType).push(potion);
  }

  const fields = [];
  for (const [potionType, group] of groups) {
    const categoryEmoji = group[0]?.emoji || '🧪';
    const lines = group.map(potion => {
      const display = getItemDisplay(potion.id, contentLoader);
      const owned = formatNumber(potion.owned || 0);
      const effect = potion.effectLabel || potion.description || 'Consumable effect';
      return `${display.emoji} **${display.name}** — ${effect} — **${formatNumber(potion.buyPrice)}g** *(×${owned})*`;
    });
    fields.push({
      name: `${categoryEmoji} ${formatName(potionType)} Potions`,
      value: formatLinesWithLimit(lines, '\n', 1000),
      inline: false
    });
  }

  if (fields.length === 0) {
    fields.push({ name: '🧪 Potions', value: '*No potions are currently available.*', inline: false });
  }

  return {
    title: '🧪 Potion Shop',
    description: `💰 **Gold:** ${gold}\n\nBuy potions with:\n\`.buy <potion> <amount>\``,
    fields,
    color: COLORS.GOLD,
    footer: { text: 'Use `.use <item>` to consume a potion. Active buffs last for their listed duration.' }
  };
}

export function createHuntPotionShopEmbed(shopData, notice = null) {
  return {
    title: '🧪 Potion Shop',
    description: [
      notice || null,
      `💰 **Gold:** ${formatNumber(shopData?.currencies?.gold || 0)}`,
      '',
      'Choose a potion category.'
    ].filter(value => value !== null).join('\n'),
    color: COLORS.GOLD
  };
}

export function createHuntPotionCategoryEmbed(category, potions = []) {
  const emoji = potions[0]?.emoji || '🧪';
  return {
    title: `${emoji} ${formatName(category)} Potions`,
    description: 'Choose a size.',
    color: COLORS.GOLD
  };
}

export function createHuntPotionPurchaseEmbed(potion, quantity = 1) {
  const effect = potion?.effectLabel || potion?.description || 'Potion effect';
  const duration = potion?.effect?.durationMs ? formatDuration(potion.effect.durationMs) : 'Instant';
  const totalPrice = (potion?.buyPrice || 0) * quantity;

  return {
    title: '🧪 Purchase Potion',
    fields: [
      { name: `${potion?.emoji || '🧪'} Item`, value: potion?.name || 'Potion', inline: false },
      { name: '✨ Effect', value: effect, inline: false },
      { name: '⏳ Duration', value: duration, inline: true },
      { name: '💰 Price', value: `${formatNumber(potion?.buyPrice || 0)} Gold each`, inline: true },
      { name: '📦 Quantity', value: `×${formatNumber(quantity)} — ${formatNumber(totalPrice)} Gold`, inline: false }
    ],
    color: COLORS.GOLD
  };
}

export function createBuyPotionEmbed(result, contentLoader) {
  if (!result?.success) {
    return createErrorEmbed('Potion Purchase Failed', result?.message || `Unable to buy ${result?.potionInput || 'that potion'}.`);
  }
  const display = getItemDisplay(result.potionId, contentLoader);
  return {
    title: '🧪 Potion Purchase Complete',
    description: `Bought ${display.label} ×**${formatNumber(result.quantity)}**.`,
    fields: [
      { name: '💰 Cost', value: `**${formatNumber(result.totalCost)}g**`, inline: true },
      { name: '💳 Gold Remaining', value: `**${formatNumber(result.newGoldBalance)}g**`, inline: true },
      { name: '📦 Owned', value: `**${formatNumber(result.totalOwned)}**`, inline: true }
    ],
    color: COLORS.SUCCESS
  };
}

function formatDuration(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatActiveBuffLines(buffs, contentLoader) {
  const activeBuffs = Array.isArray(buffs) ? buffs : [];
  return activeBuffs.map(buff => {
    const display = buff.sourcePotionId
      ? getItemDisplay(buff.sourcePotionId, contentLoader)
      : { emoji: '✨', name: `${formatName(buff.buffType)} Buff` };
    const effect = buff.effectLabel || `+${formatNumber(buff.amount)} ${formatName(buff.stat)}`;
    return `${display.emoji} **${display.name}** — ${effect} — **${formatDuration(buff.remainingMs)}** remaining`;
  });
}

export function createUseItemEmbed(result, contentLoader) {
  if (!result?.success) {
    return createErrorEmbed('Use Item Failed', result?.message || 'That item cannot be used as a potion.');
  }
  const display = getItemDisplay(result.potionId, contentLoader);
  const potion = result.potion;
  const fields = [];

  if (potion.effect.kind === 'buff' && result.buff) {
    fields.push({
      name: '✨ Active Buff',
      value: `${result.buff.effectLabel || potion.effectLabel || potion.description}\nRemaining: **${formatDuration(result.buff.remainingMs)}**`,
      inline: false
    });
  } else {
    fields.push({
      name: '❤️ Health',
      value: `**${formatNumber(result.hpBefore)}** → **${formatNumber(result.hpAfter)}** HP`,
      inline: false
    });
  }

  return {
    title: '🧪 Potion Used',
    description: `Consumed ${display.label}.`,
    fields,
    color: COLORS.SUCCESS
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
    footer: { text: 'Use /hunt <enemy_id> to enter battle!' }
  };
}

export function createAreasEmbed(playerOrAreaId, allAreas, availableAreas, contentLoader) {
  const currentAreaId = typeof playerOrAreaId === 'string' ? playerOrAreaId : (playerOrAreaId?.currentAreaId || 'starter_village');
  const visitedAreas = typeof playerOrAreaId === 'string'
    ? ['starter_village']
    : getVisitedAreaIdsForPlayer(playerOrAreaId);
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
      const reqMsg = `Requires Hero Level ${formatNumber(sector?.requiredHeroLevel || 1)}`;
      return `🔒 **${display.label}** - *${reqMsg}*`;
    }
  });

  return {
    title: `🗺️ World Regions & Areas`,
    description: lines.join('\n\n'),
    color: COLORS.PRIMARY,
    footer: { text: 'Use /travel <sector> to travel to an unlocked area.' }
  };
}

export function createAlreadyMiningEmbed(skillName = 'mining') {
  const emoji = skillName === 'woodcutting' ? '🪓' : skillName === 'fishing' ? '🎣' : '⛏️';
  const actionText = skillName === 'woodcutting' ? 'woodcutting' : skillName === 'fishing' ? 'fishing' : 'mining';
  return {
    title: `${emoji} Already Mining`,
    description: `You're already ${actionText}.\n\nUse \`.claim\` to collect your rewards, or wait longer to earn more.`,
    color: COLORS.WARNING
  };
}

export function createNothingToClaimEmbed() {
  return {
    title: '📦 Nothing to Claim',
    description: `You haven't started mining yet.\n\nStart with:\n\n\`.mine\`\n\nThen, after mining for a while, use:\n\n\`.claim\`\n\nto collect your resources and XP.`,
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

export function createTravelSuccessEmbed(fromAreaId, toAreaId, contentLoader) {
  const toDisplay = getAreaDisplay(toAreaId, contentLoader);
  
  let description = `You have arrived at **${toDisplay.label}**.`;

  if (contentLoader) {
    const miningResources = [];
    const allActivities = contentLoader.getAll('activities') || [];
    for (const act of allActivities) {
      if (act.skillId !== 'mining') continue;
      const owningAreaId = getActivityOwningAreaId(act, contentLoader);
      if (owningAreaId === toAreaId) {
        const lt = contentLoader.getLootTable(act.lootTableId);
        const itemId = lt?.entries?.[0]?.itemId;
        const itemDef = itemId ? contentLoader.getItem(itemId) : null;
        const name = itemDef?.name || act.name;
        if (name && !miningResources.some(r => r.name === name)) {
          const cmdKeyword = (itemId || act.id).replace('_ore', '').replace('_node', '').replace('mine_', '');
          miningResources.push({ name, cmdKeyword });
        }
      }
    }

    if (miningResources.length > 0) {
      description += `\n\n⛏️ **New Resources**\n` + miningResources.map(r => `• ${r.name}`).join('\n');

      const sampleCmd = miningResources[0].cmdKeyword.toLowerCase();
      const sampleName = miningResources[0].name.replace(/ Ore$/i, '');

      description += `\n\n💡 **Tip:**\nUse \`.mine\` to automatically mine all unlocked resources.\n\nOr use \`.mine ${sampleCmd}\` to focus on ${sampleName} at **3× speed**.`;
    }

    // Show enemies in the new area
    const areaDef = contentLoader.getArea(toAreaId);
    const areaEnemies = (areaDef?.enemyIds || []).map(id => contentLoader.getEnemy(id)).filter(Boolean);
    if (areaEnemies.length > 0) {
      description += `\n\n⚔️ **Monsters Here**\n` + areaEnemies.map(e => `• 👹 ${e.name} \`[Lv.${e.level}]\``).join('\n');
      description += `\n\n💡 **Tip:**\nUse \`.hunt\` to automatically fight all unlocked enemies.\n\nOr use \`.hunt ${areaEnemies[0].id}\` to focus on ${areaEnemies[0].name} at **3× speed**.`;
    }
  }

  return {
    title: `🗺️ Travel Successful`,
    description,
    color: COLORS.SUCCESS
  };
}

const BUFF_EMOJIS = {
  strength: '💪',
  attack: '⚔️',
  defense: '🛡️',
  luck: '🍀',
  accuracy: '🎯',
  haste: '⚡',
  regeneration: '❤️',
  wealth: '💰',
  experience: '✨'
};

export function createHuntOverviewEmbed(overview, contentLoader) {
  const area = getAreaDisplay(overview?.currentAreaId, contentLoader);
  const level = overview?.level || 1;
  const heroXp = overview?.heroXp || 0;
  const nextLevelXp = overview?.nextLevelXp || heroXp;
  const xpProgress = nextLevelXp > heroXp ? `${formatNumber(heroXp)} / ${formatNumber(nextLevelXp)}` : `${formatNumber(heroXp)} / MAX`;

  const activeBuffs = Array.isArray(overview?.activeBuffs) ? overview.activeBuffs : [];
  const potionText = activeBuffs.length > 0
    ? activeBuffs.map(buff => {
      const emoji = BUFF_EMOJIS[buff.stat] || '🧪';
      return `${emoji} ${formatName(buff.stat)} (+${formatNumber(buff.amount)}) • ${formatDuration(buff.remainingMs)}`;
    }).join('\n')
    : 'None';

  const monsters = Array.isArray(overview?.availableEnemies) ? overview.availableEnemies : [];
  const monsterText = monsters.length > 0
    ? monsters.map(enemy => `• ${enemy.name}`).join('\n')
    : '*No monsters are available in this area.*';

  return {
    title: '⚔️ Hunting Grounds',
    description: [
      `💰 **Gold:** ${formatNumber(overview?.gold || 0)}`,
      `⭐ **Hero Level:** ${formatNumber(level)} (${xpProgress})`,
      `🗺️ **Current Area:** ${area.label}`
    ].join('\n'),
    fields: [
      { name: '🧪 Active Potions', value: potionText, inline: false },
      { name: '👹 Available Monsters', value: monsterText, inline: false }
    ],
    color: COLORS.PRIMARY
  };
}

export function createInstantCombatEmbed(
  result,
  contentLoader,
  levelUps = result.levelUps || [],
  playerName = 'Adventurer',
  heroLevelUps = result.heroLevelUps || []
) {
  const isVictory = result.victory === true;
  const title = isVictory ? '⚔️ Encounter Victory!' : '💀 Defeated in Encounter!';
  const color = isVictory ? COLORS.SUCCESS : COLORS.ERROR;

  let enemiesStr = '*None*';
  if (Array.isArray(result.enemiesDefeated) && result.enemiesDefeated.length > 0) {
    enemiesStr = result.enemiesDefeated.map(e => `• ${e.name} [Lv.${e.level || 1}]`).join('\n');
  } else if (Array.isArray(result.enemies) && result.enemies.length > 0) {
    enemiesStr = result.enemies.map(e => `• ${e.name} [Lv.${e.level || 1}]`).join('\n');
  }

  let lootStr = '*No items dropped.*';
  if (Array.isArray(result.itemsGained) && result.itemsGained.length > 0) {
    lootStr = result.itemsGained.map(l => {
      const display = getItemDisplay(l.itemId, contentLoader);
      return `${display.emoji} **${display.name}**: ×**${formatNumber(l.amount)}**`;
    }).join('\n');
  } else if (Array.isArray(result.loot) && result.loot.length > 0) {
    lootStr = result.loot.map(l => {
      const display = getItemDisplay(l.itemId, contentLoader);
      return `${display.emoji} **${display.name}**: ×**${formatNumber(l.amount)}**`;
    }).join('\n');
  }

  const hpRem = typeof result.hpRemaining === 'number' ? result.hpRemaining : (typeof result.playerFinalHp === 'number' ? result.playerFinalHp : 100);
  const maxHp = typeof result.maxHp === 'number' ? result.maxHp : 100;

  const fields = [
    { name: '👹 Enemies Defeated', value: enemiesStr, inline: false },
    { name: '❤️ HP Remaining', value: `**${formatNumber(hpRem)}** / **${formatNumber(maxHp)}**`, inline: true },
    { name: '✨ Combat XP', value: `+**${formatNumber(result.xpGained || 0)}** XP`, inline: true },
    { name: '💰 Gold', value: `+**${formatNumber(result.currenciesGained?.gold || 0)}**`, inline: true },
    { name: '📦 Loot', value: lootStr, inline: false }
  ];

  if (result.durabilityChanges?.broken?.length > 0) {
    const brokenList = result.durabilityChanges.broken.map(b => `• ${b.itemName || formatName(b.itemId)} (${b.slot})`).join('\n');
    fields.push({ name: '🔨 Equipment Broken!', value: brokenList, inline: false });
  }

  if (result.equipmentChanges?.equipped?.length > 0) {
    const equipList = result.equipmentChanges.equipped.map(e => {
      const newDisplay = getItemDisplay(e.newItem?.id, contentLoader);
      return `• ${newDisplay.label} equipped to **${e.slot}**`;
    }).join('\n');
    fields.push({ name: '🛡️ Auto-Equipped', value: equipList, inline: false });
  }

  if (result.playerDied) {
    const recSector = result.recommendedSector;
    const recLabel = recSector ? getSectorLabel(recSector.areaId) : 'Starter Village';
    fields.push({
      name: '💀 You were defeated.',
        value: `**Recommended Area**\n🏜️ **${recLabel}**\n\nThis encounter exceeded your current combat stats.\n\n*Upgrade your equipment or return to a safer area before trying again.*`,
      inline: false
    });
  }

  const progressionSummaries = [levelUps, heroLevelUps]
    .filter(summary => Array.isArray(summary) && summary.length > 0);

  for (const summary of progressionSummaries) {
    const levelUpEmbed = createLevelUpSummaryEmbed(summary, playerName, contentLoader);
    if (levelUpEmbed) {
      fields.push({
        name: '\u200b',
        value: `**${levelUpEmbed.title}**\n${levelUpEmbed.description || ''}`,
        inline: false
      });
      for (const field of levelUpEmbed.fields || []) {
        fields.push({ ...field, inline: false });
      }
    }
  }

  return { title, fields, color };
}

export function createStatsEmbed(profile, equipment = {}, attributes = {}, skills = {}, contentLoader = null, playerObject = null) {
  const level = profile.level || 1;
  const battleRank = profile.battleRank || 'Recruit';
  const hp = profile.hp ?? 100;
  const maxHp = profile.maxHp ?? 100;
  const regen = (profile.regenerationText || '+5 HP every 5 minutes')
    .replace(' HP every 5 minutes', '/5m');

  const pObj = playerObject || profile;
  const currentAreaId = pObj.currentAreaId || profile.currentAreaId || 'starter_village';
  const currentSectorLabel = getSectorLabel(currentAreaId);

  const highestExploredSector = getHighestExploredSector(pObj);
  const highestExploredLabel = getSectorLabel(highestExploredSector.areaId);

  const equipStats = profile.equippedStats || {};
  const str = attributes.strength || 1;
  // Keep the displayed combat value aligned with CombatModule. The attack
  // attribute is a displayed progression level, not the raw attack stat.
  const att = 10 + (level * 2) + (equipStats.attack || 0);
  const def = equipStats.defense || 0;
  const acc = equipStats.accuracy || 0;
  const lootLevel = attributes.loot || 1;

  const slots = ['weapon', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet', 'shield'];
  const slotLabels = {
    weapon: '🗡 Weapon',
    helmet: '⛑ Helmet',
    chest: '🥋 Chest',
    legs: '👖 Legs',
    boots: '🥾 Boots',
    gloves: '🧤 Gloves',
    ring: '💍 Ring',
    amulet: '📿 Amulet',
    shield: '🛡 Shield'
  };

  const gearLines = [];
  for (const slot of slots) {
    const item = equipment[slot];
    const label = slotLabels[slot] || slot;
    if (item && item.id) {
      const display = getItemDisplay(item.id, contentLoader);
      const dur = typeof item.durability === 'number' && typeof item.maxDurability === 'number'
        ? `[${item.durability}/${item.maxDurability}]`
        : '[100/100]';
      gearLines.push(`${label}: ${display.emoji} **${display.name}** \`${dur}\``);
    } else {
      gearLines.push(`${label}: Empty`);
    }
  }

  const equipBonuses = [];
  if (equipStats.attack) equipBonuses.push(`+${equipStats.attack} Attack`);
  if (equipStats.defense) equipBonuses.push(`+${equipStats.defense} Defense`);
  if (equipStats.health) equipBonuses.push(`+${equipStats.health} Max HP`);
  if (equipStats.accuracy) equipBonuses.push(`+${equipStats.accuracy} Accuracy`);
  if (equipStats.criticalChance) equipBonuses.push(`+${Math.round(equipStats.criticalChance * 100)}% Crit Chance`);

  const skillLines = SKILL_DISPLAY.map(({ id, label }) => `${label} Lv.${formatNumber(skills[id]?.level || 1)}`);
  const skillRows = [skillLines.slice(0, 2), skillLines.slice(2, 4), skillLines.slice(4)]
    .filter(row => row.length > 0)
    .map(row => row.join(' • '));

  return {
    title: '👤 Hero Stats',
    description: [
      `⭐ Hero Lv.${formatNumber(level)} • 🏅 ${battleRank}`,
      '',
      `📍 ${currentSectorLabel}`,
      `🗺 Highest: ${highestExploredLabel}`,
      '',
      `❤️ HP: ${formatNumber(hp)}/${formatNumber(maxHp)} • 💚 Regen: ${regen}`
    ].join('\n'),
    color: COLORS.PRIMARY,
    fields: [
      {
        name: '⚔ Combat',
        value: `⚔ ATK: ${att} • 🛡 DEF: ${def}\n💪 STR: ${str} • 🎯 ACC: ${acc}\n🍀 Loot: Lv.${formatNumber(lootLevel)}`,
        inline: false
      },
      {
        name: '🛡 Equipment',
        value: gearLines.join('\n'),
        inline: false
      },
      ...(equipBonuses.length > 0 ? [{
        name: '✨ Bonuses',
        value: equipBonuses.join(' • '),
        inline: false
      }] : []),
      {
        name: '📜 Skills',
        value: skillRows.join('\n'),
        inline: false
      }
    ]
  };
}

export function createAutoHuntStartEmbed(result, contentLoader) {
  return createInstantCombatEmbed(result, contentLoader);
}

export function createAlreadyHuntingEmbed() {
  return {
    title: '⚔️ Instant Combat Completed',
    description: 'Use `.hunt` to fight unlocked enemies instantly.',
    color: COLORS.PRIMARY
  };
}

export function createAutoHuntClaimEmbed(result, contentLoader) {
  return createInstantCombatEmbed(result, contentLoader);
}

export function createHelpEmbed() {
  return {
    title: `🎮 Idelon Game Commands`,
    description: 'Welcome to Idelon! Use the slash commands below, or their `.command` aliases, to play.',
    fields: [
      { name: '👤 Player Commands', value: '`/start` • `/profile` • `/stats` • `/skills` • `/equipment`', inline: false },
      { name: '⛏️ Activity Commands', value: '`/mine` • `/claim`', inline: false },
      { name: '🎒 Inventory & Vault', value: '`/inv` • `/storage` • `/deposit` • `/withdraw`', inline: false },
      { name: '⚔️ Combat Commands', value: '`/hunt` • `/enemies`', inline: false },
      { name: '🗺️ World Commands', value: '`/travel <sector>` • `/areas`', inline: false },
      { name: '🏪 Economy Commands', value: '`/bal` • `/shop` • `/sell` • `/potionshop` • `/buy`', inline: false },
      { name: '🧪 Potion Commands', value: '`/use <item>` • `.use <item>`', inline: false },
      { name: '🛠️ Admin Toolkit', value: '`/dev`', inline: false }
    ],
    color: COLORS.PRIMARY,
    footer: { text: 'Idelon Idle RPG Engine v1.0 • Mining Progression System v1' }
  };
}
