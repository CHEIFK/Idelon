import process from 'node:process';
import { commandRegistry } from '../src/discord/commands/index.js';

// Load .env variables
try {
  process.loadEnvFile('.env');
} catch (e) {
  console.warn('[WARN] Could not load .env file directly, relying on process.env.');
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('[ERROR] Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in environment variables.');
  process.exit(1);
}

// Convert Application Command Options types to Discord API numbers
const OPTION_TYPES = {
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6
};

function formatCommandData(cmd) {
  const data = {
    name: cmd.name,
    description: cmd.description || 'Idelon Game Command'
  };

  if (cmd.name === 'dev') {
    // Special subcommand formatting for /dev
    data.options = [
      {
        name: 'give-item',
        description: 'Give an item to player',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'item', description: 'Item ID', type: OPTION_TYPES.STRING, required: true },
          { name: 'amount', description: 'Amount', type: OPTION_TYPES.INTEGER, required: false },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'remove-item',
        description: 'Remove an item from player',
        type: 1,
        options: [
          { name: 'item', description: 'Item ID', type: OPTION_TYPES.STRING, required: true },
          { name: 'amount', description: 'Amount', type: OPTION_TYPES.INTEGER, required: false },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'add-xp',
        description: 'Add skill XP',
        type: 1,
        options: [
          { name: 'skill', description: 'Skill ID', type: OPTION_TYPES.STRING, required: true },
          { name: 'amount', description: 'XP Amount', type: OPTION_TYPES.INTEGER, required: true },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'set-level',
        description: 'Set player level',
        type: 1,
        options: [
          { name: 'amount', description: 'Level', type: OPTION_TYPES.INTEGER, required: true },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'give-currency',
        description: 'Give currency',
        type: 1,
        options: [
          { name: 'currency', description: 'Currency (gold/gems)', type: OPTION_TYPES.STRING, required: true },
          { name: 'amount', description: 'Amount', type: OPTION_TYPES.INTEGER, required: true },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'teleport',
        description: 'Teleport player to area',
        type: 1,
        options: [
          { name: 'area', description: 'Area ID', type: OPTION_TYPES.STRING, required: true },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'complete-quest',
        description: 'Complete quest for player',
        type: 1,
        options: [
          { name: 'quest', description: 'Quest ID', type: OPTION_TYPES.STRING, required: true },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'reset-quest',
        description: 'Reset quest for player',
        type: 1,
        options: [
          { name: 'quest', description: 'Quest ID', type: OPTION_TYPES.STRING, required: true },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'spawn-enemy',
        description: 'Spawn fight against enemy',
        type: 1,
        options: [
          { name: 'enemy', description: 'Enemy ID', type: OPTION_TYPES.STRING, required: true },
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'force-activity-complete',
        description: 'Force activity completion',
        type: 1,
        options: [
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      },
      {
        name: 'reload-content',
        description: 'Reload game content definitions',
        type: 1
      },
      {
        name: 'player-info',
        description: 'Get target player info JSON',
        type: 1,
        options: [
          { name: 'target_user', description: 'Target Player ID', type: OPTION_TYPES.STRING, required: false }
        ]
      }
    ];
  } else if (Array.isArray(cmd.options)) {
    data.options = cmd.options.map(opt => ({
      name: opt.name,
      description: opt.name,
      type: OPTION_TYPES[opt.type] || 3,
      required: !!opt.required
    }));
  }

  return data;
}

export async function registerGuildCommands() {
  const commandsData = commandRegistry.getAllCommands().map(formatCommandData);
  console.log(`[INFO] Preparing to register ${commandsData.length} slash commands to Guild ID: ${guildId}...`);

  const url = `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commandsData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord API Error [${response.status}]: ${errorText}`);
  }

  const registered = await response.json();
  console.log(`[SUCCESS] Successfully registered ${registered.length} slash commands to Guild ID ${guildId}!`);
  return registered;
}

// Execute registration if run directly
if (process.argv[1]?.endsWith('registerCommands.js')) {
  registerGuildCommands()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[ERROR] Failed to register commands:', err);
      process.exit(1);
    });
}
