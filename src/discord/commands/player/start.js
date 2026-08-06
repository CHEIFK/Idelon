import { createWelcomeEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'start',
  category: 'player',
  description: 'Start your journey with a quick guide to Idelon.',
  async execute(interaction, gameService) {
    try {
      const playerId = interaction.user.id;
      const username = interaction.user.username;
      await gameService.start(playerId, username);
      return { embed: createWelcomeEmbed() };
    } catch (err) {
      return { embed: createErrorEmbed('Start Error', err.message) };
    }
  }
};
