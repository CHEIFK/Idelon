import { EVENTS, COMBAT_XP_MIN, COMBAT_XP_MAX } from '../../constants/index.js';
import { calculateDamage } from './damage.js';
import { calculateHitChance, calculateCritChance } from './accuracy.js';
import { generateCombatLoot } from './loot.js';
import { EnemiesModule } from './enemies.js';
import { BossesModule } from './bosses.js';

export class CombatModule {
  constructor(engine = null) {
    this.engine = engine;
    this.enemies = new EnemiesModule(engine);
    this.bosses = new BossesModule(engine);
    this.lastResult = null;
  }

  setEngine(engine) {
    this.engine = engine;
    this.enemies.setEngine(engine);
    this.bosses.setEngine(engine);
  }

  start(player, enemyId) {
    return this.simulate(player, enemyId);
  }

  attack(attacker, defender) {
    const enemyId = typeof defender === 'string' ? defender : (defender?.id || 'goblin');
    return this.simulate(attacker, enemyId);
  }

  simulate(
    player,
    enemyId,
    contentLoader = this.engine?.content,
    equipmentModule = this.engine?.equipment,
    inventoryModule = this.engine?.inventory,
    skillsModule = this.engine?.skills,
    economyModule = this.engine?.economy,
    eventsBus = this.engine?.events
  ) {
    if (!contentLoader) throw new Error('Content loader required for combat simulation.');
    const enemyDef = contentLoader.getEnemy(enemyId);
    if (!enemyDef) throw new Error(`Enemy '${enemyId}' not found in content loader.`);

    // Combine player base stats with equipped gear bonuses
    const equippedStats = equipmentModule ? equipmentModule.getTotalStats(player) : {};
    const potionModifiers = this.engine?.potions;
    potionModifiers?.process?.(player);
    const potionModifier = stat => potionModifiers?.getModifier?.(player, stat) || 0;
    const playerAttributes = this.engine?.attributes ? this.engine.attributes.getAttributes(player) : (player.attributes || {});
    const maxHp = this.engine?.attributes
      ? this.engine.attributes.calculateMaxHealth(player, equippedStats)
      : 100 + (player.level * 10) + (equippedStats.health || 0);
    const playerStats = {
      attack: 10 + (player.level * 2) + (equippedStats.attack || 0) + potionModifier('attack'),
      strength: (playerAttributes.strength || 1) - 1 + potionModifier('strength'), // -1 because base level 1 gives 0 bonus
      defense: (equippedStats.defense || 0) + potionModifier('defense'),
      maxHp,
      hp: typeof player.hp === 'number' && Number.isFinite(player.hp) ? Math.min(Math.max(0, player.hp), maxHp) : maxHp,
      criticalChance: equippedStats.criticalChance || 0.05,
      accuracy: (equippedStats.accuracy || 0) + potionModifier('accuracy')
    };

    // Fresh enemy instance for every fight (respawn support)
    const enemyState = {
      id: enemyDef.id,
      name: enemyDef.name,
      level: enemyDef.level || 1,
      hp: enemyDef.hp || 30,
      maxHp: enemyDef.hp || 30,
      attack: enemyDef.attack || 5,
      defense: enemyDef.defense || 0
    };

    if (eventsBus) {
      eventsBus.emit(EVENTS.COMBAT_STARTED, {
        playerId: player.id,
        enemyId: enemyState.id,
        playerStats,
        enemyStats: enemyState
      });
    }

    const turns = [];
    let turnCount = 0;

    // Deterministic turn loop
    while (playerStats.hp > 0 && enemyState.hp > 0 && turnCount < 100) {
      turnCount++;

      // 1. Player Turn
      const pIsHit = Math.random() <= calculateHitChance(playerStats, enemyState);
      const pIsCrit = pIsHit && (Math.random() <= calculateCritChance(playerStats));
      const pDmg = pIsHit ? calculateDamage(playerStats, enemyState, pIsCrit) : 0;
      enemyState.hp = Math.max(0, enemyState.hp - pDmg);

      const pTurnRecord = {
        turn: turnCount,
        attacker: 'player',
        isHit: pIsHit,
        isCrit: pIsCrit,
        damageDealt: pDmg,
        targetHpRemaining: enemyState.hp
      };
      turns.push(pTurnRecord);

      if (eventsBus) {
        eventsBus.emit(EVENTS.COMBAT_TURN, pTurnRecord);
      }

      if (enemyState.hp <= 0) break;

      // 2. Enemy Turn
      const eIsHit = Math.random() <= calculateHitChance(enemyState, playerStats);
      const eIsCrit = eIsHit && (Math.random() <= calculateCritChance(enemyState));
      const eDmg = eIsHit ? calculateDamage(enemyState, playerStats, eIsCrit) : 0;
      playerStats.hp = Math.max(0, playerStats.hp - eDmg);

      const eTurnRecord = {
        turn: turnCount,
        attacker: 'enemy',
        isHit: eIsHit,
        isCrit: eIsCrit,
        damageDealt: eDmg,
        targetHpRemaining: playerStats.hp
      };
      turns.push(eTurnRecord);

      if (eventsBus) {
        eventsBus.emit(EVENTS.COMBAT_TURN, eTurnRecord);
      }
    }

    const victory = enemyState.hp <= 0 && playerStats.hp > 0;
    const playerDied = playerStats.hp <= 0;
    const loot = [];
    const currenciesGained = {};
    let xpGained = 0;
    let durabilityChanges = { broken: [], reduced: [], replacements: [] };
    let equipmentChanges = { equipped: [] };

    if (victory && equipmentModule) {
      const durabilityLoss = Math.max(1, Math.floor((enemyState.attack || 5) / 10));
      if (typeof equipmentModule.reduceDurability === 'function') {
        durabilityChanges = equipmentModule.reduceDurability(player, durabilityLoss, contentLoader, inventoryModule, eventsBus);
      }
    }

    if (victory) {
      // Award random Combat XP between COMBAT_XP_MIN and COMBAT_XP_MAX (inclusive)
      const minXp = typeof COMBAT_XP_MIN === 'number' ? COMBAT_XP_MIN : 50;
      const maxXp = typeof COMBAT_XP_MAX === 'number' ? COMBAT_XP_MAX : 150;
      xpGained = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;
      if (skillsModule) {
        const xpRes = skillsModule.addXP(player, 'combat', xpGained);
        xpGained = xpRes.xpGained ?? xpGained;
        if (eventsBus) {
          eventsBus.emit(EVENTS.XP_GAINED, {
            playerId: player.id,
            skillId: 'combat',
            xpGained,
            totalXp: xpRes.xp,
            level: xpRes.level
          });
          if (xpRes.leveledUp) {
            eventsBus.emit(EVENTS.PLAYER_LEVEL_UP, {
              playerId: player.id,
              skillId: 'combat',
              newLevel: xpRes.level
            });
          }
        }
      }

      // Roll Loot Table
      const equipmentLuck = typeof equippedStats.luck === 'number' ? equippedStats.luck : 0;
      const potionLuck = potionModifier('luck');
      const droppedLoot = generateCombatLoot(enemyDef, contentLoader, equipmentLuck + potionLuck);
      for (const drop of droppedLoot) {
        if (inventoryModule) {
          inventoryModule.addItem(player, drop.itemId, drop.amount);
        }
        loot.push(drop);
        if (eventsBus) {
          eventsBus.emit(EVENTS.ITEM_ADDED, {
            playerId: player.id,
            itemId: drop.itemId,
            amount: drop.amount
          });
        }
      }

      // Award Currency (20x scaled rewards with weighted randomness)
      if (enemyDef.currencyRewards && economyModule) {
        for (const [curr, amt] of Object.entries(enemyDef.currencyRewards)) {
          const baseAmt = amt * 20;
          const minAmt = Math.max(1, Math.round(baseAmt * 0.75));
          const maxAmt = Math.max(minAmt, Math.round(baseAmt * 1.25));
          const baseAmount = Math.floor(Math.random() * (maxAmt - minAmt + 1)) + minAmt;
          const totalAmt = curr === 'gold'
            ? Math.max(1, Math.round(baseAmount * (1 + potionModifier('wealth') / 100)))
            : baseAmount;

          economyModule.addCurrency(player, curr, totalAmt);
          currenciesGained[curr] = totalAmt;
        }
      }

      if (victory && equipmentModule && typeof equipmentModule.autoEquipBest === 'function') {
        equipmentChanges = equipmentModule.autoEquipBest(player, contentLoader, inventoryModule, eventsBus);
      }

      if (eventsBus) {
        eventsBus.emit(EVENTS.COMBAT_VICTORY, {
          playerId: player.id,
          enemyId: enemyDef.id,
          turns: turnCount,
          xpGained,
          loot,
          currenciesGained
        });

        if (loot.length > 0) {
          eventsBus.emit(EVENTS.COMBAT_LOOT_RECEIVED, {
            playerId: player.id,
            loot
          });
        }

        if (enemyDef.isBoss === true) {
          eventsBus.emit(EVENTS.BOSS_KILLED, {
            playerId: player.id,
            bossId: enemyDef.id,
            turns: turnCount,
            xpGained,
            loot,
            currenciesGained
          });
        }
      }
    } else {
      if (eventsBus) {
        eventsBus.emit(EVENTS.COMBAT_DEFEAT, {
          playerId: player.id,
          enemyId: enemyDef.id,
          turns: turnCount
        });
      }
    }

    const result = {
      success: true,
      victory,
      playerDied,
      attackerId: player.id || 'entity',
      defenderId: enemyState.id || 'entity',
      damageDealt: turns
        .filter(turn => turn.attacker === 'player')
        .reduce((total, turn) => total + turn.damageDealt, 0),
      turnsCount: turnCount,
      turns,
      xpGained,
      loot,
      currenciesGained,
      durabilityChanges,
      equipmentChanges,
      playerFinalHp: playerStats.hp,
      maxHp: playerStats.maxHp,
      enemyFinalHp: enemyState.hp
    };

    result.isBoss = enemyDef.isBoss === true;

    player.hp = playerStats.hp;
    this.lastResult = result;
    return result;
  }

  getResult() {
    return this.lastResult;
  }
}

export { calculateDamage, calculateHitChance, calculateCritChance, generateCombatLoot, EnemiesModule, BossesModule };
