import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevelUpSummaryEmbed } from '../src/discord/embeds.js';
import { Engine } from '../src/engine/index.js';

test('Level-Up Summary: Single level-up embed formatting', async () => {
  const engine = new Engine();
  await engine.init();

  const singleLevelUp = [
    {
      from: 1,
      to: 2,
      sterlingsAwarded: 5,
      skillId: 'mining',
      unlocks: ['Lead Ore', 'Lead Quarry (area)'],
      unlockedAreaIds: ['lead_quarry']
    }
  ];

  const embed = createLevelUpSummaryEmbed(singleLevelUp, 'SingleHero', engine.content);
  assert.ok(embed, 'Embed should be created');
  assert.equal(embed.title, '🎉 Mining Level Up!');
  assert.equal(embed.description, 'Congratulations, **SingleHero**!');

  const levelField = embed.fields.find(f => f.name.includes('Level'));
  assert.ok(levelField, 'Should contain Level field');
  assert.equal(levelField.value, 'Level 1 → Level 2');

  const rewardField = embed.fields.find(f => f.name.includes('Rewards'));
  assert.ok(rewardField, 'Should contain Rewards field');
  assert.equal(rewardField.value, '• +5 Sterlings');

  const unlockField = embed.fields.find(f => f.name.includes('New Unlocks'));
  assert.ok(unlockField, 'Should contain New Unlocks field');
  assert.ok(unlockField.value.includes('Lead Ore'));
  assert.equal(unlockField.value.includes('(area)'), false, 'Should exclude (area) strings from item unlocks');

  const sectorField = embed.fields.find(f => f.name.includes('New Sectors'));
  assert.equal(sectorField, undefined, 'Skill level-ups must never contain New Sectors');
});

test('Level-Up Summary: Multiple level-ups aggregation, reward sum, unlock deduplication & sector ordering', async () => {
  const engine = new Engine();
  await engine.init();

  const multiLevelUps = [
    {
      from: 1,
      to: 2,
      sterlingsAwarded: 5,
      skillId: 'mining',
      unlocks: ['Lead Ore', 'Lead Quarry (area)'],
      unlockedAreaIds: ['lead_quarry']
    },
    {
      from: 2,
      to: 3,
      sterlingsAwarded: 5,
      skillId: 'mining',
      unlocks: ['Sand', 'Sand Dunes (area)', 'Lead Ore'], // duplicate Lead Ore
      unlockedAreaIds: ['sand_dunes']
    },
    {
      from: 3,
      to: 4,
      sterlingsAwarded: 5,
      skillId: 'mining',
      unlocks: ['Titanium Ore', 'Titanium Caverns (area)'],
      unlockedAreaIds: ['titanium_caverns']
    },
    {
      from: 4,
      to: 5,
      sterlingsAwarded: 5,
      skillId: 'mining',
      unlocks: [],
      unlockedAreaIds: []
    }
  ];

  const embed = createLevelUpSummaryEmbed(multiLevelUps, 'MultiHero', engine.content);
  assert.ok(embed);

  // 1. Level range Level 1 → Level 5
  const levelField = embed.fields.find(f => f.name.includes('Level'));
  assert.equal(levelField.value, 'Level 1 → Level 5');

  // 2. Sum rewards (5 + 5 + 5 + 5 = 20)
  const rewardField = embed.fields.find(f => f.name.includes('Rewards'));
  assert.equal(rewardField.value, '• +20 Sterlings');

  // 3. Deduplicated unlocks
  const unlockField = embed.fields.find(f => f.name.includes('New Unlocks'));
  assert.ok(unlockField);
  const unlockLines = unlockField.value.split('\n');
  assert.equal(unlockLines.length, 3, 'Should contain 3 unique item unlocks');
  assert.equal(unlockLines[0], '• Lead Ore');
  assert.equal(unlockLines[1], '• Sand');
  assert.equal(unlockLines[2], '• Titanium Ore');

  // 4. Skill summaries never render sector notifications, even for legacy payloads.
  assert.equal(embed.fields.some(f => f.name.includes('New Sectors')), false);

  // 5. Hero summaries are the single source of sector notifications.
  const heroLevelUps = [
    {
      from: 4,
      to: 5,
      skillId: 'hero',
      unlocks: ['Lead Quarry (area)'],
      unlockedAreaIds: ['lead_quarry']
    },
    {
      from: 9,
      to: 10,
      skillId: 'hero',
      unlocks: ['Sand Dunes (area)'],
      unlockedAreaIds: ['sand_dunes']
    },
    {
      from: 14,
      to: 15,
      skillId: 'hero',
      unlocks: ['Titanium Caverns (area)'],
      unlockedAreaIds: ['titanium_caverns']
    }
  ];
  const heroEmbed = createLevelUpSummaryEmbed(heroLevelUps, 'MultiHero', engine.content);
  const sectorField = heroEmbed.fields.find(f => f.name.includes('New Sectors'));
  assert.ok(sectorField);
  const sectorValue = sectorField.value;

  const leadIndex = sectorValue.indexOf('Sector 02 — Lead Quarry');
  const sandIndex = sectorValue.indexOf('Sector 03 — Sand Dunes');
  const titIndex = sectorValue.indexOf('Sector 04 — Titanium Caverns');

  assert.ok(leadIndex !== -1 && sandIndex !== -1 && titIndex !== -1, 'All 3 sectors present');
  assert.ok(leadIndex < sandIndex && sandIndex < titIndex, 'Sectors ordered in progression order');
  assert.ok(sectorValue.includes('.travel 2'));
  assert.ok(sectorValue.includes('.travel 3'));
  assert.ok(sectorValue.includes('.travel 4'));
});
