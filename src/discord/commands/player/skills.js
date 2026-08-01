import { createSkillsEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'skills',
  category: 'player',
  description: 'View your skill levels and XP progress.',
  async execute(interaction, gameService) {
    try {
      const sk = await gameService.getSkills(interaction.user.id);
      return { embed: createSkillsEmbed(interaction.user.username, sk) };
    } catch (err) {
      return { embed: createErrorEmbed('Skills Error', err.message) };
    }
  }
};
