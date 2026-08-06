import {
  createErrorEmbed,
  createHuntOverviewEmbed,
  createInstantCombatEmbed,
  createHuntInventoryEmbed,
  createHuntConsumablesEmbed,
  createHuntConsumableSelectEmbed,
  createHuntConsumableUseEmbed,
  createHuntEquipmentEmbed,
  createHuntEquipmentInventoryEmbed,
  createHuntPotionCategoryEmbed,
  createHuntPotionPurchaseEmbed,
  createHuntPotionShopEmbed,
  createHuntSaleConfirmationEmbed,
  createHuntSellMenuEmbed,
  getItemDisplay
} from '../../embeds.js';
import { INVENTORY_SALE_GROUPS, POTION_QUANTITIES } from '../../huntUi.js';
import { formatNumber } from '../../../utils/formatter.js';

const SALE_ACTION_GROUPS = Object.freeze({
  inventory_sell_ores: INVENTORY_SALE_GROUPS.ores,
  inventory_sell_monster_drops: INVENTORY_SALE_GROUPS.monsterDrops
});

const CONFIRM_ACTION_GROUPS = Object.freeze({
  inventory_confirm_ores: INVENTORY_SALE_GROUPS.ores,
  inventory_confirm_monster_drops: INVENTORY_SALE_GROUPS.monsterDrops
});

function getPotionFromShop(shop, potionId) {
  return shop?.potions?.find(potion => potion.id === potionId) || null;
}

function getFallbackHuntView(action) {
  if (action === 'shop' || action === 'potion_back_shop') return 'potion_shop';
  if (action === 'inventory' || action === 'inventory_back' || action === 'inventory_cancel') return 'inventory';
  if (action === 'consumables' || action === 'consumables_back') return 'consumables';
  if (action === 'consumables_use' || action === 'consumable_item') return 'consumable_select';
  if (action === 'consumable_quantity' || action === 'consumable_confirm') return 'consumable_quantity';
  if (action === 'equipment' || action === 'equipment_unequip_item' || action === 'equipment_unequip') return 'equipment';
  if (action === 'equipment_inventory' || action === 'equipment_item' || action === 'equipment_equip') return 'equipment_inventory';
  if (action === 'inventory_sell' || SALE_ACTION_GROUPS[action]) return 'sell_menu';
  if (CONFIRM_ACTION_GROUPS[action]) return 'inventory';
  if (action === 'potion_category') return 'potion_shop';
  if (action === 'potion_size' || action === 'potion_back_category' || action === 'potion_quantity') return 'potion_category';
  if (action === 'potion_purchase') return 'potion_shop';
  return 'overview';
}

async function createOverviewResponse(interaction, gameService) {
  const overview = await gameService.getHuntOverview(interaction.user.id);
  return {
    embed: createHuntOverviewEmbed(overview, gameService.engine.content),
    huntView: 'overview'
  };
}

async function createCombatResponse(interaction, gameService, targetInput = null) {
  const result = await gameService.huntInstant(interaction.user.id, targetInput);

  if (!result.success && result.reason === 'unknown_enemy') {
    return { embed: createErrorEmbed('Unknown Enemy', `Enemy \`${targetInput}\` does not exist. Use \`.enemies\` to see available enemies.`) };
  }
  if (!result.success && result.reason === 'enemy_not_accessible') {
    return { embed: createErrorEmbed('Enemy Not Accessible', `You haven't explored the area where \`${targetInput}\` lives. Use \`.travel\` to explore new sectors.`) };
  }
  if (!result.success && result.reason === 'no_enemies') {
    return {
      embed: createErrorEmbed('No Enemies Available', 'No enemies are available in your explored sectors. Use `.travel` to explore new sectors.'),
      huntView: 'overview'
    };
  }

  return {
    embed: createInstantCombatEmbed(
      result,
      gameService.engine.content,
      result.levelUps,
      interaction.user.username
    ),
    huntView: 'combat'
  };
}

async function createInventoryResponse(interaction, gameService, notice = null) {
  const summary = await gameService.getHuntInventory(interaction.user.id);
  return {
    embed: createHuntInventoryEmbed(interaction.user.username, summary, gameService.engine.content, notice),
    huntView: 'inventory'
  };
}

async function createConsumablesResponse(interaction, gameService, notice = null) {
  const shop = await gameService.getPotionShop(interaction.user.id);
  const consumables = shop.potions.filter(potion => Number(potion.owned) > 0);
  return {
    embed: createHuntConsumablesEmbed(consumables, notice),
    huntView: 'consumables',
    huntData: { consumables }
  };
}

