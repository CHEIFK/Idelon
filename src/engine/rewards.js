/**
 * Rewards module for generating loot tables and distributing item/currency rewards.
 */
export class RewardsModule {
  grantLoot(player, items = [], currencies = {}, inventoryModule, economyModule) {
    const grantedItems = [];
    for (const itemObj of items) {
      // ponytail: Static quantity reward for now. Ceiling: Flat drops. Upgrade path: Incorporate weighted random probability loot tables.
      inventoryModule.addItem(player, itemObj.id, itemObj.amount || 1);
      grantedItems.push(itemObj);
    }

    const grantedCurrencies = {};
    for (const [curr, amt] of Object.entries(currencies)) {
      economyModule.addCurrency(player, curr, amt);
      grantedCurrencies[curr] = amt;
    }

    return { grantedItems, grantedCurrencies };
  }
}
