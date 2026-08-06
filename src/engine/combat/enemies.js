export class EnemiesModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  getEnemy(enemyId) {
    const contentEnemy = this.engine?.content?.getEnemy(enemyId);
    if (contentEnemy) return contentEnemy;
    return { id: enemyId, name: 'Goblin', level: 1, hp: 20, maxHp: 20 };
  }
}
