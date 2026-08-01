import { createProfileEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'start',
  category: 'player',
  description: 'Start your journey or log into your player account.',
  async execute(interaction, gameService) {
    try {
      const playerId = interaction.user.id;
      const username = interaction.user.username;
      const res = await gameService.start(playerId, username);
      const profile = await gameService.getProfile(playerId);
      return { embed: createProfileEmbed(profile) };
    } catch (err) {
      return { embed: createErrorEmbed('Start Error', err.message) };
    }
  }
};
