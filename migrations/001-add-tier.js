/**
 * Migration 001: Add tier metadata to player stats and inventory records.
 */
export function migrate001(playerData) {
  playerData.schemaVersion = 1;
  if (!playerData.tier) {
    playerData.tier = 1;
  }
  return playerData;
}
