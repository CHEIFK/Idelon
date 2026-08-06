/**
 * Inventory module for managing player item storage.
 */
export class InventoryModule {
  addItem(player, itemId, amount = 1) {
    if (!itemId || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
      return player.inventory[itemId] || 0;
    }
    const current = Number.isSafeInteger(player.inventory[itemId]) && player.inventory[itemId] >= 0
      ? player.inventory[itemId]
      : 0;
    if (current > Number.MAX_SAFE_INTEGER - amount) {
      return current;
    }
    player.inventory[itemId] = current + amount;
    return player.inventory[itemId];
  }

  removeItem(player, itemId, amount = 1) {
    if (!itemId || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
      return false;
    }
    if (!this.hasItem(player, itemId, amount)) {
      return false;
    }
    player.inventory[itemId] -= amount;
    if (player.inventory[itemId] <= 0) {
      delete player.inventory[itemId];
    }
    return true;
  }

  hasItem(player, itemId, amount = 1) {
    if (!itemId || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
      return false;
    }
    return Number.isSafeInteger(player.inventory[itemId])
      && player.inventory[itemId] >= amount;
  }

  getInventory(player) {
    return { ...player.inventory };
  }
}
