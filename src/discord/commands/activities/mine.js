import { createActivityResultEmbed, createAutoMineStartEmbed, createAlreadyMiningEmbed, createErrorEmbed, createResourceLockedEmbed } from '../../embeds.js';

const MINING_ACTIVITY_MAP = {
  copper: 'mine_copper',
  copper_ore: 'mine_copper',
  mine_copper: 'mine_copper',
  coal: 'mine_coal',
  mine_coal: 'mine_coal',
  lead: 'mine_lead',
  lead_ore: 'mine_lead',
  mine_lead: 'mine_lead',
  sand: 'mine_sand',
  mine_sand: 'mine_sand',
  titanium: 'mine_titanium',
  titanium_ore: 'mine_titanium',
  mine_titanium: 'mine_titanium',
  beryllium: 'mine_beryllium',
  beryllium_ore: 'mine_beryllium',
  mine_beryllium: 'mine_beryllium',
  thorium: 'mine_thorium',
  thorium_ore: 'mine_thorium',
  mine_thorium: 'mine_thorium',
  tungsten: 'mine_tungsten',
  tungsten_ore: 'mine_tungsten',
  mine_tungsten: 'mine_tungsten'
};

export default {
  name: 'mine',
  category: 'activities',
  description: 'Start a mining activity. Omit resource to auto-mine all unlocked ores.',
  options: [{ name: 'activity', description: 'Ore to focus on; omit to mine all unlocked ores', type: 'STRING', required: false }],
  async execute(interaction, gameService) {
    try {
      const rawInput = interaction.options?.getString('activity');

      if (rawInput) {
        // ── Manual mode: mine a specific resource ──────────────────────────
        const clean = rawInput.trim().toLowerCase().replace(/\s+/g, '_');
        const activityId = MINING_ACTIVITY_MAP[clean] || (clean.startsWith('mine_') ? clean : `mine_${clean}`);
        const result = await gameService.mine(interaction.user.id, activityId);

        if (result && result.alreadyActive) {
          return { embed: createAlreadyMiningEmbed(result.skillId || 'mining') };
        }

        if (result && result.success === false && result.reason === 'sector_locked') {
          return { embed: createResourceLockedEmbed(result.owningAreaId, gameService.engine.content) };
        }

        const resEmbed = createActivityResultEmbed('mine', result, gameService.engine.content);
        return { embed: resEmbed };
      }

      // ── Auto mode: mine all unlocked ores ──────────────────────────────
      const result = await gameService.mineAuto(interaction.user.id);

      if (result && result.alreadyActive) {
        return { embed: createAlreadyMiningEmbed('mining') };
      }

      const resEmbed = createAutoMineStartEmbed(result, gameService.engine.content);
      return { embed: resEmbed };
    } catch (err) {
      return { embed: createErrorEmbed('Mining Error', err.message) };
    }
  }
};
