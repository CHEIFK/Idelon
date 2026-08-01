/**
 * Migration 004 — Add sterlings premium currency field to player saves.
 */
export function migrate004(data) {
  if (typeof data.sterlings !== 'number') {
    data.sterlings = 0;
  }
  // Ensure gold still exists in currencies
  if (!data.currencies || typeof data.currencies !== 'object') {
    data.currencies = { gold: 0 };
  }
  if (typeof data.currencies.gold !== 'number') {
    data.currencies.gold = 0;
  }
  return data;
}
