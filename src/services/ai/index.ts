/**
 * Central AI service layer. All AI and ingredient/unit logic should be consumed
 * via this module (or the underlying lib/services they re-export) so the
 * codebase has a single, consistent entry point.
 *
 * - ingredientExtractor: extract ingredients from text/URL/image
 * - recipeParser: Pro parser (URL, Instagram, TikTok, image, PDF, text)
 * - translationService: detect language, translate recipe
 * - ingredientNormalizer: canonical names (dictionary + fuzzy)
 * - unitConversion: toPreferredUnit, formatQuantity, addQuantities
 * - productSelection: choose best product/quantity for agent
 */

export * from "./ingredientExtractor";
export * from "./recipeParser";
export * from "./translationService";
export * from "./ingredientNormalizer";
export * from "./unitConversion";
export * from "./productSelection";
