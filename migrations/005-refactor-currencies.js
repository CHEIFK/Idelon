/**
 * Migration 005 — Refactor currency model: move sterlings into player.currencies.sterlings and remove gems.
 */
export function migrate005(data) {
  const gold = typeof data.currencies?.gold === 'number' ? data.currencies.gold : 0;
  const sterlings = typeof data.currencies?.sterlings === 'number'
    ? data.currencies.sterlings
    : (typeof data.sterlings === 'number' ? data.sterlings : 0);

  data.currencies = {
    gold,
    sterlings
  };

  // Remove legacy top-level sterlings field
  if ('sterlings' in data) {
    delete data.sterlings;
  }

  return data;
}
