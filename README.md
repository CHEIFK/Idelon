# Idle RPG Game Engine

A clean, modular, UI-agnostic JavaScript game engine foundation built for headless idle RPG applications.

## Key Features

* **Headless & Event-Driven**: Zero external UI dependencies. Frontends subscribe to `node:events` for state changes.
* **Modular Directory Layout**: Isolated modules for activities (mining, woodcutting, fishing, hunting) and combat (damage, accuracy, loot, enemies, bosses).
* **Constants & Types**: No magic strings. Full JSDoc typedef annotations for IDE autocomplete.
* **Extensible Storage**: Database adapter ready for In-Memory, SQLite, or Cloudflare D1 integration.
* **Zero Runtime Dependencies**: Standard library native code (`node:test`, `node:events`, `node:module`).

## Project Structure

```
idle-game/
├── package.json              # ES Modules configuration
├── README.md                 # Setup & platform integration example
├── .gitignore                # Git exclusions
├── docs/
│   └── architecture.md       # Detailed architecture & module specs
├── src/
│   ├── index.js              # Primary engine export
│   ├── constants/            # Enum-like constant mappings (ACTIVITIES, EVENTS)
│   ├── events/               # Engine EventEmitter bus
│   ├── types/                # JSDoc type definitions
│   ├── data/
│   │   └── initialData.json  # Data-driven definitions
│   ├── database/
│   │   └── adapter.js        # Storage abstraction layer
│   ├── engine/               # Core engine sub-modules
│   │   ├── index.js          # Unified Engine container
│   │   ├── activities/       # Mining, Woodcutting, Fishing, Hunting
│   │   ├── combat/           # Damage, Accuracy, Loot, Enemies, Bosses
│   │   ├── player.js
│   │   ├── inventory.js
│   │   ├── skills.js
│   │   ├── equipment.js
│   │   ├── crafting.js
│   │   ├── economy.js
│   │   ├── quests.js
│   │   ├── world.js
│   │   ├── saveSystem.js
│   │   └── rewards.js
│   └── utils/
│       └── logger.js
└── tests/
    └── engine.test.js        # Node.js native test suite
```

## Quick Start

### Installation & Test

```bash
# Run unit tests (built-in Node test runner)
npm test
```

### Discord Bot / Web App Event Subscriptions

```javascript
import { createEngine, ACTIVITIES, EVENTS } from './src/index.js';

const engine = await createEngine();

// Subscribe to engine events
engine.events.on(EVENTS.PLAYER_LEVEL_UP, ({ playerId, newLevel }) => {
  console.log(`[Event] Player ${playerId} reached Level ${newLevel}!`);
});

// Example Discord Command Handler (/mine)
async function handleMineCommand(interaction) {
  let player = await engine.player.load(interaction.user.id) 
            || engine.player.create(interaction.user.id, interaction.user.username);

  // Start mining using constant instead of magic string
  const activity = engine.activities.mining.start(player, ACTIVITIES.MINING_IRON);
  await engine.saveSystem.savePlayer(player);

  return `Started mining iron!`;
}
```
