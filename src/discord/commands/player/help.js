import { createHelpEmbed } from '../../embeds.js';

export default {
  name: 'help',
  category: 'player',
  description: 'Display all available commands grouped by category.',
  async execute() {
    return { embed: createHelpEmbed() };
  }
};
