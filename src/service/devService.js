import { logger } from '../utils/logger.js';
import { getXpForLevel } from '../engine/progression.js';
import { clearSectorResourceCache } from '../utils/sectorMap.js';

/**
 * Developer and Admin Toolkit Service Layer.
 * Restricts admin operations to configured developer IDs and logs every action.
 */
export class DevService {
  constructor(gameService, devUserIds = [], enabled = true) {
    this.gameService = gameService;
    this.devUserIds = new Set(devUserIds);
    this.enabled = enabled;
  }

  isDev(userId) {
    return this.enabled && this.devUserIds.has(userId);
  }

  validateDev(adminUserId) {
    if (!this.enabled) {
      throw new Error('Developer toolkit is disabled in this environment.');
    }
    if (!this.devUserIds.has(adminUserId)) {
      throw new Error(`Permission Denied: User '${adminUserId}' is not an authorized developer.`);
    }
  }

  logAction(adminId, action, details) {
    logger.info(`[ADMIN AUDIT LOG] Admin: '${adminId}' | Action: '${action}' | Details: ${JSON.stringify(details)}`);
  }

  async giveItem(adminId, targetPlayerId, itemId, amount = 1) {
    this.validateDev(adminId);
    if (!itemId || typeof itemId !== 'string') {
      return { success: false, reason: 'invalid_item_id', message: 'Item ID is required.' };
    }
    if (!this.gameService.engine.content.getItem(itemId)) {
      return { success: false, reason: 'unknown_item', message: `Item '${itemId}' does not exist.` };
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return { success: false, reason: 'invalid_quantity', message: 'Amount must be a positive integer.' };
    }
    const player = await this.gameService.getPlayer(targetPlayerId);
    this.gameService.engine.inventory.addItem(player, itemId, amount);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'give-item', { targetPlayerId, itemId, amount });
    return { success: true, targetPlayerId, itemId, amount };
  }

  async removeItem(adminId, targetPlayerId, itemId, amount = 1) {
    this.validateDev(adminId);
    if (!itemId || typeof itemId !== 'string') {
      return { success: false, reason: 'invalid_item_id', message: 'Item ID is required.' };
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return { success: false, reason: 'invalid_quantity', message: 'Amount must be a positive integer.' };
    }
    const player = await this.gameService.getPlayer(targetPlayerId);
    const removed = this.gameService.engine.inventory.removeItem(player, itemId, amount);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'remove-item', { targetPlayerId, itemId, amount, removed });
    return { success: removed, targetPlayerId, itemId, amount, removed, reason: removed ? undefined : 'insufficient_items' };
  }

  async addXP(adminId, targetPlayerId, skillId, xpAmount) {
    this.validateDev(adminId);
    if (!skillId || !this.gameService.engine.content.getSkill(skillId)) {
      return { success: false, reason: 'unknown_skill', message: `Skill '${skillId}' does not exist.` };
    }
    if (!Number.isInteger(xpAmount) || xpAmount <= 0) {
      return { success: false, reason: 'invalid_xp', message: 'XP amount must be a positive integer.' };
    }
    const player = await this.gameService.getPlayer(targetPlayerId);
    const result = this.gameService.engine.skills.addXP(player, skillId, xpAmount);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'add-xp', { targetPlayerId, skillId, xpAmount, newLevel: result.level });
    return { success: true, targetPlayerId, skillId, xpAmount, result };
  }

  async setLevel(adminId, targetPlayerId, newLevel) {
    this.validateDev(adminId);
    if (!Number.isInteger(newLevel) || newLevel < 1) {
      return { success: false, reason: 'invalid_level', message: 'Level must be a positive integer.' };
    }
    const player = await this.gameService.getPlayer(targetPlayerId);
    player.level = Math.max(1, newLevel);
    player.heroXp = getXpForLevel(player.level);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'set-level', { targetPlayerId, newLevel: player.level });
    return { success: true, targetPlayerId, level: player.level };
  }

  async giveCurrency(adminId, targetPlayerId, currency, amount) {
    this.validateDev(adminId);
    if (!['gold', 'sterlings'].includes(currency)) {
      return { success: false, reason: 'unknown_currency', message: `Currency '${currency}' is not supported.` };
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
      return { success: false, reason: 'invalid_amount', message: 'Amount must be positive.' };
    }
    const player = await this.gameService.getPlayer(targetPlayerId);
    const before = player.currencies[currency] || 0;
    const after = this.gameService.engine.economy.addCurrency(player, currency, amount);
    if (after !== before + amount) {
      return { success: false, reason: 'currency_limit', message: 'Currency balance cannot hold that amount.' };
    }
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'give-currency', { targetPlayerId, currency, amount });
    return { success: true, targetPlayerId, currency, amount };
  }

  async teleport(adminId, targetPlayerId, areaId) {
    this.validateDev(adminId);
    if (!this.gameService.engine.content.getArea(areaId)) {
      return { success: false, reason: 'unknown_area', message: `Area '${areaId}' does not exist.` };
    }
    const player = await this.gameService.getPlayer(targetPlayerId);
    player.currentAreaId = areaId;
    if (!Array.isArray(player.visitedAreas)) player.visitedAreas = ['starter_village'];
    if (!player.visitedAreas.includes(areaId)) player.visitedAreas.push(areaId);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'teleport', { targetPlayerId, areaId });
    return { success: true, targetPlayerId, areaId };
  }

  async spawnEnemy(adminId, targetPlayerId, enemyId) {
    this.validateDev(adminId);
    if (!enemyId || typeof enemyId !== 'string' || !this.gameService.engine.content.getEnemy(enemyId)) {
      return { success: false, reason: 'unknown_enemy', message: `Enemy '${enemyId || ''}' does not exist.` };
    }
    const result = await this.gameService.hunt(targetPlayerId, enemyId);
    this.logAction(adminId, 'spawn-enemy', { targetPlayerId, enemyId, victory: result.victory });
    return result;
  }

  async forceActivityComplete(adminId, targetPlayerId) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    if (player.currentActivity) {
      // Offset start time back by 1 hour
      player.currentActivity.lastClaimed -= 3600000;
      await this.gameService.savePlayer(player);
    }
    const result = await this.gameService.claimActivity(targetPlayerId);
    this.logAction(adminId, 'force-activity-complete', { targetPlayerId, result });
    return result;
  }

  async reloadContent(adminId) {
    this.validateDev(adminId);
    this.gameService.engine.content.loadAll();
    clearSectorResourceCache();
    this.logAction(adminId, 'reload-content', { time: Date.now() });
    return { success: true, reloaded: true };
  }

  async getPlayerInfo(adminId, targetPlayerId) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    const profile = await this.gameService.getProfile(targetPlayerId);
    this.logAction(adminId, 'player-info', { targetPlayerId });
    return {
      player,
      profile
    };
  }
}
