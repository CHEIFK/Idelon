import { commandRegistry } from './commands/index.js';
import { executeHuntAction } from './commands/combat/hunt.js';
import { createErrorEmbed } from './embeds.js';
import { createHuntComponents, HUNT_COOLDOWN_MS, parseHuntComponentId } from './huntUi.js';

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
      const result = await this.registry.handleInteraction(interaction, this.gameService, this.devService);
      return this._decorateHuntResult(result, interaction.user?.id);
    } catch (err) {
      return { embed: createErrorEmbed('Execution Error', err.message) };
    }
  }

  /**
   * Dispatch text prefix message command (.profile, .inv, .sell) strictly to GameService / DevService.
   */
  async handleTextMessage(textInput, user) {
    try {
      const result = await this.registry.handleTextMessage(textInput, user, this.gameService, this.devService);
      return this._decorateHuntResult(result, user?.id);
    } catch (err) {
      return { embed: createErrorEmbed('Execution Error', err.message) };
    }
  }

  /**
   * Handle hunt buttons and select menus at the UI layer.
   */
  async handleComponentInteraction(interaction) {
    const parsed = parseHuntComponentId(interaction?.customId);
    if (!parsed || parsed.userId !== interaction.user?.id) return null;

    const user = {
      id: interaction.user.id,
      username: interaction.user.username
    };
    const result = await executeHuntAction(parsed.action, {
      user,
      componentData: parsed.data,
      selectedValue: interaction.values?.[0] || null
    }, this.gameService);
    const decorated = this._decorateHuntResult(result, user.id, { huntDisabled: parsed.action === 'fight' });
    return parsed.action === 'fight'
      ? { ...decorated, huntCooldownMs: HUNT_COOLDOWN_MS }
      : decorated;
  }

  async handleButtonInteraction(interaction) {
    return this.handleComponentInteraction(interaction);
  }

  _decorateHuntResult(result, userId, options = {}) {
    if (!result?.huntView || !userId) return result;
    const { huntView, huntData, ...response } = result;
    return {
      ...response,
      components: createHuntComponents(userId, huntView, huntData, options)
    };
  }
}

export function createDiscordBot(gameService, devService = null) {
  return new DiscordBotClient(gameService, devService);
}

export * from './embeds.js';
export * from './commands/index.js';
export * from './huntUi.js';
