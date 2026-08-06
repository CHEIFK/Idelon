import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const configuredDatabasePath = process.env.IDELON_DB_PATH;
const DEFAULT_DATABASE_PATH = configuredDatabasePath === ':memory:' || process.env.IDELON_TEST === '1'
  ? ':memory:'
  : path.resolve(configuredDatabasePath || path.join(process.cwd(), 'data', 'idelon.sqlite'));

/**
 * SQLite-backed repository used by the engine.
 *
 * The public API intentionally remains the same as the old in-memory adapter
 * so the domain engine and service layer stay database-agnostic.
 */
export class DatabaseAdapter {
  constructor(databasePath = DEFAULT_DATABASE_PATH) {
    this.databasePath = databasePath;
    this.db = null;
    this.statements = null;
  }

  async connect() {
    if (this.db) return true;

    if (this.databasePath !== ':memory:') {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    }

    this.db = new Database(this.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.statements = {
      get: this.db.prepare('SELECT data FROM players WHERE id = ?'),
      set: this.db.prepare(`
        INSERT INTO players (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `),
      delete: this.db.prepare('DELETE FROM players WHERE id = ?'),
      find: this.db.prepare('SELECT data FROM players ORDER BY id')
    };

    return true;
  }

  async disconnect() {
    if (!this.db) return true;
    this.db.close();
    this.db = null;
    this.statements = null;
    return true;
  }

  _ready(collection) {
    if (collection !== 'players') {
      throw new Error(`Unsupported database collection '${collection}'.`);
    }
    if (!this.db) {
      throw new Error('DatabaseAdapter is not connected. Call connect() first.');
    }
  }

  _parsePayload(raw) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('[DATABASE] Invalid player payload; handing it to migration repair.', error.message);
      return {};
    }
  }

  async get(collection, id) {
    this._ready(collection);
    const row = this.statements.get.get(id);
    return row ? this._parsePayload(row.data) : null;
  }

  async set(collection, id, data) {
    this._ready(collection);
    const serialized = JSON.stringify(data);
    this.statements.set.run(id, serialized, Date.now());
    return data;
  }

  async delete(collection, id) {
    this._ready(collection);
    return this.statements.delete.run(id).changes > 0;
  }

  async find(collection, query = {}) {
    this._ready(collection);
    // The repository contract keeps query support for compatibility. Player
    // lookups currently only need the complete collection scan.
    void query;
    return this.statements.find.all().map(row => this._parsePayload(row.data));
  }
}

export { DEFAULT_DATABASE_PATH };
