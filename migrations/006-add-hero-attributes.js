import { DEFAULT_ATTRIBUTES } from '../src/engine/attributes.js';

/**
 * Migration 006: Add Hero Attributes to player save state.
 */
export function migrate006(data) {
  data.attributes = {
    ...DEFAULT_ATTRIBUTES,
    ...(data.attributes && typeof data.attributes === 'object' ? data.attributes : {})
  };
  return data;
}
