import { createActivityResultEmbed, createLevelUpSummaryEmbed, createErrorEmbed, createNothingToClaimEmbed } from '../../embeds.js';

export default {
  name: 'claim',
  category: 'activities',
  description: 'Claim rewards and XP for mining, woodcutting, or fishing.',
  async execute(interaction, gameService) {
    try {
      const result = await gameService.claimActivity(interaction.user.id);

      if (!result) {
        return { embed: createNothingToClaimEmbed() };
      }

      const rewardEmbed = createActivityResultEmbed('claim', result, gameService.engine.content);
      const embeds = [rewardEmbed];

      const progressionSummaries = [
        result?.levelUps,
        result?.heroLevelUps
      ].filter(levelUps => Array.isArray(levelUps) && levelUps.length > 0);

      for (const levelUps of progressionSummaries) {
        const levelUpSummary = createLevelUpSummaryEmbed(levelUps, interaction.user.username, gameService.engine.content);
        if (levelUpSummary) embeds.push(levelUpSummary);
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
