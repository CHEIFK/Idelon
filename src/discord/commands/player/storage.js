import { createStorageEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'storage',
  category: 'inventory',
  description: 'View items stored in your bank storage.',
  async execute(interaction, gameService) {
    try {
      const storage = await gameService.getStorage(interaction.user.id);
      return { embed: createStorageEmbed(interaction.user.username, storage, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Storage Error', err.message) };
    }
  }
};
