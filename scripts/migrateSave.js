import fs from 'node:fs/promises';
import path from 'node:path';
import { migratePlayerSave, CURRENT_SCHEMA_VERSION } from '../migrations/index.js';

async function runMigrateSave() {
  console.log('=======================================================');
  console.log('🚀 Idelon Player Save Data Migration Utility');
  console.log('=======================================================');

  const savesDir = path.join(process.cwd(), 'data', 'saves');
  let saveFiles = [];
  try {
    const files = await fs.readdir(savesDir);
    saveFiles = files.filter(f => f.endsWith('.json'));
  } catch {
    // Saves dir does not exist
  }

  if (saveFiles.length === 0) {
    console.log('[INFO] No save files found in data/saves/. Testing inline migration on legacy mock payload...');
    const legacyPayload = { id: 'usr_legacy_1', name: 'Old Hero', level: 3 };
    const migrated = migratePlayerSave(legacyPayload);
    console.log(`✔ Migrated legacy payload v0 -> v${migrated.schemaVersion}:`, JSON.stringify(migrated, null, 2));
    console.log('=======================================================');
    console.log('✨ Save Migration Execution Complete!');
    return;
  }

  let totalMigrated = 0;

  for (const filename of saveFiles) {
    const fullPath = path.join(savesDir, filename);
    const text = await fs.readFile(fullPath, 'utf8');
    const data = JSON.parse(text);

    const oldVersion = data.schemaVersion || 0;
    const migratedData = migratePlayerSave(data);

    if (oldVersion < CURRENT_SCHEMA_VERSION) {
      await fs.writeFile(fullPath, JSON.stringify(migratedData, null, 2), 'utf8');
      totalMigrated++;
      console.log(`✔ Migrated ${filename}: v${oldVersion} -> v${CURRENT_SCHEMA_VERSION}`);
    } else {
      console.log(`ℹ️ ${filename}: Already at latest schema v${CURRENT_SCHEMA_VERSION}`);
    }
  }

  console.log('=======================================================');
  console.log(`✨ Save Migration Complete! Total files updated: ${totalMigrated}`);
}

runMigrateSave().catch(err => {
  console.error('[FATAL] Save migration failed:', err);
  process.exit(1);
});
