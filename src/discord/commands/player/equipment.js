import { createEquipmentEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'equipment',
  category: 'player',
  description: 'View your currently equipped gear.',
  async execute(interaction, gameService) {
    try {
      const eq = await gameService.getEquipment(interaction.user.id);
      return { embed: createEquipmentEmbed(interaction.user.username, eq, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Equipment Error', err.message) };
    }
  }
};
