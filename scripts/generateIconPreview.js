import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ASSETS_DIR = path.join(process.cwd(), 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'icons');
const OUTPUT_PREVIEW_PATH = path.join(ASSETS_DIR, 'icon-preview.png');
const MANIFEST_PATH = path.join(ASSETS_DIR, 'icon-manifest.json');

async function generateContactSheet() {
  console.log('[STAGE 1] Generating Icon Browser Contact Sheet (assets/icon-preview.png)...');

  const manifestText = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestText);
  const iconKeys = Object.keys(manifest).sort(); // icon_0001, icon_0002, ...

  const totalIcons = iconKeys.length; // 261
  const cols = 16;
  const rows = Math.ceil(totalIcons / cols);

  const cellW = 80;
  const cellH = 64;

  const canvasWidth = cols * cellW; // 1280px
  const canvasHeight = rows * cellH; // ~1088px

  // Build SVG overlays for icon ID text labels below each icon
  let svgTextElements = '';

  const composites = [];

  for (let idx = 0; idx < totalIcons; idx++) {
    const key = iconKeys[idx]; // "icon_0001"
    const relPath = manifest[key];
    const fullPath = path.join(ASSETS_DIR, relPath);

    const c = idx % cols;
    const r = Math.floor(idx / cols);

    const cellLeft = c * cellW;
    const cellTop = r * cellH;

    // Center 32x32 icon in top half of cell (x offset: cellLeft + 24, y offset: cellTop + 4)
    composites.push({
      input: fullPath,
      left: cellLeft + 24,
      top: cellTop + 4
    });

    // Label text underneath
    const shortLabel = key; // "icon_0001"
    const textX = cellLeft + cellW / 2;
    const textY = cellTop + 52;

    svgTextElements += `<text x="${textX}" y="${textY}" font-family="DejaVu Sans, Arial, sans-serif" font-size="10" font-weight="bold" fill="#BDC3C7" text-anchor="middle">${shortLabel}</text>\n`;
  }

  // Create SVG overlay for text labels and cell borders
  let svgOverlay = `<svg width="${canvasWidth}" height="${canvasHeight}">`;
  // Dark background grid background lines
  for (let r = 0; r <= rows; r++) {
    const y = r * cellH;
    svgOverlay += `<line x1="0" y1="${y}" x2="${canvasWidth}" y2="${y}" stroke="#2C3E50" stroke-width="1"/>`;
  }
  for (let c = 0; c <= cols; c++) {
    const x = c * cellW;
    svgOverlay += `<line x1="${x}" y1="0" x2="${x}" y2="${canvasHeight}" stroke="#2C3E50" stroke-width="1"/>`;
  }
  svgOverlay += svgTextElements;
  svgOverlay += `</svg>`;

  composites.push({
    input: Buffer.from(svgOverlay),
    top: 0,
    left: 0
  });

  // Render dark background contact sheet
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 24, g: 32, b: 42, alpha: 1 } // Dark background #18202A
    }
  })
  .composite(composites)
  .png()
  .toFile(OUTPUT_PREVIEW_PATH);

  console.log(`[STAGE 1 SUCCESS] Generated ${canvasWidth}x${canvasHeight} contact sheet with ${totalIcons} icons at assets/icon-preview.png!`);
}

generateContactSheet().catch(err => {
  console.error('[ERROR] Failed to generate icon preview:', err);
  process.exit(1);
});