async function createConsumableSelectResponse(interaction, gameService) {
  const shop = await gameService.getPotionShop(interaction.user.id);
  const consumables = shop.potions.filter(potion => Number(potion.owned) > 0);
  if (consumables.length === 0) {
    return createConsumablesResponse(interaction, gameService);
  }
  return {
    embed: createHuntConsumableSelectEmbed(consumables),
    huntView: 'consumable_select',
    huntData: { consumables }
  };
}

async function createConsumableQuantityResponse(interaction, gameService, potionId, quantity = 1) {
  const shop = await gameService.getPotionShop(interaction.user.id);
  const potion = shop.potions.find(candidate => candidate.id === potionId && Number(candidate.owned) > 0);
  if (!potion) {
    return createConsumablesResponse(interaction, gameService, 'That consumable is no longer available.');
  }

  const safeQuantity = Math.max(1, Math.min(potion.owned, Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1));
  return {
    embed: createHuntConsumableUseEmbed(potion, safeQuantity),
    huntView: 'consumable_quantity',
    huntData: { potion, quantity: safeQuantity }
  };
}

function getUseFailureMessage(result) {
  if (result?.reason === 'item_not_in_inventory') return 'You no longer own that consumable.';
  if (result?.reason === 'not_a_potion') return 'That item is not usable here.';
  return result?.message || 'The consumable could not be used.';
}

async function completeConsumableUseResponse(interaction, gameService, potionId, quantity) {
  const requestedQuantity = Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1;
  let used = 0;
  let potionName = potionId;
  let failure = null;

  for (let index = 0; index < requestedQuantity; index++) {
    const result = await gameService.useItem(interaction.user.id, potionId);
    if (!result.success) {
      failure = getUseFailureMessage(result);
      break;
    }
    used++;
    potionName = result.potion?.name || potionName;
  }

  if (used === 0) {
    return createConsumablesResponse(interaction, gameService, failure || 'The consumable could not be used.');
  }

  const notice = `Used ${potionName} ×${used}.${failure ? ` ${failure}` : ''}`;
  return createConsumablesResponse(interaction, gameService, notice);
}

async function createEquipmentResponse(interaction, gameService, selectedSlot = null, notice = null) {
  const equipment = await gameService.getEquipment(interaction.user.id);
  const equipmentWithDisplay = Object.fromEntries(Object.entries(equipment).map(([slot, item]) => [
    slot,
    { ...item, emoji: getItemDisplay(item.id, gameService.engine.content).emoji }
  ]));
  return {
    embed: createHuntEquipmentEmbed(equipmentWithDisplay, gameService.engine.content, selectedSlot, notice),
    huntView: 'equipment',
    huntData: { equipment: equipmentWithDisplay, selectedSlot }
  };
}

async function createEquipmentInventoryResponse(interaction, gameService, selectedItemId = null) {
  const inventory = await gameService.getInventory(interaction.user.id);
  const content = gameService.engine.content;
  const items = Object.entries(inventory)
    .filter(([, quantity]) => Number(quantity) > 0)
    .map(([id, quantity]) => {
      const itemDef = content.getEquipment(id) || content.getItem(id);
      if (!itemDef?.slot) return null;
      return {
        id,
        name: itemDef.name,
        quantity,
        display: {
          emoji: getItemDisplay(id, content).emoji,
          name: itemDef.name
        }
      };
    })
    .filter(Boolean);

  return {
    embed: createHuntEquipmentInventoryEmbed(items, selectedItemId),
    huntView: 'equipment_inventory',
    huntData: { items, selectedItemId }
  };
}

async function completeEquipResponse(interaction, gameService, itemId) {
  if (!itemId) return createEquipmentInventoryResponse(interaction, gameService);
  const result = await gameService.equip(interaction.user.id, itemId);
  if (!result.success) {
    const reason = result.reason === 'level_too_low'
      ? `You need level ${result.requiredLevel} to equip that item.`
      : result.reason === 'item_not_in_inventory'
        ? 'That item is no longer in your inventory.'
        : 'That item cannot be equipped.';
    return createEquipmentInventoryResponse(interaction, gameService, itemId).then(response => ({
      ...response,
      embed: createHuntEquipmentInventoryEmbed(response.huntData.items, itemId, reason)
    }));
  }

  const swapped = result.unequipped?.name ? ` ${result.unequipped.name} moved to inventory.` : '';
  return createEquipmentResponse(interaction, gameService, null, `Equipped ${result.equipped?.name || itemId}.${swapped}`);
}

