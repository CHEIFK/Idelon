import process from 'node:process';
import { Client, GatewayIntentBits } from 'discord.js';
import { createGameInstance, createDevService, createDiscordBot } from '../index.js';
import { HUNT_COOLDOWN_MS, setHuntButtonDisabled } from './huntUi.js';

// Load .env variables
try {
  process.loadEnvFile('.env');
} catch (e) {
  console.warn('[WARN] Could not load .env file directly, relying on process.env.');
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('[ERROR] DISCORD_TOKEN is missing in environment variables.');
  process.exit(1);
}

export async function launchBot() {
  console.log('[INFO] Initializing Idelon Game Engine & Service Layer...');
  const gameService = await createGameInstance();
  
  // Authorize developer IDs
  const devUserIds = [process.env.DEV_USER_ID, '1465333484964024454'].filter(Boolean);
  const devService = createDevService(gameService, devUserIds, true);
  const botFrontend = createDiscordBot(gameService, devService);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  let shuttingDown = false;
  let inFlightCommands = 0;
  let resolveIdle = null;
  let shutdownPromise = null;
  const trackCommand = async (work) => {
    if (shuttingDown) return;
    inFlightCommands += 1;
    try {
      await work();
    } finally {
      inFlightCommands -= 1;
      if (inFlightCommands === 0) resolveIdle?.();
    }
  };
  const waitForIdle = () => inFlightCommands === 0
    ? Promise.resolve()
    : new Promise(resolve => { resolveIdle = resolve; });
  const shutdown = (signal) => {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = (async () => {
      console.log(`[INFO] Received ${signal}; shutting down Idelon gracefully...`);
      try {
        await waitForIdle();
        client.destroy();
        await gameService.shutdown?.();
      } catch (err) {
        console.error('[ERROR] Graceful shutdown failed:', err);
        process.exitCode = 1;
      }
    })();
    return shutdownPromise;
  };

  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

  client.once('clientReady', (c) => {
    console.log(`=======================================================`);
    console.log(`🎮 Idelon Discord Bot Online!`);
    console.log(`🤖 Bot User: ${c.user.tag} (ID: ${c.user.id})`);
    console.log(`🏰 Target Guild ID: ${guildId || 'Global'}`);
    console.log(`⚡ Command Prefixes Supported: Slash Commands (/command) AND Text Aliases (.command)`);
    console.log(`=======================================================`);
  });

  // Handle Slash Commands (/profile, /inv, /sell, etc.)
  client.on('interactionCreate', (interaction) => trackCommand(async () => {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      try {
        const result = await botFrontend.handleComponentInteraction(interaction);
        if (!result) {
          await interaction.deferUpdate().catch(() => {});
          return;
        }

        const cooldownMs = result.huntCooldownMs;
        const embeds = result?.embeds || (result?.embed ? [result.embed] : null);
        await interaction.update({
          ...(embeds ? { embeds } : { content: 'Command executed successfully.' }),
          components: result?.components || []
        });

        if (cooldownMs === HUNT_COOLDOWN_MS && interaction.message?.edit) {
          const enabledComponents = setHuntButtonDisabled(result.components, false);
          setTimeout(async () => {
            try {
              const message = typeof interaction.message.fetch === 'function'
                ? await interaction.message.fetch()
                : interaction.message;
              if (!message?.components?.some(row => row.components?.some(component => (
                component?.type === 2
                && (component.custom_id || component.customId)?.startsWith('hunt:fight:')
                && component.disabled === true
              )))) {
                return;
              }
              await message.edit({ components: enabledComponents });
            } catch (err) {
              console.error('[WARN] Could not re-enable Hunt button:', err);
            }
          }, cooldownMs);
        }
      } catch (err) {
        console.error('[ERROR] Hunt component execution failed:', err);
        await interaction.update({
          embeds: [{
            title: '❌ Hunt Error',
            description: err.message || 'An unexpected error occurred.',
            color: 0xE74C3C
          }],
          components: []
        }).catch(() => {});
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply().catch(() => {});

      const mockOptions = {
        getString: (name) => {
          if (name === 'subcommand') {
            return interaction.options.getSubcommand(false);
          }
          return interaction.options.getString(name);
        },
        getInteger: (name) => interaction.options.getInteger(name)
      };

      const customInteraction = {
        commandName: interaction.commandName,
        user: {
          id: interaction.user.id,
          username: interaction.user.username
        },
        options: mockOptions
      };

      const result = await botFrontend.handleCommandInteraction(customInteraction);
      const embeds = result?.embeds || (result?.embed ? [result.embed] : null);

      if (embeds) {
        await interaction.editReply({ embeds, components: result?.components || [] });
      } else {
        await interaction.editReply({ content: 'Command executed successfully.' });
      }
    } catch (err) {
      console.error(`[ERROR] Execution error on slash command /${interaction.commandName}:`, err);
      const errorEmbed = {
        title: '❌ Command Execution Error',
        description: err.message || 'An unexpected error occurred.',
        color: 0xE74C3C
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      }
    }
  }));

  // Handle Text Command Aliases (.profile, .inv, .sell, etc.)
  client.on('messageCreate', (message) => trackCommand(async () => {
    if (message.author.bot) return;

    const content = message.content.trim();
    if (!content.startsWith('.') && !content.startsWith('/')) return;

    try {
      const result = await botFrontend.handleTextMessage(content, {
        id: message.author.id,
        username: message.author.username
      });
      const embeds = result?.embeds || (result?.embed ? [result.embed] : null);

      if (embeds) {
        await message.reply({ embeds, components: result?.components || [] });
      }
    } catch (err) {
      console.error(`[ERROR] Execution error on text command alias '${content}':`, err);
    }
  }));

  await client.login(token);
  return client;
}

// Execute if run directly
if (process.argv[1]?.endsWith('botRunner.js')) {
  launchBot().catch(err => {
    console.error('[FATAL] Bot startup failed:', err);
    process.exit(1);
  });
}
