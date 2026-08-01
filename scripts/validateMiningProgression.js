import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const items = require('../src/data/items.json');
const activities = require('../src/data/activities.json');
const resources = require('../src/data/resources.json');
const lootTables = require('../src/data/lootTables.json');
const areas = require('../src/data/areas.json');

export function validateMiningProgression() {
  console.log('=======================================================');
  console.log('⛏️ Idelon Redesigned Mining Progression System v1 Validation');
  console.log('=======================================================');

  const itemsMap = new Map(items.map(i => [i.id, i]));
  const lootTablesMap = new Map(lootTables.map(l => [l.id, l]));

  const naturalOres = [
    { level: 1, id: 'copper_ore', name: 'Copper Ore', rarity: 'Common', speed: '2.5s', xp: 10, gold: 0.5, area: 'starter_village' },
    { level: 1, id: 'coal', name: 'Coal', rarity: 'Common', speed: '2.5s', xp: 12, gold: 0.6, area: 'starter_village' },
    { level: 2, id: 'lead_ore', name: 'Lead Ore', rarity: 'Uncommon', speed: '3.0s', xp: 18, gold: 0.9, area: 'lead_quarry' },
    { level: 3, id: 'sand', name: 'Sand', rarity: 'Uncommon', speed: '3.5s', xp: 25, gold: 1.2, area: 'sand_dunes' },
    { level: 5, id: 'titanium_ore', name: 'Titanium Ore', rarity: 'Rare', speed: '4.5s', xp: 40, gold: 2.0, area: 'titanium_caverns' },
    { level: 7, id: 'beryllium_ore', name: 'Beryllium Ore', rarity: 'Epic', speed: '5.5s', xp: 65, gold: 3.5, area: 'beryllium_caves' },
    { level: 8, id: 'thorium_ore', name: 'Thorium Ore', rarity: 'Epic', speed: '7.0s', xp: 100, gold: 6.0, area: 'thorium_depths' },
    { level: 9, id: 'tungsten_ore', name: 'Tungsten Ore', rarity: 'Legendary', speed: '9.0s', xp: 150, gold: 10.0, area: 'tungsten_core' }
  ];

  const refinedMaterials = ['graphite', 'silicon', 'metaglass', 'phase_fabric', 'oxide', 'carbide', 'surge_alloy'];

  let totalChecked = 0;
  let totalErrors = 0;
  const report = [];

  // 1. Verify Natural Ores
  for (const ore of naturalOres) {
    totalChecked++;
    const item = itemsMap.get(ore.id);
    if (!item) {
      report.push(`❌ [${ore.name}]: Missing item definition!`);
      totalErrors++;
      continue;
    }

    if (item.obtainMethod !== 'mining') {
      report.push(`❌ [${ore.name}]: obtainMethod should be 'mining' (got '${item.obtainMethod}')`);
      totalErrors++;
    }

    if (item.rarity !== ore.rarity) {
      report.push(`❌ [${ore.name}]: Rarity mismatch (${item.rarity} vs ${ore.rarity})`);
      totalErrors++;
    }

    const itemVal = item.sellValue !== undefined ? item.sellValue : item.value;
    if (itemVal !== ore.gold) {
      report.push(`❌ [${ore.name}]: Sell value mismatch (${itemVal} vs ${ore.gold})`);
      totalErrors++;
    }

    const act = activities.find(a => a.skillId === 'mining' && a.levelReq === ore.level && a.lootTableId?.includes(ore.id.replace('_ore', '')));
    if (!act) {
      report.push(`❌ [${ore.name}]: Missing activity definition!`);
      totalErrors++;
    } else {
      if (act.xpPerCycle !== ore.xp) {
        report.push(`❌ [${ore.name}]: XP mismatch (${act.xpPerCycle} vs ${ore.xp})`);
        totalErrors++;
      }
    }

    report.push(`✔ Lv.${ore.level} ${ore.name} | Rarity: ${ore.rarity} | Speed: ${ore.speed} | XP: ${ore.xp} | Value: ${ore.gold} Gold | Area: ${ore.area}`);
  }

  // 2. Verify Refined Materials are NOT in mining activities
  for (const matId of refinedMaterials) {
    totalChecked++;
    const item = itemsMap.get(matId);
    if (!item) {
      report.push(`❌ Refined Material [${matId}]: Missing item definition!`);
      totalErrors++;
      continue;
    }

    if (item.obtainMethod !== 'refining') {
      report.push(`❌ Refined Material [${matId}]: obtainMethod should be 'refining' (got '${item.obtainMethod}')`);
      totalErrors++;
    }

    const miningAct = activities.find(a => a.skillId === 'mining' && a.lootTableId?.includes(matId));
    if (miningAct) {
      report.push(`❌ Refined Material [${matId}]: Found inside mining activity '${miningAct.id}'! Refined materials must NOT be mineable.`);
      totalErrors++;
    } else {
      report.push(`✔ Refined Material [${item.name}] correctly marked obtainMethod: 'refining' (not mineable)`);
    }
  }

  // 3. Verify Scrap
  const scrapItem = itemsMap.get('scrap');
  if (scrapItem) {
    if (scrapItem.obtainMethod !== 'salvage') {
      report.push(`❌ Scrap obtainMethod should be 'salvage' (got '${scrapItem.obtainMethod}')`);
      totalErrors++;
    } else {
      report.push(`✔ Scrap correctly classified as Salvage (obtainMethod: 'salvage')`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Redesigned Mining Progression Validation Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const line of report) {
    console.log(line);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (totalErrors === 0) {
    console.log(`✨ Redesigned Mining Validation Passed cleanly! (${totalChecked} checks verified)`);
  } else {
    console.error(`💥 Validation failed with ${totalErrors} errors.`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('validateMiningProgression.js')) {
  validateMiningProgression();
}
