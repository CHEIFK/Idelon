import { createErrorEmbed, createUseItemEmbed } from '../../embeds.js';

export default {
  name: 'use',
  category: 'player',
  description: 'Consume a potion from your inventory.',
  options: [
    { name: 'item', description: 'Potion name or ID', type: 'STRING', required: true }
  ],
  async execute(interaction, gameService) {
    try {
      const itemInput = interaction.options?.getString('item') || '';
      if (!itemInput.trim()) {
        return { embed: createErrorEmbed('Use Item Failed', 'Specify a potion to use.') };
      }
      const result = await gameService.useItem(interaction.user.id, itemInput);
      return { embed: result.success
        ? createUseItemEmbed(result, gameService.engine.content)
        : createErrorEmbed('Use Item Failed', result.message || `Unable to use **${itemInput}**.`) };
    } catch (err) {
      return { embed: createErrorEmbed('Use Error', err.message) };
    }
  }
};
