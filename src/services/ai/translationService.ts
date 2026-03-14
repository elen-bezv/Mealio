/**
 * Central AI: recipe translation and language detection.
 * Re-exports from services/recipe-translation.
 */

export {
  detectRecipeLanguage,
  translateRecipe,
  buildTranslatedDisplayName,
  parseTranslatedDisplayName,
  SUPPORTED_SOURCE_LANGS,
  TARGET_LOCALES,
  type TargetLocale,
  type TranslatedRecipe,
} from "@/services/recipe-translation";
