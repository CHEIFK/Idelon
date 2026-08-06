/**
 * Economy module for the supported wallet currencies (Gold and Sterlings).
 */
export class EconomyModule {
  addCurrency(player, currency, amount) {
    if (!currency || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
      return player.currencies[currency] || 0;
    }
    const current = typeof player.currencies[currency] === 'number'
      && Number.isFinite(player.currencies[currency])
      && player.currencies[currency] >= 0
      && player.currencies[currency] <= Number.MAX_SAFE_INTEGER
      ? player.currencies[currency]
      : 0;
    if (amount > Number.MAX_SAFE_INTEGER - current) {
      return current;
    }
    player.currencies[currency] = current + amount;
    return player.currencies[currency];
  }

  removeCurrency(player, currency, amount) {
    if (!currency || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
      return false;
    }
    const current = typeof player.currencies[currency] === 'number'
      && Number.isFinite(player.currencies[currency])
      && player.currencies[currency] >= 0
      && player.currencies[currency] <= Number.MAX_SAFE_INTEGER
      ? player.currencies[currency]
      : null;
    if (current === null || current < amount) {
      return false;
    }
    player.currencies[currency] = current - amount;
    return true;
  }

  getCurrencies(player) {
    return { ...player.currencies };
  }
}
