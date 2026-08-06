# Idle RPG Engine Architecture

## Overview
This engine is designed as a **completely UI-agnostic, headless game core**. It operates independently of platform-specific frameworks like Discord.js, React, or Express. Platform adapters consume engine instances by invoking standard JS method contracts or subscribing to Engine Events.

```
+-------------------------------------------------------------+
|               Platform / Frontend Layers                    |
|  (Discord Bot, Web App, Mobile App, Desktop App, REST API)  |
+-------------------------------------------------------------+
               |                                ^
       Invokes Engine APIs               Subscribes to Events
               v                                |
+-------------------------------------------------------------+
|                      Engine Container                       |
|               (src/engine/index.js Engine)                 |
+-------------------------------------------------------------+
  |        |         |        |         |        |         |
  v        v         v        v         v        v         v
Player Inventory Skills Activities  Combat Equipment Crafting
Economy          World  SaveSystem Rewards Events    Constants
+-------------------------------------------------------------+
                              |
                              v
                   Database Abstraction Layer
            (In-Memory / SQLite / Cloudflare D1)
```

## Sub-System Architecture

### 1. Modular Activities (`src/engine/activities/`)
Split into dedicated sub-files per activity type:
* `mining.js`: Mining logic and rock node handling.
* `woodcutting.js`: Woodcutting trees and logs.
* `fishing.js`: Fishing spots and catches.
* `hunting.js`: Trapping and game hunting.
* `index.js`: Main `ActivitiesModule` coordinator.

### 2. Modular Combat (`src/engine/combat/`)
* `damage.js`: Flat/Formulaic damage calculations.
* `accuracy.js`: Hit chance and evasion modifiers.
* `loot.js`: Combat drop generation.
* `enemies.js`: Regular mob instance generators.
* `bosses.js`: Boss encounter generators.
* `index.js`: Main `CombatModule` coordinator.

### 3. Constants (`src/constants/`)
Centralized string maps (e.g. `ACTIVITIES.MINING_IRON`, `EVENTS.PLAYER_LEVEL_UP`) to eliminate magic strings across the engine and frontends.

### 4. Engine Events (`src/events/`)
Uses native Node.js `EventEmitter` to broadcast events (`PLAYER_LEVEL_UP`, `ITEM_OBTAINED`, `PLAYER_DIED`) without coupling engine code to frontend handlers.

### 5. Type Definitions (`src/types/`)
JSDoc typedef schemas (`PlayerState`, `ActivityState`, `ItemDefinition`) for IDE autocompletion and static type safety.
