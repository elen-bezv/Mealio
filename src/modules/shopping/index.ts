/**
 * Shopping domain: merge, pantry adjustment, list creation.
 */

export {
  mergeIngredients,
  mergeRecipeIngredients,
  createShoppingListFromIngredients,
  type ItemForMerge,
} from "@/services/shopping-list";
export {
  subtractPantryFromMerged,
  applyPantryToMerged,
  getPantrySuggestions,
  type PantryItemInput,
} from "@/services/pantry-matching";
