/**
 * Shared constants. Single source of truth for app locales and source types.
 */

export const APP_LOCALES = ["uk", "en", "he"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function isAppLocale(locale: string): locale is AppLocale {
  return APP_LOCALES.includes(locale as AppLocale);
}

/** Recipe source types (aligned with Recipe.sourceType and StructuredRecipe.sourceType). */
export const RECIPE_SOURCE_TYPES = [
  "manual",
  "website",
  "url",
  "instagram",
  "tiktok",
  "image",
  "pdf",
  "text",
] as const;
export type RecipeSourceType = (typeof RECIPE_SOURCE_TYPES)[number];
