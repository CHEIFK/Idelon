/**
 * Migration 002: Add rarity defaults and ensure inventory stack integrity.
 */
export function migrate002(playerData) {
  playerData.schemaVersion = 2;
  if (!playerData.rarity) {
    playerData.rarity = 'Common';
  }
  if (!playerData.inventory || typeof playerData.inventory !== 'object') {
    playerData.inventory = {};
  }
  return playerData;
}
