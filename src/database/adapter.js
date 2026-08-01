/**
 * Database abstraction interface.
 * // ponytail: Uses in-memory Map store. Ceiling: Data resets on process exit. Upgrade path: Replace with SQLite (better-sqlite3) or Cloudflare D1 client adapter.
 */
export class DatabaseAdapter {
  constructor() {
    this.store = new Map();
  }

  async connect() {
    return true;
  }

  async disconnect() {
    return true;
  }

  async get(collection, id) {
    const key = `${collection}:${id}`;
    return this.store.get(key) ? JSON.parse(JSON.stringify(this.store.get(key))) : null;
  }

  async set(collection, id, data) {
    const key = `${collection}:${id}`;
    this.store.set(key, JSON.parse(JSON.stringify(data)));
    return data;
  }

  async delete(collection, id) {
    const key = `${collection}:${id}`;
    return this.store.delete(key);
  }

  async find(collection, query = {}) {
    const prefix = `${collection}:`;
    const results = [];
    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        results.push(JSON.parse(JSON.stringify(value)));
      }
    }
    return results;
  }
}
