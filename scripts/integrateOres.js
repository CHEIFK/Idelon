import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gameItems = require('../src/data/items.json');

const ASSETS_DIR = path.join(process.cwd(), 'assets');
const ORES_DIR = path.join(ASSETS_DIR, 'ores');
const EMOJIS_DIR = path.join(ASSETS_DIR, 'discord-emojis');
const ORE_MANIFEST_PATH = path.join(ORES_DIR, 'ore-manifest.json');
const ITEM_ICONS_PATH = path.join(ASSETS_DIR, 'item-icons.json');

async function runOreIntegration() {
  console.log('=======================================================');
  console.log('⛏️ Starting Idelon Ore Asset Integration System');
  console.log('=======================================================');

  // Stage 1: Scan Ore Assets
  const files = await fs.readdir(ORES_DIR);
  const pngFiles = files.filter(f => f.endsWith('.png'));

  const oreManifest = {};
  const oreFileMap = new Map();

  for (const filename of pngFiles) {
    const cleanKey = filename.replace(/^item-|^liquid-|\.png$/g, '');
    const relativePath = `ores/${filename}`;
    oreManifest[cleanKey] = relativePath;
    oreFileMap.set(cleanKey, relativePath);
  }

  await fs.writeFile(ORE_MANIFEST_PATH, JSON.stringify(oreManifest, null, 2), 'utf8');
  console.log(`[STAGE 1] Scanned ${pngFiles.length} ore PNG assets and generated ores/ore-manifest.json`);

  // Stage 2: Automatic Item Assignment
  let existingItemIcons = {};
  try {
    const text = await fs.readFile(ITEM_ICONS_PATH, 'utf8');
    existingItemIcons = JSON.parse(text);
  } catch {
    existingItemIcons = {};
  }

  const updatedItemIcons = { ...existingItemIcons };
  const allItemKeys = new Set([
    ...gameItems.map(i => i.id),
    ...Object.keys(existingItemIcons)
  ]);

  const reportMap = new Map();

  for (const itemId of allItemKeys) {
    const itemDef = gameItems.find(i => i.id === itemId);
    const itemName = itemDef?.name || itemId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const strippedId = itemId.replace(/_ore$/i, '');
    const strippedName = itemName.toLowerCase().replace(/\s+ore$/i, '').replace(/\s+/g, '-');

    let matchedPath = null;
    if (oreFileMap.has(strippedId)) {
      matchedPath = oreFileMap.get(strippedId);
    } else if (oreFileMap.has(itemId)) {
      matchedPath = oreFileMap.get(itemId);
    } else if (oreFileMap.has(strippedName)) {
      matchedPath = oreFileMap.get(strippedName);
    }

    if (matchedPath) {
      updatedItemIcons[itemId] = matchedPath;
      reportMap.set(itemName, { path: matchedPath, success: true });
    } else if (itemId.includes('ore') || itemId === 'coal') {
      reportMap.set(itemName, { path: 'No matching icon', success: false });
    }
  }

  // Stage 3: Update item-icons.json
  await fs.writeFile(ITEM_ICONS_PATH, JSON.stringify(updatedItemIcons, null, 2), 'utf8');
  console.log(`[STAGE 3] Updated assets/item-icons.json with ore icon mappings`);

  // Stage 4: Discord Emoji Preparation
  await fs.mkdir(EMOJIS_DIR, { recursive: true });

  const emojiNameMap = []; // Tracks { pngFile, emojiName } for the summary report

  const emojiTasks = pngFiles.map(async (filename) => {
    const srcPath = path.join(ORES_DIR, filename);
    // Local PNG filename — hyphens replaced with underscores to match Discord emoji naming convention
    const destFileName = `ore_${filename.replace(/\.png$/, '').replace(/-/g, '_')}.png`;
    const destPath = path.join(EMOJIS_DIR, destFileName);
    // Discord emoji name matches the filename (underscores throughout)
    const emojiName = destFileName.replace(/\.png$/, '');
    emojiNameMap.push({ pngFile: destFileName, emojiName });

    const meta = await sharp(srcPath).metadata();
    const maxDim = Math.max(meta.width || 32, meta.height || 32);
    const targetSize = 112; // 112px inside 128x128 canvas
    const scale = targetSize / maxDim;
    const resizedW = Math.max(1, Math.round((meta.width || 32) * scale));
    const resizedH = Math.max(1, Math.round((meta.height || 32) * scale));

    const resizedBuffer = await sharp(srcPath)
      .resize(resizedW, resizedH, { fit: 'inside' })
      .toBuffer();

    await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: resizedBuffer, gravity: 'center' }])
    .png()
    .toFile(destPath);
  });

  await Promise.all(emojiTasks);
  console.log(`[STAGE 4] Prepared ${pngFiles.length} Discord-ready custom ore emojis (128x128 PNG) in assets/discord-emojis/`);
  console.log('\n  PNG File                              Discord Emoji Name (use underscores when uploading)');
  console.log('  ' + '─'.repeat(75));
  for (const { pngFile, emojiName } of emojiNameMap.sort((a, b) => a.pngFile.localeCompare(b.pngFile))) {
    console.log(`  ${pngFile.padEnd(38)} →  ${emojiName}`);
  }
  console.log();

  // Stage 6: Report Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Ore Asset Integration Summary Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const [name, info] of reportMap.entries()) {
    if (info.success) {
      console.log(`✔ ${name} → ${info.path}`);
    } else {
      console.log(`⚠ ${name} → ${info.path}`);
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✨ Ore Asset Integration Complete!');
}

runOreIntegration().catch(err => {
  console.error('[FATAL] Ore integration failed:', err);
  process.exit(1);
});
