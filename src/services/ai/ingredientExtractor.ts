/**
 * Central AI: ingredient extraction from text, URL, or image.
 * Re-exports from services/ingredient-extraction so all AI flows use this layer.
 */

export {
  extractIngredientsFromText,
  extractIngredientsFromImage,
} from "@/services/ingredient-extraction";
