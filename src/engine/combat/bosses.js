/**
 * Data-backed boss lookup. Bosses are ordinary enemy definitions marked with
 * `isBoss`, so combat balance and loot remain in the content datasets rather
 * than diverging into a hardcoded second definition.
 */
export class BossesModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  getBoss(bossId, contentLoader = this.engine?.content) {
    const enemy = contentLoader?.getEnemy(bossId);
    if (!enemy || enemy.isBoss !== true) return null;
    return {
      ...enemy,
      maxHp: enemy.maxHp ?? enemy.hp,
      isBoss: true
    };
  }
}
