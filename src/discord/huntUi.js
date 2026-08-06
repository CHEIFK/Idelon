const HUNT_COMPONENT_PREFIX = 'hunt';

const BUTTON_STYLES = {
  PRIMARY: 1,
  SECONDARY: 2,
  SUCCESS: 3
};

export const HUNT_COOLDOWN_MS = 1000;

export const INVENTORY_SALE_GROUPS = Object.freeze({
  ores: Object.freeze({
    key: 'ores',
    emoji: '🪨',
    name: 'Ores',
    buttonLabel: '🪨 Sell All Ores'
  }),
  monsterDrops: Object.freeze({
    key: 'monster_drops',
    emoji: '👹',
    name: 'Monster Drops',
    buttonLabel: '👹 Sell All Monster Drops'
  })
});

export const POTION_QUANTITIES = Object.freeze([1, 5, 10, 25, 50]);
export const CONSUMABLE_QUANTITIES = Object.freeze([1, 5, 10]);

const HUNT_COMPONENT_ACTIONS = new Set([
  'fight',
  'shop',
  'inventory',
  'consumables',
  'consumables_use',
  'consumable_item',
  'consumable_quantity',
  'consumable_confirm',
  'consumables_back',
  'equipment',
  'equipment_inventory',
  'equipment_item',
  'equipment_equip',
  'equipment_unequip_item',
  'equipment_unequip',
  'equipment_back',
  'equipment_inventory_back',
  'return',
  'inventory_sell',
  'inventory_back',
  'inventory_sell_ores',
  'inventory_sell_monster_drops',
  'inventory_confirm_ores',
  'inventory_confirm_monster_drops',
  'inventory_cancel',
  'potion_category',
  'potion_size',
  'potion_quantity',
  'potion_purchase',
  'potion_back_shop',
  'potion_back_category'
]);

const POTION_SIZE_LABELS = Object.freeze(['Small', 'Medium', 'Large', 'Huge', 'Divine']);

function componentId(userId, action, data = []) {
  return [HUNT_COMPONENT_PREFIX, action, ...data, userId].join(':');
}

function button(userId, action, label, style, data = [], disabled = false) {
  return {
    type: 2,
    custom_id: componentId(userId, action, data),
    label,
    style,
    ...(disabled ? { disabled: true } : {})
  };
}

function selectMenu(userId, action, placeholder, options, data = []) {
  return {
    type: 3,
    custom_id: componentId(userId, action, data),
    placeholder,
    min_values: 1,
    max_values: 1,
    options
  };
}

