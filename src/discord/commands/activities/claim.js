import { createActivityResultEmbed, createLevelUpEmbed, createErrorEmbed, createSectorUnlockEmbed, createNothingToClaimEmbed } from '../../embeds.js';

export default {
  name: 'claim',
  category: 'activities',
  description: 'Claim rewards and XP for completed offline activity cycles.',
  async execute(interaction, gameService) {
    try {
      const result = await gameService.claimActivity(interaction.user.id);
      if (!result) {
        return { embed: createNothingToClaimEmbed() };
      }
      const rewardEmbed = createActivityResultEmbed('claim', result, gameService.engine.content);
      const embeds = [rewardEmbed];

      if (result && Array.isArray(result.levelUps) && result.levelUps.length > 0) {
        for (const lu of result.levelUps) {
          embeds.push(createLevelUpEmbed(lu, interaction.user.username));
          if (lu.unlockedAreaIds && lu.unlockedAreaIds.length > 0) {
            for (const areaId of lu.unlockedAreaIds) {
              embeds.push(createSectorUnlockEmbed(areaId, gameService.engine.content));
            }
          }
        }
      }

      if (embeds.length === 1) {
        return { embed: rewardEmbed };
      }
      return { embed: rewardEmbed, embeds };
    } catch (err) {
      return { embed: createErrorEmbed('Claim Error', err.message) };
    }
  }
};

