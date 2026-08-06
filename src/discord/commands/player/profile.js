import { createProfileEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'profile',
  category: 'player',
  description: 'View a compact overview of your hero, buffs, and skills.',
  async execute(interaction, gameService) {
    try {
      const userId = interaction.user.id;
      const buffs = await gameService.getBuffs(userId);
      const profile = await gameService.getProfile(userId);
      const skills = await gameService.getSkills(userId);
      return { embed: createProfileEmbed(profile, gameService.engine.content, skills, buffs) };
    } catch (err) {
      return { embed: createErrorEmbed('Profile Error', err.message) };
    }
  }
};
