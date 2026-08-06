import { EVENTS } from '../constants/index.js';

const REGENERATION_INTERVAL_MS = 60 * 1000;

/**
 * Data-driven potion effects and temporary-buff state.
 *
 * Buffs are keyed by potionType, so consuming another potion of the same type
 * refreshes its duration rather than creating an unbounded list of effects.
 */
export class PotionModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  _ensureBuffMap(player) {
    if (!player.activeBuffs || typeof player.activeBuffs !== 'object' || Array.isArray(player.activeBuffs)) {
      player.activeBuffs = {};
    }
    return player.activeBuffs;
  }

  _getMaxHp(player) {
    const equippedStats = this.engine?.equipment?.getTotalStats
      ? this.engine.equipment.getTotalStats(player)
      : {};
    if (this.engine?.attributes?.calculateMaxHealth) {
      return this.engine.attributes.calculateMaxHealth(player, equippedStats);
    }
    return 100 + ((player.level || 1) * 10) + (equippedStats.health || 0);
  }

  /**
   * Apply elapsed regeneration ticks and remove expired buffs.
   * This is called at player interaction boundaries, which also makes the
   * result deterministic and safe for offline saves.
   */
  process(player, now = Date.now()) {
    if (!player || !Number.isFinite(now)) return false;

    const buffs = this._ensureBuffMap(player);
    let changed = false;
    const maxHp = this._getMaxHp(player);

    for (const [buffType, buff] of Object.entries(buffs)) {
      if (!buff || typeof buff !== 'object') {
        delete buffs[buffType];
        changed = true;
        continue;
      }

      const expiresAt = Number(buff.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
        delete buffs[buffType];
        changed = true;
        continue;
      }

      if (buff.stat === 'regeneration') {
        const amount = Number(buff.amount);
        let lastAppliedAt = Number(buff.lastAppliedAt);
        if (!Number.isFinite(lastAppliedAt) || lastAppliedAt <= 0) {
          lastAppliedAt = now;
          buff.lastAppliedAt = lastAppliedAt;
          changed = true;
        }

        const tickUntil = Math.min(now, expiresAt);
        const elapsedIntervals = Math.floor(Math.max(0, tickUntil - lastAppliedAt) / REGENERATION_INTERVAL_MS);
        if (Number.isFinite(amount) && amount > 0 && elapsedIntervals > 0) {
          const currentHp = typeof player.hp === 'number' && Number.isFinite(player.hp)
            ? Math.max(0, Math.min(player.hp, maxHp))
            : maxHp;
          const healAmount = Math.min(
            maxHp - currentHp,
            amount * elapsedIntervals
          );
          player.hp = Math.min(maxHp, currentHp + Math.max(0, healAmount));
          buff.lastAppliedAt = lastAppliedAt + elapsedIntervals * REGENERATION_INTERVAL_MS;
          changed = true;
        }
      }

      if (expiresAt <= now) {
        delete buffs[buffType];
        changed = true;
      }
    }

    return changed;
  }

  getModifier(player, stat, now = Date.now()) {
    if (!player || typeof stat !== 'string') return 0;
    this.process(player, now);

    return Object.values(this._ensureBuffMap(player)).reduce((total, buff) => {
      if (buff?.stat !== stat) return total;
      const amount = Number(buff.amount);
      return Number.isFinite(amount) && amount > 0 ? total + amount : total;
    }, 0);
  }

  getMiningSpeedMultiplier(player, now = Date.now()) {
    return 1 + Math.max(0, this.getModifier(player, 'haste', now)) / 100;
  }

  getExperienceMultiplier(player, now = Date.now()) {
    return 1 + Math.max(0, this.getModifier(player, 'experience', now)) / 100;
  }

  getActiveBuffs(player, now = Date.now()) {
    this.process(player, now);
    return Object.entries(this._ensureBuffMap(player))
      .map(([buffType, buff]) => ({
        buffType,
        ...buff,
        remainingMs: Math.max(0, Number(buff.expiresAt) - now)
      }))
      .filter(buff => buff.remainingMs > 0)
      .sort((a, b) => a.expiresAt - b.expiresAt);
  }

  use(player, potionId, contentLoader = this.engine?.content, inventoryModule = this.engine?.inventory, eventsBus = this.engine?.events, now = Date.now()) {
    if (!player || !contentLoader) return { success: false, reason: 'no_content_loader' };
    if (!potionId || typeof potionId !== 'string') return { success: false, reason: 'invalid_item' };

    this.process(player, now);
    const potion = contentLoader.getPotion(potionId);
    if (!potion) return { success: false, reason: 'not_a_potion', itemId: potionId };

    const hasItem = inventoryModule
      ? inventoryModule.hasItem(player, potion.id, 1)
      : Number.isSafeInteger(player.inventory?.[potion.id]) && player.inventory[potion.id] >= 1;
    if (!hasItem) return { success: false, reason: 'item_not_in_inventory', itemId: potion.id, potion };

    const maxHp = this._getMaxHp(player);
    const hpBefore = typeof player.hp === 'number' && Number.isFinite(player.hp)
      ? Math.max(0, Math.min(player.hp, maxHp))
      : maxHp;

    if (inventoryModule) {
      if (!inventoryModule.removeItem(player, potion.id, 1)) {
        return { success: false, reason: 'item_not_in_inventory', itemId: potion.id, potion };
      }
    } else {
      player.inventory[potion.id] -= 1;
      if (player.inventory[potion.id] <= 0) delete player.inventory[potion.id];
    }

    if (potion.effect.kind === 'full_heal') {
      player.hp = maxHp;
    } else if (potion.effect.kind === 'heal') {
      player.hp = Math.min(maxHp, hpBefore + potion.effect.amount);
    } else if (potion.effect.kind === 'buff') {
      const buffs = this._ensureBuffMap(player);
      const existing = buffs[potion.potionType];
      const currentAmount = existing && existing.expiresAt > now ? Number(existing.amount) : 0;
      const amount = Math.max(
        Number.isFinite(currentAmount) && currentAmount > 0 ? currentAmount : 0,
        potion.effect.amount
      );

      buffs[potion.potionType] = {
        potionType: potion.potionType,
        stat: potion.effect.stat,
        amount,
        durationMs: potion.effect.durationMs,
        expiresAt: now + potion.effect.durationMs,
        effectLabel: existing && currentAmount > potion.effect.amount
          ? (existing.effectLabel || potion.effectLabel)
          : potion.effectLabel,
        lastAppliedAt: potion.effect.stat === 'regeneration' ? now : undefined,
        sourcePotionId: existing && currentAmount > potion.effect.amount
          ? existing.sourcePotionId
          : potion.id
      };
      if (buffs[potion.potionType].lastAppliedAt === undefined) {
        delete buffs[potion.potionType].lastAppliedAt;
      }
    }

    if (eventsBus) {
      eventsBus.emit(EVENTS.POTION_USED || 'potion:used', {
        playerId: player.id,
        potionId: potion.id,
        potionType: potion.potionType,
        effect: potion.effect
      });
    }

    const activeBuff = potion.effect.kind === 'buff'
      ? this._ensureBuffMap(player)[potion.potionType]
      : null;

    return {
      success: true,
      potion,
      potionId: potion.id,
      hpBefore,
      hpAfter: player.hp,
      healed: Math.max(0, player.hp - hpBefore),
      buff: activeBuff ? { ...activeBuff, remainingMs: activeBuff.expiresAt - now } : null
    };
  }
}
