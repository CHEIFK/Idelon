/**
 * syncEmojis.js
 *
 * Fetches all custom emojis from the configured Discord guild, matches them to
 * game items using the underscore naming convention (ore_item_copper → copper_ore),
 * and writes the resolved Discord emoji strings into assets/emoji-map.json.
 *
 * Usage:
 *   npm run sync-emojis
 *   node --env-file=.env scripts/syncEmojis.js
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const items = require('../src/data/items.json');

// ── Config ────────────────────────────────────────────────────────────────────

const EMOJI_MAP_PATH = path.join(process.cwd(), 'assets', 'emoji-map.json');
const DISCORD_API   = 'https://discord.com/api/v10';

const token   = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error('[ERROR] DISCORD_TOKEN and GUILD_ID must be set in your .env file.');
  process.exit(1);
}

// ── Emoji-name → item-id resolver ────────────────────────────────────────────

/**
 * Derive the expected Discord emoji name for a given item ID.
 *
 * Rules (applied in order):
 *   copper_ore      → ore_item_copper      (strip _ore, prefix ore_item_)
 *   coal            → ore_item_coal        (no suffix to strip, just prefix)
 *   phase_fabric    → ore_item_phase_fabric
 *   surge_alloy     → ore_item_surge_alloy
 *
 * Non-ore items (bars, weapons, logs, etc.) keep no ore_item_ prefix.
 * They are matched directly by name: iron_sword → iron_sword.
 */
function itemIdToEmojiName(itemId) {
  // Strip trailing _ore if present, then prepend ore_item_
  const stripped = itemId.replace(/_ore$/, '');
  return `ore_item_${stripped}`;
}

/**
 * Build the reverse lookup: emojiName → itemId, for every item in the game.
 * Also builds a direct name map for non-ore items that may have been uploaded
 * with their plain item ID as the emoji name (e.g. iron_sword → iron_sword).
 */
function buildLookupTable(itemList) {
  // Map: emojiName (lowercase) → itemId
  const table = new Map();

  for (const item of itemList) {
    // Primary derivation for ore-type items
    const oreEmojiName = itemIdToEmojiName(item.id);
    table.set(oreEmojiName, item.id);

    // Also accept exact item ID as emoji name (e.g. iron_sword, wood_log)
    table.set(item.id, item.id);

    // Accept item name converted to snake_case as emoji name
    const snakeName = item.name.toLowerCase().replace(/\s+/g, '_');
    table.set(snakeName, item.id);
  }

  return table;
}

// ── Discord API ───────────────────────────────────────────────────────────────

async function fetchGuildEmojis() {
  const url = `${DISCORD_API}/guilds/${guildId}/emojis`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${token}` }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord API error [${res.status}]: ${body}`);
  }

  return res.json(); // Array of Discord emoji objects: { id, name, animated, ... }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function syncEmojis() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Idelon Emoji Sync');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Guild ID : ${guildId}`);

  // 1. Load existing emoji-map so unmatched entries are preserved
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(EMOJI_MAP_PATH, 'utf8'));
  } catch {
    // No existing file — start fresh
  }

  // 2. Fetch emojis from Discord
  console.log('\n[1/4] Fetching emojis from Discord guild...');
  const guildEmojis = await fetchGuildEmojis();
  console.log(`      Found ${guildEmojis.length} custom emoji(s) on the server.`);

  // 3. Build item lookup table
  console.log('[2/4] Building item → emoji name lookup table...');
  const lookup = buildLookupTable(items);

  // 4. Match each guild emoji to an item ID
  console.log('[3/4] Matching emoji names to game items...\n');

  const matched   = [];
  const unmatched = [];

  for (const emoji of guildEmojis) {
    const normalizedName = emoji.name.toLowerCase();
    const itemId = lookup.get(normalizedName);

    if (itemId) {
      const emojiStr = `<:${emoji.name}:${emoji.id}>`;
      matched.push({ emojiName: emoji.name, itemId, emojiStr });
    } else {
      unmatched.push(emoji.name);
    }
  }

  // 5. Merge into the emoji map
  //    Start from existing, overlay matched results so manual entries survive.
  const updatedMap = { ...existing };
  for (const { itemId, emojiStr } of matched) {
    updatedMap[itemId] = emojiStr;
  }

  // 6. Write emoji-map.json
  console.log('[4/4] Writing assets/emoji-map.json...');
  await fs.writeFile(EMOJI_MAP_PATH, JSON.stringify(updatedMap, null, 2), 'utf8');

  // 7. Summary report
  const colW = 26;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Matched Emojis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const { emojiName, itemId, emojiStr } of matched.sort((a, b) => a.itemId.localeCompare(b.itemId))) {
    console.log(`  ${itemId.padEnd(colW)} ← :${emojiName}:   →  ${emojiStr}`);
  }

  if (unmatched.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Unmatched Server Emojis (no item found)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const name of unmatched.sort()) {
      console.log(`  :${name}:`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Matched   : ${matched.length} / ${guildEmojis.length} server emoji(s)`);
  console.log(`Total map : ${Object.keys(updatedMap).length} item(s) in emoji-map.json`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✨ Emoji sync complete! Restart the bot to apply changes.');
}

syncEmojis().catch(err => {
  console.error('[FATAL] Emoji sync failed:', err.message);
  process.exit(1);
});
