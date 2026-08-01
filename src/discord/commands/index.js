import startCmd from './player/start.js';
import profileCmd from './player/profile.js';
import skillsCmd from './player/skills.js';
import helpCmd from './player/help.js';
import invCmd from './player/inv.js';
import storageCmd from './player/storage.js';
import depositCmd from './player/deposit.js';
import withdrawCmd from './player/withdraw.js';

import mineCmd from './activities/mine.js';
import claimCmd from './activities/claim.js';

import fightCmd from './combat/fight.js';
import enemiesCmd from './combat/enemies.js';

import travelCmd from './world/travel.js';
import areasCmd from './world/areas.js';

import shopCmd from './economy/shop.js';
import sellCmd from './economy/sell.js';
import balCmd from './economy/bal.js';

import devCmd from './dev/dev.js';

const commandsList = [
  startCmd,
  profileCmd,
  skillsCmd,
  helpCmd,

  mineCmd,
  claimCmd,

  invCmd,
  storageCmd,
  depositCmd,
  withdrawCmd,

  fightCmd,
  enemiesCmd,

  travelCmd,
  areasCmd,

  shopCmd,
  sellCmd,
  balCmd,

  devCmd
];

export class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.categories = new Map();

    for (const cmd of commandsList) {
      this.commands.set(cmd.name, cmd);
      if (!this.categories.has(cmd.category)) {
        this.categories.set(cmd.category, []);
      }
      this.categories.get(cmd.category).push(cmd);
    }
  }

  getCommand(name) {
    return this.commands.get(name) || null;
  }

  getAllCommands() {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(category) {
    return this.categories.get(category) || [];
  }

  /**
   * Handle slash command interaction payload.
   */
  async handleInteraction(interaction, gameService, devService = null) {
    const cmdName = interaction.commandName.toLowerCase();
    const cmd = this.getCommand(cmdName);
    if (!cmd) {
      return {
        embed: {
          title: '❌ Command Not Found',
          description: `Command \`/${cmdName}\` is not registered. Use \`/help\` or \`.help\` to see available commands.`,
          color: 0xE74C3C
        }
      };
    }

    return await cmd.execute(interaction, gameService, devService);
  }

  /**
   * Handle text prefix command alias payload (e.g. ".profile", ".sell iron 5").
   */
  async handleTextMessage(textInput, user, gameService, devService = null) {
    if (!textInput || typeof textInput !== 'string') return null;

    const trimmed = textInput.trim();
    if (!trimmed.startsWith('.') && !trimmed.startsWith('/')) return null;

    const body = trimmed.slice(1).trim();
    if (!body) return null;

    const parts = body.split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const cmd = this.getCommand(cmdName);
    if (!cmd) return null;

    // Build mock options matching Discord Slash Command Interaction API
    const mockOptions = {
      getString: (name) => {
        if (name === 'subcommand') return args[0] || null;
        if (name === 'item' || name === 'activity' || name === 'enemy' || name === 'area') {
          // If 2+ args and last arg is numeric or "all", return first arg as item name
          if (args.length >= 2 && (args[args.length - 1].toLowerCase() === 'all' || /^\d+$/.test(args[args.length - 1]))) {
            return args.slice(0, -1).join(' ');
          }
          return args.join(' ') || null;
        }
        if (name === 'amount' || name === 'slot') {
          if (args.length >= 2 && (args[args.length - 1].toLowerCase() === 'all' || /^\d+$/.test(args[args.length - 1]))) {
            return args[args.length - 1];
          }
          return args[1] || args[0] || null;
        }
        return args.join(' ') || null;
      },
      getInteger: (name) => {
        const val = parseInt(args[1] || args[0], 10);
        return isNaN(val) ? null : val;
      }
    };

    const mockInteraction = {
      commandName: cmdName,
      user: {
        id: user.id,
        username: user.username || user.tag || 'Adventurer'
      },
      options: mockOptions,
      rawArgs: args
    };

    return await cmd.execute(mockInteraction, gameService, devService);
  }
}

export const commandRegistry = new CommandRegistry();
