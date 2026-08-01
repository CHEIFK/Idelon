import { createInventoryEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'inv',
  category: 'inventory',
  description: 'View items currently carried in your inventory.',
  async execute(interaction, gameService) {
    try {
      const inv = await gameService.getInventory(interaction.user.id);
      return { embed: createInventoryEmbed(interaction.user.username, inv, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Inventory Error', err.message) };
    }
  }
};
