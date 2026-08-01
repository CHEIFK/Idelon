import { EVENTS, EQUIPMENT_SLOTS } from '../constants/index.js';

/**
 * Data-Driven Equipment Management Module.
 */
export class EquipmentModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  /**
   * Equip an item from player inventory into its equipment slot.
   */
  equip(
    player,
    itemId,
    contentLoader = this.engine?.content,
    inventoryModule = this.engine?.inventory,
    eventsBus = this.engine?.events
  ) {
    if (!contentLoader) return { success: false, reason: 'no_content_loader' };
    const itemDef = contentLoader.getEquipment(itemId) || contentLoader.getItem(itemId);
    if (!itemDef || !itemDef.slot) {
      return { success: false, reason: 'not_equipable' };
    }

    const slot = itemDef.slot;
    if (EQUIPMENT_SLOTS.length > 0 && !EQUIPMENT_SLOTS.includes(slot) && slot !== 'mainHand' && slot !== 'offHand') {
      return { success: false, reason: 'invalid_slot', slot };
    }

    const hasItem = inventoryModule
      ? inventoryModule.hasItem(player, itemId, 1)
      : ((player.inventory[itemId] || 0) >= 1);

    if (!hasItem) {
      return { success: false, reason: 'item_not_in_inventory' };
    }

    // Handle swapping out existing item in slot
    let previousItem = null;
    if (player.equipment[slot]) {
      previousItem = player.equipment[slot];
      delete player.equipment[slot];
      if (inventoryModule) {
        inventoryModule.addItem(player, previousItem.id, 1);
      } else {
        player.inventory[previousItem.id] = (player.inventory[previousItem.id] || 0) + 1;
      }
    }

    // Remove equipped item from inventory
    if (inventoryModule) {
      inventoryModule.removeItem(player, itemId, 1);
    } else {
      player.inventory[itemId] -= 1;
      if (player.inventory[itemId] <= 0) delete player.inventory[itemId];
    }

    // Place in equipment slot
    player.equipment[slot] = {
      id: itemDef.id,
      name: itemDef.name,
      slot: itemDef.slot,
      stats: { ...(itemDef.stats || {}) }
    };

    if (eventsBus) {
      eventsBus.emit(EVENTS.EQUIPMENT_EQUIPPED, {
        playerId: player.id,
        itemId: itemDef.id,
        slot,
        stats: player.equipment[slot].stats,
        unequippedItemId: previousItem ? previousItem.id : null
      });
    }

    return {
      success: true,
      slot,
      equipped: player.equipment[slot],
      unequipped: previousItem
    };
  }

  /**
   * Unequip an item from a slot and return it to player inventory.
   */
  unequip(
    player,
    slot,
    inventoryModule = this.engine?.inventory,
    eventsBus = this.engine?.events
  ) {
    const unequipped = player.equipment[slot];
    if (!unequipped) {
      return { success: false, reason: 'slot_empty' };
    }

    delete player.equipment[slot];

    if (inventoryModule) {
      inventoryModule.addItem(player, unequipped.id, 1);
    } else {
      player.inventory[unequipped.id] = (player.inventory[unequipped.id] || 0) + 1;
    }

    if (eventsBus) {
      eventsBus.emit(EVENTS.EQUIPMENT_UNEQUIPPED, {
        playerId: player.id,
        itemId: unequipped.id,
        slot
      });
    }

    return {
      success: true,
      slot,
      unequipped
    };
  }

  /**
   * Get shallow copy of player equipment object.
   */
  getEquipped(player) {
    return { ...player.equipment };
  }

  /**
   * Aggregate total stats/bonuses from all equipped items.
   */
  getTotalStats(player) {
    const totals = {};

    for (const slotItem of Object.values(player.equipment || {})) {
      if (slotItem && slotItem.stats) {
        for (const [statKey, statValue] of Object.entries(slotItem.stats)) {
          if (typeof statValue === 'number') {
            totals[statKey] = (totals[statKey] || 0) + statValue;
          }
        }
      }
    }

    return totals;
  }
}
