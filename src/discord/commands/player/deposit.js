import { COLORS, getItemDisplay, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'deposit',
  category: 'inventory',
  description: 'Deposit items from your inventory into bank storage.',
  options: [
    { name: 'item', description: 'Item name or ID to deposit', type: 'STRING', required: true },
    { name: 'amount', description: 'Positive quantity, or all', type: 'STRING', required: false }
  ],
  async execute(interaction, gameService) {
    try {
      const itemId = interaction.options?.getString('item');
      const amountRaw = interaction.options?.getString('amount') || '1';

      const res = await gameService.depositItem(interaction.user.id, itemId, amountRaw);
      if (!res.success) {
        const message = res.message || (res.reason === 'invalid_quantity'
          ? 'Quantity must be a positive integer.'
          : `You do not own any **${itemId}** in your inventory.`);
        return { embed: createErrorEmbed('Deposit Failed', message) };
      }

      const display = getItemDisplay(itemId, gameService.engine.content);

      return {
        embed: {
          title: `🏦 Items Deposited`,
          description: `Deposited x${res.amount} **${display.label}** into your bank storage.`,
          fields: [
            { name: '🎒 Remaining in Inventory', value: `${res.remainingInventory}`, inline: true },
            { name: '🏦 Total in Storage', value: `${res.totalStorage}`, inline: true }
          ],
          color: COLORS.SUCCESS
        }
      };
    } catch (err) {
      return { embed: createErrorEmbed('Deposit Error', err.message) };
    }
  }
};
