import { createBuyPotionEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'buy',
  category: 'economy',
  description: 'Buy a potion with Gold.',
  options: [
    { name: 'item', description: 'Potion name or ID', type: 'STRING', required: true },
    { name: 'amount', description: 'Positive quantity to buy', type: 'STRING', required: false }
  ],
  async execute(interaction, gameService) {
    try {
      const itemInput = interaction.options?.getString('item') || '';
      const amount = interaction.options?.getString('amount') || '1';
      if (!itemInput.trim()) {
        return { embed: createErrorEmbed('Purchase Failed', 'Specify a potion to buy.') };
      }
      const result = await gameService.buyPotion(interaction.user.id, itemInput, amount);
      return { embed: result.success
        ? createBuyPotionEmbed(result, gameService.engine.content)
        : createErrorEmbed('Potion Purchase Failed', result.message || `Unable to buy **${itemInput}**.`) };
    } catch (err) {
      return { embed: createErrorEmbed('Buy Error', err.message) };
    }
  }
};
