// Shared types for API and UI

export type RecipeCategory =
  | "BREAKFAST"
  | "LUNCH"
  | "DINNER"
  | "DESSERT"
  | "SNACK"
  | "OTHER";

export interface ExtractedIngredient {
  name: string;
  quantity: string;
  unit?: string;
  category?: string;
  rawLine?: string;
}

/** Pro parser: ingredient with optional preparation note (e.g. "chopped", "diced") */
export interface StructuredIngredient {
  name: string;
  quantity: string;
  unit?: string;
  category?: string;
  preparation?: string;
  rawLine?: string;
}

export interface ParseRecipeResult {
  title: string;
  description?: string;
  ingredients: ExtractedIngredient[];
}

/** AI Recipe Parser Pro: standardized structured output */
export interface StructuredRecipe {
  title: string;
  description?: string;
  ingredients: StructuredIngredient[];
  instructions: string[];
  sourceUrl?: string;
  sourceType?: "url" | "instagram" | "tiktok" | "image" | "pdf" | "text";
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  needsReview?: boolean;
}

/** Parser warnings for incomplete/uncertain data; AI suggestions for user to confirm */
export interface ParserWarning {
  missingQuantities?: string[];
  missingUnits?: string[];
  missingSteps?: boolean;
  suggested?: { ingredientIndex: number; ingredientName: string; suggestion: string }[];
}

export interface ParseRecipeProResult {
  recipe: StructuredRecipe;
  warnings?: ParserWarning;
  /** If set, a recipe with similar title already exists (for duplicate handling) */
  duplicateRecipeId?: string;
  duplicateRecipeTitle?: string;
}

export interface MergedShoppingItem {
  name: string;
  quantity: string;
  unit?: string;
  category?: string;
  mergedQuantity?: string;
  ingredientIds: string[];
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "dessert";

export const MEAL_SLOTS: MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "dessert",
];

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// MCP-style tool definitions for grocery agent
export interface SearchProductResult {
  productId: string;
  name: string;
  price?: string;
  matchScore: number;
}

export interface CartStatus {
  itemCount: number;
  items: { name: string; quantity: number }[];
}
