/**
 * SaveSystem module encapsulating persistence operations for game state.
 */
export class SaveSystemModule {
  constructor(database, playerModule) {
    this.db = database;
    this.playerModule = playerModule;
  }

  async savePlayer(player) {
    return await this.playerModule.save(player);
  }

  async loadPlayer(playerId) {
    return await this.playerModule.load(playerId);
  }
}
