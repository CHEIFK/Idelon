import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Data-Driven Content System & Validation Infrastructure.
 * Enforces Universal Item Schema standardization.
 */
export class ContentLoader {
  constructor() {
    this.categories = {
      items: new Map(),
      skills: new Map(),
      activities: new Map(),
      resources: new Map(),
      enemies: new Map(),
      equipment: new Map(),
      recipes: new Map(),
      npcs: new Map(),
      areas: new Map(),
      quests: new Map(),
      lootTables: new Map()
    };
    this.itemIcons = {};
    this.emojiMap = {};
  }

  /**
   * Load JSON content files and run startup validation.
   */
  loadAll() {
    for (const map of Object.values(this.categories)) {
      map.clear();
    }

    try {
      this.itemIcons = require('../../assets/item-icons.json');
    } catch {
      this.itemIcons = {};
    }

    try {
      this.emojiMap = require('../../assets/emoji-map.json');
    } catch {
      this.emojiMap = {};
    }

    this._loadCategory('items', require('../data/items.json'));
    this._loadCategory('skills', require('../data/skills.json'));
    this._loadCategory('activities', require('../data/activities.json'));
    this._loadCategory('resources', require('../data/resources.json'));
    this._loadCategory('enemies', require('../data/enemies.json'));
    this._loadCategory('equipment', require('../data/equipment.json'));
    this._loadCategory('recipes', require('../data/recipes.json'));
    this._loadCategory('npcs', require('../data/npcs.json'));
    this._loadCategory('areas', require('../data/areas.json'));
    this._loadCategory('quests', require('../data/quests.json'));
    this._loadCategory('lootTables', require('../data/lootTables.json'));

    try {
      this.heroXpTable = require('../data/heroXpTable.json');
    } catch {
      this.heroXpTable = [];
    }

    this.validate();
    return this;
  }

  _loadCategory(category, dataArray) {
    if (!Array.isArray(dataArray)) {
      throw new Error(`Content validation error: [${category}] file must export an array.`);
    }

    const targetMap = this.categories[category];
    for (const rawItem of dataArray) {
      if (!rawItem || typeof rawItem !== 'object') {
        throw new Error(`Content validation error: Invalid entry in [${category}].`);
      }
      if (!rawItem.id || typeof rawItem.id !== 'string') {
        throw new Error(`Content validation error: Entry in [${category}] missing valid 'id'.`);
      }
      if (!rawItem.name && category !== 'lootTables') {
        throw new Error(`Content validation error: Entry '${rawItem.id}' in [${category}] missing valid 'name'.`);
      }
      if (targetMap.has(rawItem.id)) {
        throw new Error(`Content validation error: Duplicate ID '${rawItem.id}' found in [${category}].`);
      }

      const item = { ...rawItem };
      if (category === 'items') {
        // Universal Item Schema normalization
        item.description = item.description || `Item definition for ${item.name}`;
        item.category = item.category || 'Resource';
        item.rarity = item.rarity || 'Common';
        item.tier = item.tier || 1;
        item.sellValue = item.sellValue !== undefined ? item.sellValue : (item.value || 5);
        item.value = item.sellValue; // Backward compatibility alias
        item.stackable = item.stackable !== undefined ? item.stackable : (item.type !== 'equipment');
        item.maxStack = item.maxStack || (item.stackable ? 999 : 1);
        item.obtainMethod = item.obtainMethod || 'gathering';
        item.requiredSkill = item.requiredSkill !== undefined ? item.requiredSkill : null;
        item.requiredLevel = item.requiredLevel || item.miningLevel || 1;

        // Custom icon & emoji resolution
        item.icon = this.itemIcons[item.id] || item.icon || 'icons/icon_0001.png';
        item.discordEmoji = this.emojiMap[item.id] || '';
      }

      targetMap.set(item.id, Object.freeze(item));
    }
  }

