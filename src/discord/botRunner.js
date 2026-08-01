import process from 'node:process';
import { Client, GatewayIntentBits } from 'discord.js';
import { createGameInstance, createDevService, createDiscordBot } from '../index.js';

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

  client.once('ready', (c) => {
    console.log(`=======================================================`);
    console.log(`🎮 Idelon Discord Bot Online!`);
    console.log(`🤖 Bot User: ${c.user.tag} (ID: ${c.user.id})`);
    console.log(`🏰 Target Guild ID: ${guildId || 'Global'}`);
    console.log(`⚡ Command Prefixes Supported: Slash Commands (/command) AND Text Aliases (.command)`);
    console.log(`=======================================================`);
  });

  // Handle Slash Commands (/profile, /inv, /sell, etc.)
  client.on('interactionCreate', async (interaction) => {
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
        await interaction.editReply({ embeds });
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
  });

  // Handle Text Command Aliases (.profile, .inv, .sell, etc.)
  client.on('messageCreate', async (message) => {
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
        await message.reply({ embeds });
      }
    } catch (err) {
      console.error(`[ERROR] Execution error on text command alias '${content}':`, err);
    }
  });

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
