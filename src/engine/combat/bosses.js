export class BossesModule {
  getBoss(bossId) {
    return { id: bossId, name: 'Dragon Lord', level: 50, hp: 5000, maxHp: 5000, isBoss: true };
  }
}
