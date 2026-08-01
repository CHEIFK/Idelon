import { createInventoryEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'inventory',
  category: 'player',
  description: 'View items stored in your inventory.',
  async execute(interaction, gameService) {
    try {
      const inv = await gameService.getInventory(interaction.user.id);
      return { embed: createInventoryEmbed(interaction.user.username, inv) };
    } catch (err) {
      return { embed: createErrorEmbed('Inventory Error', err.message) };
    }
  }
};