async function completeUnequipResponse(interaction, gameService, slot) {
  if (!slot) return createEquipmentResponse(interaction, gameService);
  const result = await gameService.unequip(interaction.user.id, slot);
  if (!result.success) return createEquipmentResponse(interaction, gameService, null, 'That equipment slot is already empty.');
  return createEquipmentResponse(interaction, gameService, null, `${result.unequipped?.name || 'Equipment'} moved to inventory.`);
}

async function createPotionShopResponse(interaction, gameService, notice = null) {
  const shop = await gameService.getPotionShop(interaction.user.id);
  return {
    embed: createHuntPotionShopEmbed(shop, notice),
    huntView: 'potion_shop',
    huntData: { potions: shop.potions }
  };
}

async function createPotionCategoryResponse(interaction, gameService, category) {
  const shop = await gameService.getPotionShop(interaction.user.id);
  const potions = shop.potions.filter(potion => potion.potionType === category);
  if (potions.length === 0) {
    return createPotionShopResponse(interaction, gameService, '⚠️ That potion category is unavailable.');
  }

  return {
    embed: createHuntPotionCategoryEmbed(category, potions),
    huntView: 'potion_category',
    huntData: { category, potions }
  };
}

async function createPotionPurchaseResponse(interaction, gameService, potionId, quantity = 1) {
  const shop = await gameService.getPotionShop(interaction.user.id);
  const potion = getPotionFromShop(shop, potionId);
  if (!potion) {
    return createPotionShopResponse(interaction, gameService, '⚠️ That potion is no longer available.');
  }

  const safeQuantity = POTION_QUANTITIES.includes(quantity) ? quantity : POTION_QUANTITIES[0];
  return {
    embed: createHuntPotionPurchaseEmbed(potion, safeQuantity),
    huntView: 'potion_purchase',
    huntData: { potion, quantity: safeQuantity }
  };
}

async function completePotionPurchaseResponse(interaction, gameService, potionId, quantity) {
  const safeQuantity = POTION_QUANTITIES.includes(quantity) ? quantity : POTION_QUANTITIES[0];
  const result = await gameService.buyPotion(interaction.user.id, potionId, safeQuantity);
  const potionName = result.potion?.name || potionId;
  const notice = result.success
    ? `✅ Purchased ${potionName} ×${formatNumber(safeQuantity)}.`
    : `❌ Purchase failed: ${result.message || 'That potion could not be purchased.'}`;
  return createPotionShopResponse(interaction, gameService, notice);
}

async function createSaleConfirmationResponse(interaction, gameService, group) {
  const saleGroups = await gameService.getInventorySaleGroups(interaction.user.id);
  const items = group.key === INVENTORY_SALE_GROUPS.ores.key
    ? saleGroups.ores
    : saleGroups.monsterDrops;

  if (items.length === 0) {
    return {
      embed: createErrorEmbed('Nothing to Sell', `You do not have any ${group.name.toLowerCase()} to sell.`),
      huntView: 'sell_menu'
    };
  }

  return {
    embed: createHuntSaleConfirmationEmbed(group, items, gameService.engine.content),
    huntView: group.key === INVENTORY_SALE_GROUPS.ores.key ? 'confirm_ores' : 'confirm_monster_drops'
  };
}

async function completeSaleResponse(interaction, gameService, group) {
  const result = await gameService.sellInventoryGroup(interaction.user.id, group.key);
  if (!result.success) {
    return createInventoryResponse(interaction, gameService, `Nothing was sold: ${group.name.toLowerCase()} are not available.`);
  }

  const itemCount = result.itemsSold.reduce((sum, item) => sum + item.quantity, 0);
  const notice = `Sold ${formatNumber(itemCount)} item${itemCount === 1 ? '' : 's'} for ${formatNumber(result.totalGold)} Gold.`;
  return createInventoryResponse(interaction, gameService, notice);
}

