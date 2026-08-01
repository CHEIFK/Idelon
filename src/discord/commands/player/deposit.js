import { COLORS, getItemDisplay, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'deposit',
  category: 'inventory',
  description: 'Deposit items from your inventory into bank storage.',
  options: [
    { name: 'item', type: 'STRING', required: true },
    { name: 'amount', type: 'STRING', required: false }
  ],
  async execute(interaction, gameService) {
    try {
      const itemId = interaction.options?.getString('item');
      const amountRaw = interaction.options?.getString('amount') || '1';

      const res = await gameService.depositItem(interaction.user.id, itemId, amountRaw);
      if (!res.success) {
        return { embed: createErrorEmbed('Deposit Failed', `You do not own any **${itemId}** in your inventory.`) };
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
