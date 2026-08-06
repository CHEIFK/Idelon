/**
 * Rewards module for generating loot tables and distributing item/currency rewards.
 */
export class RewardsModule {
  grantLoot(player, items = [], currencies = {}, inventoryModule, economyModule) {
    const grantedItems = [];
    if (Array.isArray(items) && inventoryModule) {
      for (const itemObj of items) {
        const amount = itemObj?.amount === undefined ? 1 : itemObj.amount;
        if (!itemObj || typeof itemObj.id !== 'string' || !Number.isSafeInteger(amount) || amount <= 0) continue;
        const before = player.inventory[itemObj.id] || 0;
        const after = inventoryModule.addItem(player, itemObj.id, amount);
        if (after === before + amount) {
          grantedItems.push({ ...itemObj, amount });
        }
      }
    }

    const grantedCurrencies = {};
    if (currencies && typeof currencies === 'object' && !Array.isArray(currencies) && economyModule) {
      for (const [curr, amt] of Object.entries(currencies)) {
        if (!curr || typeof amt !== 'number' || !Number.isFinite(amt) || amt <= 0 || amt > Number.MAX_SAFE_INTEGER) continue;
        const before = player.currencies[curr] || 0;
        const after = economyModule.addCurrency(player, curr, amt);
        if (after === before + amt) {
          grantedCurrencies[curr] = amt;
        }
      }
    }

    return { grantedItems, grantedCurrencies };
  }
}
