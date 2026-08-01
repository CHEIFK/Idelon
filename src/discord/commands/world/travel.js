import { COLORS, createErrorEmbed, createTravelSuccessEmbed } from '../../embeds.js';
import { resolveSectorToAreaId } from '../../../utils/sectorMap.js';

export default {
  name: 'travel',
  category: 'world',
  description: 'Travel to an unlocked world sector.',
  options: [{ name: 'sector', type: 'STRING', required: true }],
  async execute(interaction, gameService) {
    try {
      const input = interaction.options?.getString('sector');
      const areaId = resolveSectorToAreaId(input) || input; // Fallback to raw input for backwards compat
      
      // We don't have the old area easily available, pass null for fromAreaId
      const result = await gameService.travel(interaction.user.id, areaId);

      if (!result.success) {
        return { embed: createErrorEmbed('Travel Failed', `Sector '${input}' is locked or does not exist.`) };
      }

      // Need to pass the contentLoader. Actually gameService.engine.content is available
      return {
        embed: createTravelSuccessEmbed(null, areaId, gameService.engine?.content)
      };
    } catch (err) {
      return { embed: createErrorEmbed('Travel Error', err.message) };
    }
  }
};
