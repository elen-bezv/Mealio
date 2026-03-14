/**
 * Unit conversion: volume & weight, density-based for common ingredients.
 * Standard output: solids → grams (g), liquids → milliliters (ml).
 */

export type VolumeUnit = "cup" | "cups" | "tbsp" | "tsp" | "ml" | "l" | "fl oz" | "liter" | "litre";
export type WeightUnit = "g" | "kg" | "oz" | "lb" | "gram" | "grams" | "kilogram" | "ounce" | "ounces" | "pound" | "pounds";

const VOLUME_TO_ML: Record<string, number> = {
  cup: 236.588,
  cups: 236.588,
  tbsp: 14.787,
  tablespoon: 14.787,
  tablespoons: 14.787,
  tsp: 4.929,
  teaspoon: 4.929,
  teaspoons: 4.929,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  liters: 1000,
  litres: 1000,
  "fl oz": 29.574,
  "fluid ounce": 29.574,
  "fluid ounces": 29.574,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

/** Density g/ml for common ingredients (approximate). */
export const DENSITY_G_PER_ML: Record<string, number> = {
  flour: 0.53,
  "all-purpose flour": 0.53,
  sugar: 0.85,
  "white sugar": 0.85,
  "granulated sugar": 0.85,
  "brown sugar": 0.82,
  butter: 0.91,
  milk: 1.03,
  "whole milk": 1.03,
  "olive oil": 0.92,
  "vegetable oil": 0.92,
  honey: 1.42,
  "cocoa powder": 0.35,
  "powdered sugar": 0.5,
  "confectioners sugar": 0.5,
  salt: 1.2,
  "baking soda": 0.87,
  "baking powder": 0.9,
  yogurt: 1.03,
  "greek yogurt": 1.06,
  cream: 1.0,
  "heavy cream": 1.0,
  water: 1.0,
};

const LIQUID_CATEGORIES = new Set([
  "milk", "cream", "yogurt", "oil", "water", "broth", "stock", "juice",
  "vinegar", "sauce", "honey", "syrup", "liquid",
]);
const LIQUID_INGREDIENTS = new Set(
  Object.keys(DENSITY_G_PER_ML).filter((k) =>
    ["milk", "olive oil", "vegetable oil", "honey", "water", "cream"].some((l) => k.includes(l))
  )
);

function isLiquid(name: string, category?: string): boolean {
  const n = name.toLowerCase();
  if (category && LIQUID_CATEGORIES.has(category.toLowerCase())) return true;
  for (const key of LIQUID_INGREDIENTS) {
    if (n.includes(key)) return true;
  }
  if (/\b(oil|milk|cream|water|broth|juice|sauce|vinegar|syrup)\b/.test(n)) return true;
  return false;
}

function normalizeUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined;
  const u = unit.toLowerCase().trim().replace(/\./g, "");
  if (VOLUME_TO_ML[u] !== undefined) return u;
  if (WEIGHT_TO_G[u] !== undefined) return u;
  if (u === "c" || u === "cup") return "cup";
  if (u === "t" || u === "tb" || u === "tbs") return "tbsp";
  if (u === "teaspoon") return "tsp";
  if (u === "milliliter" || u === "millilitre") return "ml";
  if (u === "liter" || u === "litre") return "l";
  if (u === "gram") return "g";
  if (u === "kilogram") return "kg";
  if (u === "ounce") return "oz";
  if (u === "pound") return "lb";
  return u;
}

export function parseQuantity(value: string | number): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const s = String(value).trim();
  if (!s) return 0;
  const num = parseFloat(s.replace(/[^\d./-]/g, ""));
  if (Number.isNaN(num)) return 0;
  if (s.includes("/")) {
    const [a, b] = s.split("/").map((x) => parseFloat(x.trim()));
    if (b && !Number.isNaN(a) && !Number.isNaN(b)) return a / b;
  }
  return num;
}

export interface NormalizedQuantity {
  value: number;
  unit: "g" | "ml";
  preferredUnit: "g" | "ml";
}

/**
 * Convert quantity + unit to preferred standard: solids → g, liquids → ml.
 * Uses density when converting volume ↔ weight for known ingredients.
 */
export function toPreferredUnit(
  quantity: string | number,
  unit: string | undefined,
  ingredientName?: string,
  category?: string
): NormalizedQuantity {
  const q = parseQuantity(quantity);
  const u = normalizeUnit(unit);

  if (!u) {
    const liquid = ingredientName ? isLiquid(ingredientName, category) : false;
    return { value: q, unit: liquid ? "ml" : "g", preferredUnit: liquid ? "ml" : "g" };
  }

  const volMl = VOLUME_TO_ML[u];
  const weightG = WEIGHT_TO_G[u];

  if (volMl !== undefined) {
    const ml = q * volMl;
    const liquid = ingredientName ? isLiquid(ingredientName, category) : true;
    if (liquid) {
      return { value: Math.round(ml * 10) / 10, unit: "ml", preferredUnit: "ml" };
    }
    const key = ingredientName?.toLowerCase().trim().replace(/\s+/g, " ");
    const density = key && DENSITY_G_PER_ML[key] ? DENSITY_G_PER_ML[key] : 0.6;
    const grams = ml * density;
    return { value: Math.round(grams * 10) / 10, unit: "g", preferredUnit: "g" };
  }

  if (weightG !== undefined) {
    const g = q * weightG;
    return { value: Math.round(g * 10) / 10, unit: "g", preferredUnit: "g" };
  }

  const liquid = ingredientName ? isLiquid(ingredientName, category) : false;
  return { value: q, unit: liquid ? "ml" : "g", preferredUnit: liquid ? "ml" : "g" };
}

/**
 * Format a normalized quantity for display (e.g. "500 g", "1.5 L").
 */
export function formatQuantity(value: number, preferredUnit: "g" | "ml"): string {
  if (preferredUnit === "ml" && value >= 1000) {
    const L = value / 1000;
    return L % 1 === 0 ? `${L} L` : `${L.toFixed(1)} L`;
  }
  if (preferredUnit === "g" && value >= 1000) {
    const kg = value / 1000;
    return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(1)} kg`;
  }
  const u = preferredUnit === "ml" ? "ml" : "g";
  return value % 1 === 0 ? `${value} ${u}` : `${value.toFixed(1)} ${u}`;
}

/**
 * Add two quantities that are already in the same preferred unit.
 */
export function addQuantities(
  value1: number,
  value2: number,
  preferredUnit: "g" | "ml"
): { value: number; formatted: string } {
  const value = Math.round((value1 + value2) * 10) / 10;
  return { value, formatted: formatQuantity(value, preferredUnit) };
}
