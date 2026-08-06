import { COLORS, getItemDisplay, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'withdraw',
  category: 'inventory',
  description: 'Withdraw items from bank storage into your inventory.',
  options: [
    { name: 'item', description: 'Item name or ID to withdraw', type: 'STRING', required: true },
    { name: 'amount', description: 'Positive quantity, or all', type: 'STRING', required: false }
  ],
  async execute(interaction, gameService) {
    try {
      const itemId = interaction.options?.getString('item');
      const amountRaw = interaction.options?.getString('amount') || '1';

      const res = await gameService.withdrawItem(interaction.user.id, itemId, amountRaw);
      if (!res.success) {
        const message = res.message || (res.reason === 'invalid_quantity'
          ? 'Quantity must be a positive integer.'
          : `You do not have any **${itemId}** in your bank storage.`);
        return { embed: createErrorEmbed('Withdraw Failed', message) };
      }

      const display = getItemDisplay(itemId, gameService.engine.content);

      return {
        embed: {
          title: `🎒 Items Withdrawn`,
          description: `Withdrew x${res.amount} **${display.label}** into your inventory.`,
          fields: [
            { name: '🏦 Remaining in Storage', value: `${res.remainingStorage}`, inline: true },
            { name: '🎒 Total in Inventory', value: `${res.totalInventory}`, inline: true }
          ],
          color: COLORS.SUCCESS
        }
      };
    } catch (err) {
      return { embed: createErrorEmbed('Withdraw Error', err.message) };
    }
  }
};
