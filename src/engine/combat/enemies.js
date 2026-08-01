export class EnemiesModule {
  getEnemy(enemyId) {
    return { id: enemyId, name: 'Goblin', level: 1, hp: 20, maxHp: 20 };
  }
}
