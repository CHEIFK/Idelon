import { commandRegistry } from './commands/index.js';
import { createErrorEmbed } from './embeds.js';

export class DiscordBotClient {
  constructor(gameService, devService = null) {
    this.gameService = gameService;
    this.devService = devService;
    this.registry = commandRegistry;
  }

  /**
   * Dispatch mock or discord.js interaction object strictly to GameService / DevService.
   */
  async handleCommandInteraction(interaction) {
    if (!interaction || !interaction.commandName) {
      return { embed: createErrorEmbed('Invalid Interaction', 'Missing commandName in interaction.') };
    }

    try {
      return await this.registry.handleInteraction(interaction, this.gameService, this.devService);
    } catch (err) {
      return { embed: createErrorEmbed('Execution Error', err.message) };
    }
  }

  /**
   * Dispatch text prefix message command (.profile, .inv, .sell) strictly to GameService / DevService.
   */
  async handleTextMessage(textInput, user) {
    try {
      return await this.registry.handleTextMessage(textInput, user, this.gameService, this.devService);
    } catch (err) {
      return { embed: createErrorEmbed('Execution Error', err.message) };
    }
  }
}

export function createDiscordBot(gameService, devService = null) {
  return new DiscordBotClient(gameService, devService);
}

export * from './embeds.js';
export * from './commands/index.js';
