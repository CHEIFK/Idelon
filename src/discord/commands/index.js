import startCmd from './player/start.js';
import profileCmd from './player/profile.js';
import statsCmd from './player/stats.js';
import equipmentCmd from './player/equipment.js';
import skillsCmd from './player/skills.js';
import helpCmd from './player/help.js';
import invCmd from './player/inv.js';
import storageCmd from './player/storage.js';
import depositCmd from './player/deposit.js';
import withdrawCmd from './player/withdraw.js';
import useCmd from './player/use.js';

import mineCmd from './activities/mine.js';
import claimCmd from './activities/claim.js';

import huntCmd from './combat/hunt.js';
import enemiesCmd from './combat/enemies.js';

import travelCmd from './world/travel.js';
import areasCmd from './world/areas.js';

import shopCmd from './economy/shop.js';
import sellCmd from './economy/sell.js';
import balCmd from './economy/bal.js';
import potionshopCmd from './economy/potionshop.js';
import buyCmd from './economy/buy.js';

import devCmd from './dev/dev.js';

const commandsList = [
  startCmd,
  profileCmd,
  statsCmd,
  equipmentCmd,
  skillsCmd,
  helpCmd,

  mineCmd,
  claimCmd,

  invCmd,
  storageCmd,
  depositCmd,
  withdrawCmd,
  useCmd,

  huntCmd,
  enemiesCmd,

  travelCmd,
  areasCmd,

  shopCmd,
  sellCmd,
  balCmd,
  potionshopCmd,
  buyCmd,

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
    if (name === 'fight') {
      return this.commands.get('hunt') || null;
    }
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

    const cleanBody = trimmed.replace(/^[\.\/]+/, '').trim();
    if (!cleanBody) return null;

    const parts = cleanBody.split(/\s+/);
    const rawFirstToken = parts[0];
    const args = parts.slice(1);

    // Extract first command prefix if repeated (e.g., .fight.fight.fight or .travel.travel.travel 2)
    const subTokens = rawFirstToken.split(/[\.\/]+/).filter(Boolean);
    let cmdName = rawFirstToken.toLowerCase();
    let cmd = this.getCommand(cmdName);

    if (!cmd && subTokens.length > 0) {
      const candidateName = subTokens[0].toLowerCase();
      const candidateCmd = this.getCommand(candidateName);
      if (candidateCmd) {
        cmdName = candidateName;
        cmd = candidateCmd;
      }
    }

    if (!cmd) return null;

    // Build mock options matching Discord Slash Command Interaction API
    const mockOptions = {
      getSubcommand: () => args[0] || null,
      getString: (name) => {
        if (name === 'subcommand') return args[0] || null;

        // Special handling for dev command subcommands with positional parameters
        if (cmdName === 'dev') {
          const subArgs = args.slice(1);
          const subcommand = args[0] || '';
          const isNumeric = value => /^-?\d+(?:\.\d+)?$/.test(value || '');
          const itemCommands = new Set(['give-item', 'remove-item']);
          if (itemCommands.has(subcommand)) {
            const secondIsAmount = isNumeric(subArgs[1]);
            if (name === 'target_user' || name === 'target' || name === 'target_player' || name === 'player') {
              return secondIsAmount ? (subArgs[2] || null) : (subArgs[0] || null);
            }
            if (name === 'item') {
              return secondIsAmount ? (subArgs[0] || null) : (subArgs[1] || null);
            }
            if (name === 'amount') {
              return secondIsAmount ? (subArgs[1] || null) : (subArgs[2] || null);
            }
          }
          if (subcommand === 'add-xp') {
            const slashOrder = isNumeric(subArgs[1]);
            if (name === 'skill') return slashOrder ? (subArgs[0] || null) : (subArgs[1] || null);
            if (name === 'amount' || name === 'xp' || name === 'xp_amount') return slashOrder ? (subArgs[1] || null) : (subArgs[2] || null);
            if (name === 'target_user' || name === 'target' || name === 'target_player' || name === 'player') return slashOrder ? (subArgs[2] || null) : (subArgs[0] || null);
          }
          if (subcommand === 'set-level') {
            const slashOrder = isNumeric(subArgs[0]);
            if (name === 'amount' || name === 'level') return slashOrder ? (subArgs[0] || null) : (subArgs[1] || null);
            if (name === 'target_user' || name === 'target' || name === 'target_player' || name === 'player') return slashOrder ? (subArgs[1] || null) : (subArgs[0] || null);
          }
          if (subcommand === 'give-currency') {
            const slashOrder = isNumeric(subArgs[1]);
            if (name === 'currency') return slashOrder ? (subArgs[0] || null) : (subArgs[1] || null);
            if (name === 'amount') return slashOrder ? (subArgs[1] || null) : (subArgs[2] || null);
            if (name === 'target_user' || name === 'target' || name === 'target_player' || name === 'player') return slashOrder ? (subArgs[2] || null) : (subArgs[0] || null);
          }
          if (subcommand === 'teleport') {
            const firstIsArea = Boolean(gameService?.engine?.content?.getArea(subArgs[0]));
            if (name === 'area') return firstIsArea ? (subArgs[0] || null) : (subArgs[1] || null);
            if (name === 'target_user' || name === 'target' || name === 'target_player' || name === 'player') return firstIsArea ? (subArgs[1] || null) : (subArgs[0] || null);
          }
          if (subcommand === 'spawn-enemy') {
            const firstIsEnemy = Boolean(gameService?.engine?.content?.getEnemy(subArgs[0]));
            if (name === 'enemy') return firstIsEnemy || subArgs.length === 1 ? (subArgs[0] || null) : (subArgs[1] || null);
            if (name === 'target_user' || name === 'target' || name === 'target_player' || name === 'player') return firstIsEnemy || subArgs.length === 1 ? (subArgs[1] || null) : (subArgs[0] || null);
          }
          if (name === 'target' || name === 'target_player' || name === 'target_user' || name === 'player') {
            return subArgs[0] || null;
          }
          if (name === 'item' || name === 'area' || name === 'skill' || name === 'currency' || name === 'enemy') {
            return subArgs[1] || null;
          }
          if (name === 'amount' || name === 'level' || name === 'xp' || name === 'xp_amount') {
            return subArgs[2] || subArgs[1] || null;
          }
          return subArgs[0] || null;
        }

        // Sector names may contain a number (for example, "sector 2").
        // Unlike item quantities, the entire value belongs to the option.
        if (cmdName === 'travel' && name === 'sector') {
          return args.join(' ') || null;
        }

        // Standard commands (sell, deposit, withdraw, mine, fight, travel, etc.)
        if (name === 'item' || name === 'activity' || name === 'enemy' || name === 'area' || name === 'sector') {
          if (args.length >= 2 && (args[args.length - 1].toLowerCase() === 'all' || /^-?\d+(?:\.\d+)?$/.test(args[args.length - 1]))) {
            return args.slice(0, -1).join(' ');
          }
          return args.join(' ') || null;
        }
        if (name === 'amount' || name === 'slot' || name === 'count' || name === 'quantity') {
          if (args.length >= 2 && (args[args.length - 1].toLowerCase() === 'all' || /^-?\d+(?:\.\d+)?$/.test(args[args.length - 1]))) {
            return args[args.length - 1];
          }
          return null;
        }
        return args[0] || null;
      },
      getInteger: (name) => {
        if (cmdName === 'dev') {
          const subArgs = args.slice(1);
          const subcommand = args[0] || '';
          if (subcommand === 'add-xp') {
            const candidate = /^-?\d+$/.test(subArgs[1] || '') ? subArgs[1] : subArgs[2];
            const parsedCandidate = parseInt(candidate, 10);
            return Number.isNaN(parsedCandidate) ? null : parsedCandidate;
          }
          if (subcommand === 'set-level') {
            const candidate = /^-?\d+$/.test(subArgs[0] || '') ? subArgs[0] : subArgs[1];
            const parsedCandidate = parseInt(candidate, 10);
            return Number.isNaN(parsedCandidate) ? null : parsedCandidate;
          }
          if (subcommand === 'give-currency') {
            const candidate = /^-?\d+$/.test(subArgs[1] || '') ? subArgs[1] : subArgs[2];
            const parsedCandidate = parseInt(candidate, 10);
            return Number.isNaN(parsedCandidate) ? null : parsedCandidate;
          }
          if (subcommand === 'give-item' || subcommand === 'remove-item') {
            const second = subArgs[1];
            const candidate = /^-?\d+$/.test(second || '') ? second : subArgs[2];
            const parsedCandidate = parseInt(candidate, 10);
            return Number.isNaN(parsedCandidate) ? null : parsedCandidate;
          }
          if (name === 'amount' || name === 'level' || name === 'xp' || name === 'xp_amount') {
            const val = parseInt(subArgs[2] || subArgs[1], 10);
            return isNaN(val) ? null : val;
          }
          const val = parseInt(subArgs[0], 10);
          return isNaN(val) ? null : val;
        }
        const lastArg = args[args.length - 1];
        if (/^-?\d+$/.test(lastArg)) {
          const val = parseInt(lastArg, 10);
          return isNaN(val) ? null : val;
        }
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
