import { createShopEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'shop',
  category: 'economy',
  description: 'View current marketplace items, sell values, and gold balance.',
  async execute(interaction, gameService) {
    try {
      const shopData = await gameService.getShop(interaction.user.id);
      return { embed: createShopEmbed(shopData, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Shop Error', err.message) };
    }
  }
};