export async function executeHuntAction(action, interaction, gameService) {
  try {
    if (action === 'fight') return await createCombatResponse(interaction, gameService);
    if (action === 'return') return await createOverviewResponse(interaction, gameService);

    if (action === 'shop') {
      return await createPotionShopResponse(interaction, gameService);
    }

    if (action === 'inventory') {
      return await createInventoryResponse(interaction, gameService);
    }

    if (action === 'consumables') {
      return await createConsumablesResponse(interaction, gameService);
    }

    if (action === 'consumables_use') {
      return await createConsumableSelectResponse(interaction, gameService);
    }

    if (action === 'consumable_item') {
      return await createConsumableQuantityResponse(interaction, gameService, interaction.selectedValue);
    }

    if (action === 'consumable_quantity') {
      const potionId = interaction.componentData?.[0];
      const quantity = interaction.componentData?.[1] === 'max'
        ? Number.MAX_SAFE_INTEGER
        : Number(interaction.componentData?.[1]);
      return await createConsumableQuantityResponse(interaction, gameService, potionId, quantity);
    }

    if (action === 'consumable_confirm') {
      const potionId = interaction.componentData?.[0];
      const quantity = Number(interaction.componentData?.[1]);
      return await completeConsumableUseResponse(interaction, gameService, potionId, quantity);
    }

    if (action === 'equipment') {
      return await createEquipmentResponse(interaction, gameService);
    }

    if (action === 'equipment_inventory') {
      return await createEquipmentInventoryResponse(interaction, gameService);
    }

    if (action === 'equipment_item') {
      return await createEquipmentInventoryResponse(interaction, gameService, interaction.selectedValue);
    }

    if (action === 'equipment_equip') {
      return await completeEquipResponse(interaction, gameService, interaction.componentData?.[0]);
    }

    if (action === 'equipment_unequip_item') {
      return await createEquipmentResponse(interaction, gameService, interaction.selectedValue);
    }

    if (action === 'equipment_unequip') {
      return await completeUnequipResponse(interaction, gameService, interaction.componentData?.[0]);
    }

    if (action === 'equipment_back' || action === 'equipment_inventory_back') {
      return await createEquipmentResponse(interaction, gameService);
    }

    if (action === 'inventory_sell') {
      return { embed: createHuntSellMenuEmbed(), huntView: 'sell_menu' };
    }

    if (action === 'inventory_back' || action === 'inventory_cancel') {
      return await createInventoryResponse(interaction, gameService);
    }

    if (SALE_ACTION_GROUPS[action]) {
      return await createSaleConfirmationResponse(interaction, gameService, SALE_ACTION_GROUPS[action]);
    }

    if (CONFIRM_ACTION_GROUPS[action]) {
      return await completeSaleResponse(interaction, gameService, CONFIRM_ACTION_GROUPS[action]);
    }

    if (action === 'potion_category') {
      return await createPotionCategoryResponse(interaction, gameService, interaction.selectedValue);
    }

    if (action === 'potion_size') {
      return await createPotionPurchaseResponse(interaction, gameService, interaction.selectedValue);
    }

    if (action === 'potion_quantity') {
      const potionId = interaction.componentData?.[0];
      const quantity = Number(interaction.componentData?.[1]);
      return await createPotionPurchaseResponse(interaction, gameService, potionId, quantity);
    }

    if (action === 'potion_purchase') {
      const potionId = interaction.componentData?.[0];
      const quantity = Number(interaction.componentData?.[1]);
      return await completePotionPurchaseResponse(interaction, gameService, potionId, quantity);
    }

    if (action === 'potion_back_shop') {
      return await createPotionShopResponse(interaction, gameService);
    }

    if (action === 'potion_back_category') {
      return await createPotionCategoryResponse(interaction, gameService, interaction.componentData?.[0]);
    }

    return { embed: createErrorEmbed('Hunt Error', 'That hunt action is no longer available.') };
  } catch (err) {
    return { embed: createErrorEmbed('Hunt Error', err.message), huntView: getFallbackHuntView(action) };
  }
}

export default {
  name: 'hunt',
  category: 'combat',
  description: 'Open the hunting grounds and fight enemies instantly. Optionally target one enemy directly.',
  options: [{ name: 'enemy', description: 'Enemy to target; omit to open the hunting grounds', type: 'STRING', required: false }],
  async execute(interaction, gameService) {
    try {
      const rawInput = interaction.options?.getString('enemy');
      if (!rawInput) return await createOverviewResponse(interaction, gameService);
      return await createCombatResponse(interaction, gameService, rawInput);
    } catch (err) {
      return { embed: createErrorEmbed('Hunt Error', err.message) };
    }
  }
};
