import { createStatsEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'stats',
  category: 'player',
  description: 'View detailed hero stats, combat attributes, equipped gear durability, and skills.',
  async execute(interaction, gameService) {
    try {
      const userId = interaction.user.id;
      const playerObj = await gameService.getPlayer(userId);
      const profile = await gameService.getProfile(userId);
      const equipment = await gameService.getEquipment(userId);
      const attributes = gameService.engine?.attributes ? gameService.engine.attributes.getAttributes(playerObj) : {};
      const skills = await gameService.getSkills(userId);
      const contentLoader = gameService.engine?.content;

      return {
        embed: createStatsEmbed(profile, equipment, attributes, skills, contentLoader, playerObj)
      };
    } catch (err) {
      return { embed: createErrorEmbed('Stats Error', err.message) };
    }
  }
};
