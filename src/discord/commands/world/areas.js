import { createAreasEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'areas',
  category: 'world',
  description: 'Display all world areas and unlock statuses.',
  async execute(interaction, gameService) {
    try {
      const player = await gameService.getPlayer(interaction.user.id);
      const allAreas = gameService.engine.content.getAll('areas');
      const availableAreas = gameService.engine.world.getAvailable(player);

      return { embed: createAreasEmbed(player, allAreas, availableAreas, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Areas Error', err.message) };
    }
  }
};
