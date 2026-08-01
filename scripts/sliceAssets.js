import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Path configurations
const ASSETS_DIR = path.join(process.cwd(), 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'icons');
const EMOJIS_DIR = path.join(ASSETS_DIR, 'discord-emojis');
const MANIFEST_PATH = path.join(ASSETS_DIR, 'icon-manifest.json');
const ITEM_MAPPING_PATH = path.join(ASSETS_DIR, 'item-icons.json');

// Default item mapping template if missing
const DEFAULT_ITEM_MAPPING = {
  iron_ore: '',
  copper_ore: '',
  coal: '',
  oak_log: '',
  fish: '',
  iron_sword: '',
  wooden_sword: '',
  shield: '',
  helmet: '',
  health_potion: ''
};

async function locateSpriteSheet() {
  const candidates = [
    '#1 - Transparent Icons.png',
    '#2 - Transparent Icons & Drop Shadow.png'
  ];

  for (const filename of candidates) {
    const fullPath = path.join(ASSETS_DIR, filename);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      // Continue to next candidate
    }
  }

  const files = await fs.readdir(ASSETS_DIR);
  const match = files.find(f => f.endsWith('.png') && (f.includes('Icon') || f.includes('Transparent')));
  if (match) {
    return path.join(ASSETS_DIR, match);
  }

  throw new Error('No sprite sheet image found inside assets/ directory.');
}

async function processCell(spritePath, left, top, cellWidth, cellHeight) {
  // Extract cell raw pixel buffer
  const rawRegion = await sharp(spritePath)
    .extract({ left, top, width: cellWidth, height: cellHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Count non-transparent pixels (alpha > 10)
  let nonAlphaCount = 0;
  for (let i = 3; i < rawRegion.data.length; i += 4) {
    if (rawRegion.data[i] > 10) nonAlphaCount++;
  }

  if (nonAlphaCount < 5) return null;

  // Trim transparent borders
  const trimmedBuffer = await sharp(spritePath)
    .extract({ left, top, width: cellWidth, height: cellHeight })
    .trim({ threshold: 5 })
    .toBuffer()
    .catch(() => null);

  if (!trimmedBuffer) return null;

  const hash = crypto.createHash('md5').update(trimmedBuffer).digest('hex');
  return { trimmedBuffer, hash };
}

async function runAssetPipeline() {
  console.log('=======================================================');
  console.log('🎨 Starting Idelon Asset Pipeline');
  console.log('=======================================================');

  const spritePath = await locateSpriteSheet();
  console.log(`[STAGE 1] Located Sprite Sheet: ${path.basename(spritePath)}`);

  const meta = await sharp(spritePath).metadata();
  const width = meta.width;
  const height = meta.height;

  const cellWidth = 32;
  const cellHeight = 32;
  const cols = Math.floor(width / cellWidth);
  const rows = Math.floor(height / cellHeight);

  console.log(`[STAGE 1] Sprite Dimensions: ${width}x${height} | Auto-Detected Grid: ${cols} cols x ${rows} rows (${cols * rows} cells)`);

  await fs.mkdir(ICONS_DIR, { recursive: true });
  await fs.mkdir(EMOJIS_DIR, { recursive: true });

  const cellCoords = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellCoords.push({ left: c * cellWidth, top: r * cellHeight });
    }
  }

  // Process cell extraction in parallel batches
  const BATCH_SIZE = 32;
  const extractedResults = [];
  for (let i = 0; i < cellCoords.length; i += BATCH_SIZE) {
    const batch = cellCoords.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(coord => processCell(spritePath, coord.left, coord.top, cellWidth, cellHeight))
    );
    extractedResults.push(...batchResults.filter(Boolean));
  }

  const hashes = new Set();
  const manifest = {};
  let iconIndex = 1;

  const exportTasks = [];

  for (const item of extractedResults) {
    if (hashes.has(item.hash)) continue;
    hashes.add(item.hash);

    const iconKey = `icon_${String(iconIndex).padStart(4, '0')}`;
    const iconFileName = `${iconKey}.png`;
    const iconFilePath = path.join(ICONS_DIR, iconFileName);
    const emojiFilePath = path.join(EMOJIS_DIR, iconFileName);

    manifest[iconKey] = `icons/${iconFileName}`;
    iconIndex++;

    // Push write & Discord emoji generation tasks
    exportTasks.push((async () => {
      // Write sliced trimmed icon PNG
      await sharp(item.trimmedBuffer).toFile(iconFilePath);

      // Prepare Discord-ready 128x128 emoji image
      const iconMeta = await sharp(item.trimmedBuffer).metadata();
      const maxDim = Math.max(iconMeta.width, iconMeta.height);
      const targetSize = 112;
      const scale = targetSize / maxDim;
      const resizedW = Math.max(1, Math.round(iconMeta.width * scale));
      const resizedH = Math.max(1, Math.round(iconMeta.height * scale));

      const resizedIconBuffer = await sharp(item.trimmedBuffer)
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
      .composite([{ input: resizedIconBuffer, gravity: 'center' }])
      .png()
      .toFile(emojiFilePath);
    })());
  }

  // Execute export tasks in parallel
  const EXPORT_BATCH = 32;
  for (let i = 0; i < exportTasks.length; i += EXPORT_BATCH) {
    await Promise.all(exportTasks.slice(i, i + EXPORT_BATCH));
  }

  console.log(`[STAGE 2 & 3] Sliced and cleaned ${Object.keys(manifest).length} unique icons into assets/icons/`);

  // Write Stage 3 Manifest
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[STAGE 3] Built icon manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);

  // Stage 4: Prepare Game Item Mapping
  let itemMapping = DEFAULT_ITEM_MAPPING;
  try {
    const existingMappingText = await fs.readFile(ITEM_MAPPING_PATH, 'utf8');
    const existingMapping = JSON.parse(existingMappingText);
    itemMapping = { ...DEFAULT_ITEM_MAPPING, ...existingMapping };
  } catch {
    // Default template
  }
  await fs.writeFile(ITEM_MAPPING_PATH, JSON.stringify(itemMapping, null, 2), 'utf8');
  console.log(`[STAGE 4] Prepared item mapping file: ${path.relative(process.cwd(), ITEM_MAPPING_PATH)}`);

  // Stage 5 Summary
  console.log(`[STAGE 5] Generated ${Object.keys(manifest).length} Discord-ready custom emojis (128x128 PNG) in assets/discord-emojis/`);
  console.log('=======================================================');
  console.log('✨ Idelon Asset Pipeline Execution Complete!');
  console.log('=======================================================');
}

runAssetPipeline().catch(err => {
  console.error('[FATAL] Asset Pipeline failed:', err);
  process.exit(1);
});
