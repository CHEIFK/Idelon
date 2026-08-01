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
    const player = await this.gameService.getPlayer(targetPlayerId);
    this.gameService.engine.inventory.addItem(player, itemId, amount);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'give-item', { targetPlayerId, itemId, amount });
    return { success: true, targetPlayerId, itemId, amount };
  }

  async removeItem(adminId, targetPlayerId, itemId, amount = 1) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    const removed = this.gameService.engine.inventory.removeItem(player, itemId, amount);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'remove-item', { targetPlayerId, itemId, amount, removed });
    return { success: true, targetPlayerId, itemId, amount, removed };
  }

  async addXP(adminId, targetPlayerId, skillId, xpAmount) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    const result = this.gameService.engine.skills.addXP(player, skillId, xpAmount);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'add-xp', { targetPlayerId, skillId, xpAmount, newLevel: result.level });
    return { success: true, targetPlayerId, skillId, xpAmount, result };
  }

  async setLevel(adminId, targetPlayerId, newLevel) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    player.level = Math.max(1, newLevel);
    player.heroXp = getXpForLevel(player.level);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'set-level', { targetPlayerId, newLevel: player.level });
    return { success: true, targetPlayerId, level: player.level };
  }

  async giveCurrency(adminId, targetPlayerId, currency, amount) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    this.gameService.engine.economy.addCurrency(player, currency, amount);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'give-currency', { targetPlayerId, currency, amount });
    return { success: true, targetPlayerId, currency, amount };
  }

  async teleport(adminId, targetPlayerId, areaId) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    player.currentAreaId = areaId;
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'teleport', { targetPlayerId, areaId });
    return { success: true, targetPlayerId, areaId };
  }

  async completeQuest(adminId, targetPlayerId, questId) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    if (!player.quests[questId]) {
      player.quests[questId] = { id: questId, status: 'active', progress: 999, startedAt: Date.now() };
    }
    const questDef = this.gameService.engine.content.getQuest(questId);
    if (questDef && questDef.objective) {
      player.quests[questId].progress = questDef.objective.amount || 1;
    }
    const result = this.gameService.engine.quests.complete(player, questId);
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'complete-quest', { targetPlayerId, questId, result });
    return { success: true, targetPlayerId, questId, result };
  }

  async resetQuest(adminId, targetPlayerId, questId) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    delete player.quests[questId];
    await this.gameService.savePlayer(player);
    this.logAction(adminId, 'reset-quest', { targetPlayerId, questId });
    return { success: true, targetPlayerId, questId };
  }

  async spawnEnemy(adminId, targetPlayerId, enemyId) {
    this.validateDev(adminId);
    const result = await this.gameService.fight(targetPlayerId, enemyId);
    this.logAction(adminId, 'spawn-enemy', { targetPlayerId, enemyId, victory: result.victory });
    return result;
  }

  async forceActivityComplete(adminId, targetPlayerId) {
    this.validateDev(adminId);
    const player = await this.gameService.getPlayer(targetPlayerId);
    if (player.currentActivity) {
      // Offset start time back by 1 hour
      player.currentActivity.lastClaimed -= 3600000;
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
