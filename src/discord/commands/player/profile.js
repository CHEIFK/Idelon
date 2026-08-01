import { createProfileEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'profile',
  category: 'player',
  description: 'View your player profile, stats, and currencies.',
  async execute(interaction, gameService) {
    try {
      const profile = await gameService.getProfile(interaction.user.id);
      return { embed: createProfileEmbed(profile) };
    } catch (err) {
      return { embed: createErrorEmbed('Profile Error', err.message) };
    }
  }
};
