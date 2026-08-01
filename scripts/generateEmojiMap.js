import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const items = require('../src/data/items.json');

const EMOJI_MAP_PATH = path.join(process.cwd(), 'assets', 'emoji-map.json');

async function generateEmojiMap() {
  console.log('[STAGE 3] Generating assets/emoji-map.json...');

  let existing = {};
  try {
    const text = await fs.readFile(EMOJI_MAP_PATH, 'utf8');
    existing = JSON.parse(text);
  } catch {
    // File doesn't exist yet
  }

  const map = {};
  for (const item of items) {
    map[item.id] = existing[item.id] !== undefined ? existing[item.id] : '';
  }

  await fs.writeFile(EMOJI_MAP_PATH, JSON.stringify(map, null, 2), 'utf8');
  console.log(`[STAGE 3 SUCCESS] Generated emoji map with ${Object.keys(map).length} item entries at assets/emoji-map.json!`);
}

generateEmojiMap().catch(console.error);
