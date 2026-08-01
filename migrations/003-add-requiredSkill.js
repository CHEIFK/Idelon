/**
 * Migration 003: Add requiredSkill defaults and storage vault integrity.
 */
export function migrate003(playerData) {
  playerData.schemaVersion = 3;
  if (playerData.requiredSkill === undefined) {
    playerData.requiredSkill = null;
  }
  if (!playerData.storage || typeof playerData.storage !== 'object') {
    playerData.storage = {};
  }
  if (!playerData.currencies || typeof playerData.currencies !== 'object') {
    playerData.currencies = { gold: 0 };
  }
  return playerData;
}
