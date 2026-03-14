/**
 * Recipe domain: creation from structured input, translations, tags.
 * Re-exports from services/recipe-creation and recipe-translation.
 */

export {
  createRecipeFromStructured,
  type CreateRecipeFromStructuredInput,
  type StructuredIngredientInput,
} from "@/services/recipe-creation";
export {
  detectRecipeLanguage,
  translateRecipe,
  buildTranslatedDisplayName,
  parseTranslatedDisplayName,
  type TargetLocale,
  type TranslatedRecipe,
} from "@/services/recipe-translation";