  /**
   * Run cross-reference integrity checks across datasets.
   */
  validate() {
    // Validate Activity -> Skill & LootTable references
    for (const act of this.categories.activities.values()) {
      if (!this.categories.skills.has(act.skillId)) {
        throw new Error(`Validation Error: Activity '${act.id}' references missing skillId '${act.skillId}'.`);
      }
      if (act.lootTableId && !this.categories.lootTables.has(act.lootTableId)) {
        throw new Error(`Validation Error: Activity '${act.id}' references missing lootTableId '${act.lootTableId}'.`);
      }
    }

    // Validate Enemy -> LootTable reference
    for (const enemy of this.categories.enemies.values()) {
      if (enemy.lootTableId && !this.categories.lootTables.has(enemy.lootTableId)) {
        throw new Error(`Validation Error: Enemy '${enemy.id}' references missing lootTableId '${enemy.lootTableId}'.`);
      }
    }

    // Validate Recipes -> Item references
    for (const recipe of this.categories.recipes.values()) {
      if (!this.categories.items.has(recipe.resultItemId)) {
        throw new Error(`Validation Error: Recipe '${recipe.id}' references missing resultItemId '${recipe.resultItemId}'.`);
      }
      for (const ing of recipe.ingredients) {
        if (!this.categories.items.has(ing.itemId)) {
          throw new Error(`Validation Error: Recipe '${recipe.id}' references missing ingredient itemId '${ing.itemId}'.`);
        }
      }
    }

    // Validate LootTable -> Item references
    for (const lt of this.categories.lootTables.values()) {
      for (const entry of lt.entries) {
        if (!this.categories.items.has(entry.itemId)) {
          throw new Error(`Validation Error: LootTable '${lt.id}' references missing itemId '${entry.itemId}'.`);
        }
      }
    }

    // Validate Mining Activity -> Owning Area Resolution (1-to-1)
    for (const act of this.categories.activities.values()) {
      if (act.skillId !== 'mining') continue;

      const matchingAreas = [];
      if (act.areaId) {
        if (this.categories.areas.has(act.areaId)) {
          matchingAreas.push(act.areaId);
        }
      } else {
        for (const area of this.categories.areas.values()) {
          if (!Array.isArray(area.resourceIds)) continue;
          for (const resId of area.resourceIds) {
            const resNode = this.categories.resources.get(resId);
            if (!resNode) continue;
            if (resId === act.id || resNode.id === act.id || act.id.includes(resId.replace('_node', ''))) {
              if (!matchingAreas.includes(area.id)) {
                matchingAreas.push(area.id);
              }
            }
          }
        }
      }

      if (matchingAreas.length === 0) {
        throw new Error(`Validation Error: Mining activity '${act.id}' could not resolve to any owning area.`);
      }
      if (matchingAreas.length > 1) {
        throw new Error(`Validation Error: Mining activity '${act.id}' matched multiple owning areas: [${matchingAreas.join(', ')}]. Explicitly specify 'areaId'.`);
      }
    }
  }

  /**
   * Resolve user input string to canonical item ID.
   * Supports: "iron_ore", "iron ore", "Iron Ore", "iron", etc.
   */
  resolveItemId(input, contextInventory = null) {
    if (!input || typeof input !== 'string') return null;
    const rawClean = input.trim().replace(/^["']|["']$/g, '');
    const normalized = rawClean.toLowerCase().replace(/[\s\-_]+/g, '_');

    // 1. Direct match on normalized ID
    if (this.getItem(normalized)) {
      return normalized;
    }

    const allItems = this.getAll('items');

    // 2. Direct match on item.id
    for (const item of allItems) {
      if (item.id === rawClean || item.id === normalized) return item.id;
    }

    // 3. Match on item.name (case-insensitive)
    for (const item of allItems) {
      if (item.name && item.name.toLowerCase() === rawClean.toLowerCase()) return item.id;
    }

    // 4. Match on item.name with spaces/hyphens converted to underscores
    for (const item of allItems) {
      if (item.name && item.name.toLowerCase().replace(/[\s\-_]+/g, '_') === normalized) return item.id;
    }

    // 5. Partial prefix match on item.id or item.name
    let matches = allItems.filter(item => 
      item.id.toLowerCase().startsWith(normalized) || 
      (item.name && item.name.toLowerCase().startsWith(rawClean.toLowerCase()))
    );

    if (matches.length > 1 && contextInventory && typeof contextInventory === 'object') {
      const ownedMatches = matches.filter(m => (contextInventory[m.id] || 0) > 0);
      if (ownedMatches.length > 0) {
        matches = ownedMatches;
      }
    }

    if (matches.length >= 1) {
      return matches[0].id;
    }

    return normalized;
  }

  getItem(id) { return this.categories.items.get(id) || null; }
  getSkill(id) { return this.categories.skills.get(id) || null; }
  getActivity(id) { return this.categories.activities.get(id) || null; }
  getResource(id) { return this.categories.resources.get(id) || null; }
  getEnemy(id) { return this.categories.enemies.get(id) || null; }
  getEquipment(id) { return this.categories.equipment.get(id) || null; }
  getRecipe(id) { return this.categories.recipes.get(id) || null; }
  getNpc(id) { return this.categories.npcs.get(id) || null; }
  getArea(id) { return this.categories.areas.get(id) || null; }
  getQuest(id) { return this.categories.quests.get(id) || null; }
  getLootTable(id) { return this.categories.lootTables.get(id) || null; }
  getHeroXpTable() { return this.heroXpTable || []; }

  getAll(category) {
    const map = this.categories[category];
    return map ? Array.from(map.values()) : [];
  }
}
