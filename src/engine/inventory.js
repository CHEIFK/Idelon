/**
 * Inventory module for managing player item storage.
 */
export class InventoryModule {
  addItem(player, itemId, amount = 1) {
    if (!player.inventory[itemId]) {
      player.inventory[itemId] = 0;
    }
    player.inventory[itemId] += amount;
    return player.inventory[itemId];
  }

  removeItem(player, itemId, amount = 1) {
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
    return (player.inventory[itemId] || 0) >= amount;
  }

  getInventory(player) {
    return { ...player.inventory };
  }
}
