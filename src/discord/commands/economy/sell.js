import { COLORS, getItemDisplay, createErrorEmbed, createSellInfoEmbed } from '../../embeds.js';

export default {
  name: 'sell',
  category: 'economy',
  description: 'Sell items from your inventory for gold (or .sell all to sell all ores).',
  options: [
    { name: 'item', description: 'Item name or ID to sell, or all for every ore', type: 'STRING', required: false },
    { name: 'amount', description: 'Positive quantity to sell', type: 'STRING', required: false }
  ],
  async execute(interaction, gameService) {
    try {
      let itemInput = interaction.options?.getString('item') || '';
      let amountRaw = interaction.options?.getString('amount');

      if (!itemInput || itemInput.trim() === '') {
        const inventory = await gameService.getInventory(interaction.user.id);
        return { embed: createSellInfoEmbed(inventory, gameService.engine.content) };
      }

      // Check if .sell all or /sell all was invoked
      if (itemInput.trim().toLowerCase() === 'all' && (!amountRaw || amountRaw.trim() === '')) {
        const resAll = await gameService.sellItem(interaction.user.id, 'all');
        if (!resAll.success) {
          return { embed: createErrorEmbed('Sale Failed', 'You do not own any **Ores** in your inventory to sell.') };
        }

        const lines = resAll.itemsSold.map(item => {
          const display = getItemDisplay(item.itemId, gameService.engine.content);
          return `${display.emoji} **${item.name}**: ×**${item.quantity}** @ \`${item.unitValue} Gold each\` ➔ +**${item.goldEarned} Gold**`;
        });

        return {
          embed: {
            title: `💰 Ore Bulk Sale Complete!`,
            description: lines.join('\n'),
            fields: [
              { name: '💰 Total Gold Earned', value: `+**${resAll.totalGold} Gold**`, inline: true },
              { name: '💳 New Gold Balance', value: `**${resAll.newGoldBalance} Gold**`, inline: true }
            ],
            color: COLORS.SUCCESS
          }
        };
      }

      // Single item or /sell copper all parameter resolution
      if (!amountRaw && itemInput) {
        const parts = itemInput.trim().split(/\s+/);
        if (parts.length > 1) {
          const lastToken = parts[parts.length - 1].toLowerCase();
          if (lastToken === 'all' || /^\d+$/.test(lastToken)) {
            amountRaw = lastToken;
            itemInput = parts.slice(0, -1).join(' ');
          }
        }
      }

      if (!amountRaw) amountRaw = '1';

      // Check if user typed .sell all again after parameter normalization
      if (itemInput.trim().toLowerCase() === 'all') {
        if (amountRaw) {
          return { embed: createErrorEmbed('Sale Failed', 'Bulk ore sales do not accept a quantity.') };
        }
        const resAll = await gameService.sellItem(interaction.user.id, 'all');
        if (!resAll.success) {
          return { embed: createErrorEmbed('Sale Failed', 'You do not own any **Ores** in your inventory to sell.') };
        }

        const lines = resAll.itemsSold.map(item => {
          const display = getItemDisplay(item.itemId, gameService.engine.content);
          return `${display.emoji} **${item.name}**: ×**${item.quantity}** @ \`${item.unitValue} Gold each\` ➔ +**${item.goldEarned} Gold**`;
        });

        return {
          embed: {
            title: `💰 Ore Bulk Sale Complete!`,
            description: lines.join('\n'),
            fields: [
              { name: '💰 Total Gold Earned', value: `+**${resAll.totalGold} Gold**`, inline: true },
              { name: '💳 New Gold Balance', value: `**${resAll.newGoldBalance} Gold**`, inline: true }
            ],
            color: COLORS.SUCCESS
          }
        };
      }

      const res = await gameService.sellItem(interaction.user.id, itemInput, amountRaw);

      if (!res.success) {
        const errMsg = res.message || `You do not own any **${itemInput}** in your inventory.`;
        return { embed: createErrorEmbed('Sale Failed', errMsg) };
      }

      const display = getItemDisplay(res.itemId, gameService.engine.content);

      return {
        embed: {
          title: `💰 Items Sold!`,
          fields: [
            { name: 'Sold', value: `**${display.label}** ×${res.count}`, inline: false },
            { name: 'Gold Earned', value: `+**${res.totalGold} Gold**`, inline: true },
            { name: 'New Balance', value: `**${res.newGoldBalance} Gold**`, inline: true }
          ],
          color: COLORS.SUCCESS
        }
      };
    } catch (err) {
      return { embed: createErrorEmbed('Sell Error', err.message) };
    }
  }
};
