import { createCombatResultEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'fight',
  category: 'combat',
  description: 'Engage an enemy in battle.',
  options: [{ name: 'enemy', type: 'STRING', required: true }],
  async execute(interaction, gameService) {
    try {
      const enemyId = interaction.options?.getString('enemy') || 'goblin';
      const result = await gameService.fight(interaction.user.id, enemyId);

      if (!result.success && result.reason === 'unknown_enemy') {
        return { embed: createErrorEmbed('Unknown Enemy', `Enemy \`${enemyId}\` does not exist. Use \`/enemies\` to see available enemies in your current area.`) };
      }

      return { embed: createCombatResultEmbed(result) };
    } catch (err) {
      return { embed: createErrorEmbed('Combat Error', err.message) };
    }
  }
};