function formatPotionType(potionType) {
  return String(potionType || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getPotionCategories(potions = []) {
  const categories = new Map();
  for (const potion of potions) {
    if (!categories.has(potion.potionType)) {
      categories.set(potion.potionType, {
        value: potion.potionType,
        label: `${potion.emoji || '🧪'} ${formatPotionType(potion.potionType)} Potions`
      });
    }
  }
  return Array.from(categories.values());
}

function getPotionSizeOptions(potions = []) {
  return potions.map((potion, index) => ({
    label: `${['🧪', '🧴', '🍶', '🏺', '✨'][(potion.tier || index + 1) - 1] || '🧪'} ${POTION_SIZE_LABELS[(potion.tier || index + 1) - 1] || potion.name}`,
    value: potion.id,
    description: `${potion.buyPrice} Gold`
  }));
}

function getConsumableOptions(consumables = []) {
  return consumables.map(potion => ({
    label: `${potion.emoji || '🧪'} ${potion.name}`.slice(0, 100),
    value: potion.id,
    description: `Owned ×${potion.owned}`.slice(0, 100)
  }));
}

function splitOptions(options = [], size = 25) {
  const chunks = [];
  for (let index = 0; index < options.length; index += size) {
    chunks.push(options.slice(index, index + size));
  }
  return chunks;
}

function getEquipmentOptions(items = []) {
  return items.slice(0, 25).map(item => ({
    label: `${item.display?.emoji || '📦'} ${item.display?.name || item.name || item.id}`.slice(0, 100),
    value: item.id,
    description: `Owned ×${item.quantity}`.slice(0, 100)
  }));
}

function getEquippedOptions(equipment = {}) {
  return Object.entries(equipment)
    .filter(([, item]) => item?.id)
    .slice(0, 25)
    .map(([slot, item]) => ({
      label: `${item.emoji || '🛡️'} ${item.name || item.id}`.slice(0, 100),
      value: slot,
      description: 'Select to manage'.slice(0, 100)
    }));
}

function hubButtons(id, huntDisabled = false) {
  return [
    button(id, 'fight', '⚔️ Hunt', BUTTON_STYLES.PRIMARY, [], huntDisabled),
    button(id, 'shop', '🏪 Shop', BUTTON_STYLES.SECONDARY),
    button(id, 'inventory', '🎒 Inventory', BUTTON_STYLES.SECONDARY),
    button(id, 'consumables', '🧪 Consumables', BUTTON_STYLES.SECONDARY),
    button(id, 'equipment', '🛡️ Equipment', BUTTON_STYLES.SECONDARY)
  ];
}

function childNavigation(id) {
  return [
    button(id, 'return', '⚔️ Grounds', BUTTON_STYLES.SECONDARY),
    button(id, 'shop', '🏪 Shop', BUTTON_STYLES.SECONDARY),
    button(id, 'inventory', '🎒 Inventory', BUTTON_STYLES.SECONDARY),
    button(id, 'consumables', '🧪 Consumables', BUTTON_STYLES.SECONDARY),
    button(id, 'equipment', '🛡️ Equipment', BUTTON_STYLES.SECONDARY)
  ];
}

export function createHuntComponents(userId, view = 'overview', data = {}, options = {}) {
  const id = String(userId);
  const huntDisabled = options.huntDisabled === true;
  let buttons;
  let rows;

  if (view === 'combat') {
    buttons = [button(id, 'fight', '⚔️ Hunt Again', BUTTON_STYLES.PRIMARY, [], huntDisabled), ...hubButtons(id, huntDisabled).slice(1)];
  } else if (view === 'inventory') {
    buttons = [
      button(id, 'inventory_sell', '💰 Sell', BUTTON_STYLES.PRIMARY),
      button(id, 'return', '⬅ Back', BUTTON_STYLES.SECONDARY),
      button(id, 'consumables', '🧪 Consumables', BUTTON_STYLES.SECONDARY),
      button(id, 'equipment', '🛡️ Equipment', BUTTON_STYLES.SECONDARY)
    ];
  } else if (view === 'sell_menu') {
    buttons = [
      button(id, 'inventory_sell_ores', INVENTORY_SALE_GROUPS.ores.buttonLabel, BUTTON_STYLES.PRIMARY),
      button(id, 'inventory_sell_monster_drops', INVENTORY_SALE_GROUPS.monsterDrops.buttonLabel, BUTTON_STYLES.PRIMARY),
      button(id, 'inventory_back', '⬅ Back', BUTTON_STYLES.SECONDARY)
    ];
  } else if (view === 'confirm_ores' || view === 'confirm_monster_drops') {
    buttons = [
      button(id, `inventory_confirm_${view === 'confirm_ores' ? 'ores' : 'monster_drops'}`, '✅ Confirm', BUTTON_STYLES.SUCCESS),
      button(id, 'inventory_cancel', '❌ Cancel', BUTTON_STYLES.SECONDARY)
    ];
  } else if (view === 'shop') {
    buttons = [button(id, 'return', '⬅ Back', BUTTON_STYLES.SECONDARY), ...childNavigation(id).slice(1, 5)];
  } else if (view === 'potion_shop') {
    const categories = getPotionCategories(data.potions);
    rows = [
      { type: 1, components: [selectMenu(id, 'potion_category', 'Choose a potion category', categories)] },
      {
        type: 1,
        components: [
          button(id, 'return', '⬅ Back', BUTTON_STYLES.SECONDARY),
          button(id, 'inventory', '🎒 Inventory', BUTTON_STYLES.SECONDARY),
          button(id, 'consumables', '🧪 Consumables', BUTTON_STYLES.SECONDARY),
          button(id, 'equipment', '🛡️ Equipment', BUTTON_STYLES.SECONDARY)
        ]
      }
    ];
  } else if (view === 'potion_category') {
    const category = data.category || '';
    rows = [
      { type: 1, components: [selectMenu(id, 'potion_size', 'Choose a potion size', getPotionSizeOptions(data.potions), [category])] },
      { type: 1, components: [button(id, 'potion_back_shop', '⬅ Back', BUTTON_STYLES.SECONDARY)] }
    ];
  } else if (view === 'potion_purchase') {
    const potionId = data.potion?.id || '';
    const quantity = data.quantity || POTION_QUANTITIES[0];
    rows = [
      {
        type: 1,
        components: POTION_QUANTITIES.map(value => button(
          id,
          'potion_quantity',
          String(value),
          value === quantity ? BUTTON_STYLES.SUCCESS : BUTTON_STYLES.SECONDARY,
          [potionId, String(value)]
        ))
      },
      {
        type: 1,
        components: [
          button(id, 'potion_purchase', '🛒 Purchase', BUTTON_STYLES.PRIMARY, [potionId, String(quantity)]),
          button(id, 'potion_back_category', '⬅ Back', BUTTON_STYLES.SECONDARY, [data.potion?.potionType || ''])
        ]
      }
    ];
  } else if (view === 'consumables') {
    buttons = [
      button(id, 'consumables_use', '🧪 Use', BUTTON_STYLES.PRIMARY),
      button(id, 'return', '⬅ Back', BUTTON_STYLES.SECONDARY)
    ];
  } else if (view === 'consumable_select') {
    const consumables = Array.isArray(data.consumables) ? data.consumables : [];
    const optionChunks = splitOptions(getConsumableOptions(consumables));
    rows = optionChunks.slice(0, 4).map((options, index) => ({
      type: 1,
      components: [selectMenu(
        id,
        'consumable_item',
        `Select a consumable${optionChunks.length > 1 ? ` (${index + 1}/${optionChunks.length})` : ''}`,
        options,
        [String(index + 1)]
      )]
    }));
    rows.push({ type: 1, components: [button(id, 'consumables', '⬅ Back', BUTTON_STYLES.SECONDARY)] });
  } else if (view === 'consumable_quantity') {
    const potionId = data.potion?.id || '';
    const owned = Math.max(0, Number(data.potion?.owned || 0));
    const quantity = Math.max(1, Math.min(owned || 1, Number(data.quantity || 1)));
    rows = [
      {
        type: 1,
        components: [
          ...CONSUMABLE_QUANTITIES.map(value => button(
            id,
            'consumable_quantity',
            String(value),
            value === quantity ? BUTTON_STYLES.SUCCESS : BUTTON_STYLES.SECONDARY,
            [potionId, String(value)],
            owned > 0 && value > owned
          )),
          button(id, 'consumable_quantity', 'Max', quantity === owned ? BUTTON_STYLES.SUCCESS : BUTTON_STYLES.SECONDARY, [potionId, 'max'])
        ]
      },
      {
        type: 1,
        components: [
          button(id, 'consumable_confirm', '🧪 Use', BUTTON_STYLES.PRIMARY, [potionId, String(quantity)], owned <= 0),
          button(id, 'consumables', '⬅ Back', BUTTON_STYLES.SECONDARY)
        ]
      }
    ];
  } else if (view === 'equipment') {
    const equipment = data.equipment || {};
    const equippedOptions = getEquippedOptions(equipment);
    rows = [];
    if (equippedOptions.length > 0) {
      rows.push({ type: 1, components: [selectMenu(id, 'equipment_unequip_item', 'Select equipped gear', equippedOptions)] });
    }
    rows.push({
      type: 1,
      components: [
        button(id, 'equipment_inventory', '🎒 Inventory Gear', BUTTON_STYLES.PRIMARY),
        button(id, 'equipment_unequip', 'Unequip', BUTTON_STYLES.SECONDARY, [data.selectedSlot || ''], !data.selectedSlot),
        button(id, 'return', '⬅ Back', BUTTON_STYLES.SECONDARY)
      ]
    });
  } else if (view === 'equipment_inventory') {
    const items = Array.isArray(data.items) ? data.items : [];
    const options = getEquipmentOptions(items);
    rows = [];
    if (options.length > 0) {
      rows.push({ type: 1, components: [selectMenu(id, 'equipment_item', 'Select equipment', options)] });
    }
    rows.push({
      type: 1,
      components: [
        button(id, 'equipment_equip', 'Equip', BUTTON_STYLES.SUCCESS, [data.selectedItemId || ''], !data.selectedItemId),
        button(id, 'equipment', 'Unequip', BUTTON_STYLES.SECONDARY),
        button(id, 'equipment_back', '⬅ Back', BUTTON_STYLES.SECONDARY)
      ]
    });
  } else {
    buttons = hubButtons(id, huntDisabled);
  }

  return rows || [{ type: 1, components: buttons }];
}

export function setHuntButtonDisabled(components, disabled) {
  return (Array.isArray(components) ? components : []).map(row => ({
    ...row,
    components: Array.isArray(row.components)
      ? row.components.map(component => {
        if (component?.type !== 2 || !component.custom_id?.startsWith(`${HUNT_COMPONENT_PREFIX}:fight:`)) {
          return component;
        }
        return { ...component, disabled: disabled === true };
      })
      : row.components
  }));
}

export function parseHuntComponentId(customId) {
  if (typeof customId !== 'string') return null;
  const parts = customId.split(':');
  if (parts.length < 3 || parts[0] !== HUNT_COMPONENT_PREFIX || !HUNT_COMPONENT_ACTIONS.has(parts[1])) return null;
  const userId = parts.pop();
  return { action: parts[1], data: parts.slice(2), userId };
}
