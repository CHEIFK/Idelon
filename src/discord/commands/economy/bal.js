import { createBalanceEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'bal',
  category: 'economy',
  description: "View your account balance (Gold and Sterlings).",
  async execute(interaction, gameService) {
    try {
      const balance = await gameService.getBalance(interaction.user.id);
      return { embed: createBalanceEmbed(balance, interaction.user.username, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Balance Error', err.message) };
    }
  }
};
