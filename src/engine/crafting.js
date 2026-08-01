import { EVENTS } from '../constants/index.js';

/**
 * Generic Data-Driven Crafting Module.
 * Reused for Smelting, Cooking, Smithing, Fletching, Alchemy, etc.
 */
export class CraftingModule {
  constructor(engine = null) {
    this.engine = engine;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  /**
   * Check if a player meets requirements and has materials to craft a recipe.
   */
  canCraft(
    player,
    recipeId,
    count = 1,
    contentLoader = this.engine?.content,
    inventoryModule = this.engine?.inventory,
    skillsModule = this.engine?.skills
  ) {
    if (!contentLoader) return { canCraft: false, reason: 'no_content_loader' };
    const recipe = contentLoader.getRecipe(recipeId);
    if (!recipe) return { canCraft: false, reason: 'recipe_not_found' };

    if (recipe.skillId && recipe.levelReq) {
      const playerLevel = skillsModule ? skillsModule.getLevel(player, recipe.skillId) : (player.skills[recipe.skillId]?.level || 1);
      if (playerLevel < recipe.levelReq) {
        return { canCraft: false, reason: 'level_too_low', requiredLevel: recipe.levelReq };
      }
    }

    if (!Array.isArray(recipe.ingredients)) return { canCraft: false, reason: 'invalid_ingredients' };

    for (const ing of recipe.ingredients) {
      const requiredQty = ing.amount * count;
      const hasMat = inventoryModule
        ? inventoryModule.hasItem(player, ing.itemId, requiredQty)
        : ((player.inventory[ing.itemId] || 0) >= requiredQty);

      if (!hasMat) {
        return { canCraft: false, reason: 'insufficient_materials', missingItem: ing.itemId, requiredQty };
      }
    }

    return { canCraft: true, recipe };
  }

  /**
   * Craft a recipe by consuming ingredients and granting crafted item + XP.
   */
  craft(
    player,
    recipeId,
    count = 1,
    contentLoader = this.engine?.content,
    inventoryModule = this.engine?.inventory,
    skillsModule = this.engine?.skills,
    eventsBus = this.engine?.events
  ) {
    const check = this.canCraft(player, recipeId, count, contentLoader, inventoryModule, skillsModule);
    if (!check.canCraft) {
      return { success: false, reason: check.reason, details: check };
    }

    const recipe = check.recipe;

    if (eventsBus) {
      eventsBus.emit(EVENTS.CRAFTING_STARTED, {
        playerId: player.id,
        recipeId: recipe.id,
        count
      });
    }

    // 1. Consume ingredients
    for (const ing of recipe.ingredients) {
      const consumeQty = ing.amount * count;
      if (inventoryModule) {
        inventoryModule.removeItem(player, ing.itemId, consumeQty);
      } else {
        player.inventory[ing.itemId] -= consumeQty;
        if (player.inventory[ing.itemId] <= 0) delete player.inventory[ing.itemId];
      }

      if (eventsBus) {
        eventsBus.emit(EVENTS.ITEM_REMOVED, {
          playerId: player.id,
          itemId: ing.itemId,
          amount: consumeQty
        });
      }
    }

    // 2. Grant result item
    const totalResultAmount = recipe.resultAmount * count;
    if (inventoryModule) {
      inventoryModule.addItem(player, recipe.resultItemId, totalResultAmount);
    } else {
      player.inventory[recipe.resultItemId] = (player.inventory[recipe.resultItemId] || 0) + totalResultAmount;
    }

    if (eventsBus) {
      eventsBus.emit(EVENTS.ITEM_ADDED, {
        playerId: player.id,
        itemId: recipe.resultItemId,
        amount: totalResultAmount
      });
    }

    // 3. Award XP if defined
    let xpGained = 0;
    const xpPerUnit = recipe.xpPerCraft || recipe.xp || 0;
    if (xpPerUnit > 0 && recipe.skillId && skillsModule) {
      xpGained = xpPerUnit * count;
      const xpRes = skillsModule.addXP(player, recipe.skillId, xpGained);

      if (eventsBus) {
        eventsBus.emit(EVENTS.XP_GAINED, {
          playerId: player.id,
          skillId: recipe.skillId,
          xpGained,
          totalXp: xpRes.xp,
          level: xpRes.level
        });

        if (xpRes.leveledUp) {
          eventsBus.emit(EVENTS.PLAYER_LEVEL_UP, {
            playerId: player.id,
            skillId: recipe.skillId,
            newLevel: xpRes.level
          });
        }
      }
    }

    if (eventsBus) {
      eventsBus.emit(EVENTS.CRAFTING_COMPLETED, {
        playerId: player.id,
        recipeId: recipe.id,
        count,
        resultItemId: recipe.resultItemId,
        resultAmount: totalResultAmount,
        xpGained
      });
    }

    return {
      success: true,
      recipeId: recipe.id,
      count,
      resultItemId: recipe.resultItemId,
      resultAmount: totalResultAmount,
      xpGained
    };
  }
}
