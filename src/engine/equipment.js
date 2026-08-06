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

    const playerLevel = Number.isInteger(player?.level) && player.level > 0 ? player.level : 1;
    if (itemDef.levelReq && playerLevel < itemDef.levelReq) {
      return { success: false, reason: 'level_too_low', requiredLevel: itemDef.levelReq };
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

    if (player.equipment[slot]?.id === itemDef.id) {
      return { success: false, reason: 'already_equipped', slot, equipped: player.equipment[slot] };
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
      stats: { ...(itemDef.stats || {}) },
      durability: itemDef.maxDurability || 100,
      maxDurability: itemDef.maxDurability || 100
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
          if (typeof statValue === 'number' && Number.isFinite(statValue)) {
            totals[statKey] = (totals[statKey] || 0) + statValue;
          }
        }
      }
    }

    return totals;
  }

  reduceDurability(player, amount, contentLoader, inventoryModule, eventsBus) {
    const changes = { broken: [], reduced: [], replacements: [] };
    if (!player.equipment || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return changes;

    for (const slot of Object.keys(player.equipment)) {
      const item = player.equipment[slot];
      if (!item) continue;

      if (item.durability === undefined) {
        const itemDef = contentLoader ? contentLoader.getEquipment(item.id) : null;
        const maxDurability = itemDef?.maxDurability || 100;
        item.durability = maxDurability;
        item.maxDurability = maxDurability;
      }

      item.durability -= amount;
      if (item.durability <= 0) {
        changes.broken.push({ slot, itemId: item.id, itemName: item.name });
        delete player.equipment[slot];

        if (eventsBus) {
          eventsBus.emit(EVENTS.EQUIPMENT_UNEQUIPPED, {
            playerId: player.id,
            itemId: item.id,
            slot
          });
        }

        const bestReplacementId = this._findBestForSlot(player, slot, contentLoader, player.level || 1);
        if (bestReplacementId) {
          const equipRes = this.equip(player, bestReplacementId, contentLoader, inventoryModule, eventsBus);
          if (equipRes.success) {
            changes.replacements.push({ slot, newItemId: bestReplacementId, newItemName: equipRes.equipped.name });
          }
        }
      } else {
        changes.reduced.push({ slot, itemId: item.id, remaining: item.durability, max: item.maxDurability });
      }
    }

    return changes;
  }

  autoEquipBest(player, contentLoader, inventoryModule, eventsBus) {
    const changes = { equipped: [] };
    if (!player.inventory || !contentLoader) return changes;

    const slots = EQUIPMENT_SLOTS.length > 0 ? EQUIPMENT_SLOTS : ['weapon', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet', 'shield'];
    const playerLevel = player.level || 1;

    for (const slot of slots) {
      const bestId = this._findBestForSlot(player, slot, contentLoader, playerLevel);
      if (!bestId) continue;

      const currentItem = player.equipment[slot];
      const bestDef = contentLoader.getEquipment(bestId);

      let shouldEquip = false;
      if (!currentItem) {
        shouldEquip = true;
      } else {
        const currentDef = contentLoader.getEquipment(currentItem.id);
        const currentStats = (currentDef?.stats?.attack || 0) + (currentDef?.stats?.defense || 0) + (currentDef?.stats?.health || 0);
        const bestStats = (bestDef?.stats?.attack || 0) + (bestDef?.stats?.defense || 0) + (bestDef?.stats?.health || 0);
        if (bestStats > currentStats) {
          shouldEquip = true;
        }
      }

      if (shouldEquip) {
        const oldItem = currentItem ? { id: currentItem.id, name: currentItem.name } : null;
        const equipRes = this.equip(player, bestId, contentLoader, inventoryModule, eventsBus);
        if (equipRes.success) {
          changes.equipped.push({ slot, newItem: { id: bestId, name: bestDef.name }, oldItem });
        }
      }
    }

    return changes;
  }

  _findBestForSlot(player, slot, contentLoader, playerLevel) {
    if (!player.inventory || !contentLoader) return null;

    let bestId = null;
    let maxStats = -1;

    for (const [itemId, qty] of Object.entries(player.inventory)) {
      if (qty < 1) continue;

      const itemDef = contentLoader.getEquipment(itemId);
      if (!itemDef || itemDef.slot !== slot) continue;
      if (itemDef.levelReq && playerLevel < itemDef.levelReq) continue;

      const totalStats = (itemDef.stats?.attack || 0) + (itemDef.stats?.defense || 0) + (itemDef.stats?.health || 0);
      if (totalStats > maxStats) {
        maxStats = totalStats;
        bestId = itemId;
      }
    }

    return bestId;
  }
}
