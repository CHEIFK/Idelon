/**
 * Migration 007: Add persisted temporary potion buffs to player saves.
 */
export function migrate007(data) {
  if (!data.activeBuffs || typeof data.activeBuffs !== 'object' || Array.isArray(data.activeBuffs)) {
    data.activeBuffs = {};
  }
  return data;
}
