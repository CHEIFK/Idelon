import { COLORS, createErrorEmbed } from '../../embeds.js';

export default {
  name: 'dev',
  category: 'admin',
  description: 'Developer / Admin commands (Authorized Users Only).',
  async execute(interaction, gameService, devService) {
    if (!devService) {
      return { embed: createErrorEmbed('Dev Toolkit Disabled', 'Developer toolkit is not configured.') };
    }

    const adminId = interaction.user.id;
    if (!devService.isDev(adminId)) {
      return { embed: createErrorEmbed('Permission Denied', 'You are not an authorized developer.') };
    }

    const subcommand = interaction.options?.getString('subcommand');
    const targetUser = interaction.options?.getString('target_user') || adminId;

    try {
      let result;
      switch (subcommand) {
        case 'give-item': {
          const item = interaction.options?.getString('item');
          const amount = interaction.options?.getInteger('amount') || 1;
          result = await devService.giveItem(adminId, targetUser, item, amount);
          return { embed: { title: '🛠️ Dev: Give Item', description: `Gave x${amount} **${item}** to ${targetUser}`, color: COLORS.SUCCESS } };
        }
        case 'remove-item': {
          const item = interaction.options?.getString('item');
          const amount = interaction.options?.getInteger('amount') || 1;
          result = await devService.removeItem(adminId, targetUser, item, amount);
          return { embed: { title: '🛠️ Dev: Remove Item', description: `Removed x${amount} **${item}** from ${targetUser}`, color: COLORS.WARNING } };
        }
        case 'add-xp': {
          const skill = interaction.options?.getString('skill');
          const xp = interaction.options?.getInteger('amount') || 100;
          result = await devService.addXP(adminId, targetUser, skill, xp);
          return { embed: { title: '🛠️ Dev: Add XP', description: `Added +${xp} XP in **${skill}** to ${targetUser}`, color: COLORS.SUCCESS } };
        }
        case 'set-level': {
          const level = interaction.options?.getInteger('amount') || 1;
          result = await devService.setLevel(adminId, targetUser, level);
          return { embed: { title: '🛠️ Dev: Set Level', description: `Set ${targetUser}'s level to **${level}**`, color: COLORS.SUCCESS } };
        }
        case 'give-currency': {
          const currency = interaction.options?.getString('currency') || 'gold';
          const amount = interaction.options?.getInteger('amount') || 100;
          result = await devService.giveCurrency(adminId, targetUser, currency, amount);
          return { embed: { title: '🛠️ Dev: Give Currency', description: `Gave +${amount} **${currency}** to ${targetUser}`, color: COLORS.GOLD } };
        }
        case 'teleport': {
          const area = interaction.options?.getString('area');
          result = await devService.teleport(adminId, targetUser, area);
          return { embed: { title: '🛠️ Dev: Teleport', description: `Teleported ${targetUser} to **${area}**`, color: COLORS.SUCCESS } };
        }
        case 'complete-quest': {
          const quest = interaction.options?.getString('quest');
          result = await devService.completeQuest(adminId, targetUser, quest);
          return { embed: { title: '🛠️ Dev: Complete Quest', description: `Force completed quest **${quest}** for ${targetUser}`, color: COLORS.SUCCESS } };
        }
        case 'reset-quest': {
          const quest = interaction.options?.getString('quest');
          result = await devService.resetQuest(adminId, targetUser, quest);
          return { embed: { title: '🛠️ Dev: Reset Quest', description: `Reset quest **${quest}** for ${targetUser}`, color: COLORS.WARNING } };
        }
        case 'spawn-enemy': {
          const enemy = interaction.options?.getString('enemy');
          result = await devService.spawnEnemy(adminId, targetUser, enemy);
          return { embed: { title: '🛠️ Dev: Spawn Enemy', description: `Spawned fight against **${enemy}** for ${targetUser}`, color: COLORS.SUCCESS } };
        }
        case 'force-activity-complete': {
          result = await devService.forceActivityComplete(adminId, targetUser);
          return { embed: { title: '🛠️ Dev: Force Activity Complete', description: `Force completed activity for ${targetUser}`, color: COLORS.SUCCESS } };
        }
        case 'reload-content': {
          result = await devService.reloadContent(adminId);
          return { embed: { title: '🛠️ Dev: Reload Content', description: `All JSON game content reloaded successfully!`, color: COLORS.SUCCESS } };
        }
        case 'player-info': {
          result = await devService.getPlayerInfo(adminId, targetUser);
          return {
            embed: {
              title: `🛠️ Dev: Player Info for ${targetUser}`,
              description: `\`\`\`json\n${JSON.stringify(result.profile, null, 2)}\n\`\`\``,
              color: COLORS.PRIMARY
            }
          };
        }
        default:
          return { embed: createErrorEmbed('Dev Command Error', `Unknown subcommand '${subcommand}'.`) };
      }
    } catch (err) {
      return { embed: createErrorEmbed('Dev Action Error', err.message) };
    }
  }
};
