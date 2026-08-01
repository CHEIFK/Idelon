/**
 * Economy module for currency operations (Gold, Gems, Tokens, etc.).
 */
export class EconomyModule {
  addCurrency(player, currency, amount) {
    if (!player.currencies[currency]) {
      player.currencies[currency] = 0;
    }
    player.currencies[currency] += amount;
    return player.currencies[currency];
  }

  removeCurrency(player, currency, amount) {
    if ((player.currencies[currency] || 0) < amount) {
      return false;
    }
    player.currencies[currency] -= amount;
    return true;
  }

  getCurrencies(player) {
    return { ...player.currencies };
  }
}
