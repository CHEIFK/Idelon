import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePlayerSave, CURRENT_SCHEMA_VERSION } from '../migrations/index.js';

async function runValidateSave() {
  console.log('=======================================================');
  console.log('🔍 Idelon Player Save Data Integrity Validation');
  console.log('=======================================================');

  const savesDir = path.join(process.cwd(), 'data', 'saves');
  let saveFiles = [];
  try {
    const files = await fs.readdir(savesDir);
    saveFiles = files.filter(f => f.endsWith('.json'));
  } catch {
    // If saves dir doesn't exist, validate sample payload
  }

  if (saveFiles.length === 0) {
    console.log('[INFO] No save files found in data/saves/. Testing mock player save payloads...');
    const mockSaves = [
      { id: 'usr_valid', name: 'Valid Hero', level: 5, schemaVersion: CURRENT_SCHEMA_VERSION, inventory: {}, storage: {}, currencies: { gold: 100 } },
      { id: 'usr_legacy', name: 'Legacy Player', level: 2 },
      { id: 'usr_corrupt', name: null }
    ];

    for (const save of mockSaves) {
      const res = validatePlayerSave(save);
      const label = save?.name || save?.id || 'Unknown';
      if (res.valid) {
        console.log(`✔ Save '${label}': Valid! (schemaVersion: ${save.schemaVersion || 0})`);
      } else {
        console.log(`⚠️ Save '${label}': Invalid/Legacy (Errors: ${res.errors.join(', ') || 'None'} | Warnings: ${res.warnings.join(', ')})`);
      }
    }
    console.log('=======================================================');
    console.log('✨ Save Validation Audit Complete!');
    return;
  }

  let totalValid = 0;
  let totalMigratable = 0;

  for (const filename of saveFiles) {
    const fullPath = path.join(savesDir, filename);
    const text = await fs.readFile(fullPath, 'utf8');
    const data = JSON.parse(text);

    const res = validatePlayerSave(data);
    if (res.valid && res.warnings.length === 0) {
      totalValid++;
      console.log(`✔ ${filename}: Valid (schemaVersion ${data.schemaVersion})`);
    } else {
      totalMigratable++;
      console.log(`⚠️ ${filename}: Issues detected (Errors: ${res.errors.join('; ') || 'None'} | Warnings: ${res.warnings.join('; ')})`);
    }
  }

  console.log('=======================================================');
  console.log(`✨ Save Validation Complete! Valid: ${totalValid} | Needs Migration: ${totalMigratable}`);
}

runValidateSave().catch(err => {
  console.error('[FATAL] Save validation failed:', err);
  process.exit(1);
});
