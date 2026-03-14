/**
 * Ingredient domain: normalization, persistence, unit conversion.
 * Single entry point for all ingredient handling.
 */

export { getOrCreateIngredient } from "@/lib/ingredient-db";
export {
  normalizeIngredientName,
  getCanonicalKey,
  INGREDIENT_DICTIONARY,
  normalizeIngredientNameAI,
} from "@/lib/ingredient-normalize";
export {
  toPreferredUnit,
  parseQuantity,
  formatQuantity,
  addQuantities,
  type NormalizedQuantity,
} from "@/lib/unit-conversion";
