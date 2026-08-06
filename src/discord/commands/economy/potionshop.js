import { createErrorEmbed, createPotionShopEmbed } from '../../embeds.js';

export default {
  name: 'potionshop',
  category: 'economy',
  description: 'View potions available for purchase with Gold.',
  async execute(interaction, gameService) {
    try {
      const shop = await gameService.getPotionShop(interaction.user.id);
      return { embed: createPotionShopEmbed(shop, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Potion Shop Error', err.message) };
    }
  }
};
