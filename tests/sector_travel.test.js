import test from 'node:test';
import assert from 'node:assert';
import { 
  resolveSectorToAreaId, 
  getSectorNumber, 
  getSectorName, 
  getSectorLabel,
  getOrderedAreas,
  SECTORS_REGISTRY 
} from '../src/utils/sectorMap.js';

test('Sector Registry Parser - Numbers', () => {
  assert.strictEqual(resolveSectorToAreaId('2'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('02'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('sector 2'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('sector 02'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('s2'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('s02'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId(' sector   2 '), 'lead_quarry');
});

test('Sector Registry Parser - Names', () => {
  assert.strictEqual(resolveSectorToAreaId('lead quarry'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('lead_quarry'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('LEAD QUARRY'), 'lead_quarry');
  assert.strictEqual(resolveSectorToAreaId('Starter Village'), 'starter_village');
  assert.strictEqual(resolveSectorToAreaId('starter_village'), 'starter_village');
});

test('Sector Registry Parser - Invalid', () => {
  assert.strictEqual(resolveSectorToAreaId('99'), null);
  assert.strictEqual(resolveSectorToAreaId('invalid_area'), null);
  assert.strictEqual(resolveSectorToAreaId(''), null);
});

test('Sector Utilities', () => {
  assert.strictEqual(getSectorNumber('starter_village'), null);
  assert.strictEqual(getSectorNumber('lead_quarry'), '02');
  
  assert.strictEqual(getSectorName('sand_dunes'), 'Sand Dunes');
  assert.strictEqual(getSectorLabel('starter_village'), 'Starter Village');
  assert.strictEqual(getSectorLabel('lead_quarry'), 'Sector 02 — Lead Quarry');
});

test('Sector Sorting', () => {
  const unsortedAreas = [
    { id: 'titanium_caverns' },
    { id: 'sand_dunes' },
    { id: 'starter_village' },
    { id: 'unknown_area' },
    { id: 'lead_quarry' }
  ];
  
  const sorted = getOrderedAreas(unsortedAreas);
  assert.strictEqual(sorted[0].id, 'starter_village');
  assert.strictEqual(sorted[1].id, 'lead_quarry');
  assert.strictEqual(sorted[2].id, 'sand_dunes');
  assert.strictEqual(sorted[3].id, 'titanium_caverns');
  assert.strictEqual(sorted[4].id, 'unknown_area'); // Unknown pushed to end
});
