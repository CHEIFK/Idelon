import { createEnemiesEmbed, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'enemies',
  category: 'combat',
  description: 'Display available enemies in your current area.',
  async execute(interaction, gameService) {
    try {
      const player = await gameService.getPlayer(interaction.user.id);
      const currentArea = gameService.engine.content.getArea(player.currentAreaId || 'starter_village');
      const enemyIds = currentArea?.enemyIds || [];

      const enemiesList = enemyIds
        .map(id => gameService.engine.content.getEnemy(id))
        .filter(Boolean);

      return { embed: createEnemiesEmbed(player.currentAreaId || 'starter_village', enemiesList, gameService.engine.content) };
    } catch (err) {
      return { embed: createErrorEmbed('Enemies Error', err.message) };
    }
  }
};
