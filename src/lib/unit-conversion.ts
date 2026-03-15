/**
 * Unit conversion: volume, weight, and count-based units.
 * Weight → g/kg; volume → ml/L; count → preserve pieces, cloves, bulbs, ribs, etc.
 * Do not force count-based ingredients into grams.
 */

export type VolumeUnit = "cup" | "cups" | "tbsp" | "tsp" | "ml" | "l" | "fl oz" | "liter" | "litre";
export type WeightUnit = "g" | "kg" | "oz" | "lb" | "gram" | "grams" | "kilogram" | "ounce" | "ounces" | "pound" | "pounds";

export type UnitType = "weight" | "volume" | "count" | "unknown";

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

/** Count units: raw form → normalized display form (for merging and display). */
const COUNT_UNIT_NORMALIZE: Record<string, string> = {
  piece: "pcs",
  pieces: "pcs",
  pc: "pcs",
  pcs: "pcs",
  clove: "cloves",
  cloves: "cloves",
  bulb: "bulbs",
  bulbs: "bulbs",
  rib: "ribs",
  ribs: "ribs",
  stalk: "stalks",
  stalks: "stalks",
  stem: "stalks",
  stems: "stalks",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  leaf: "leaves",
  leaves: "leaves",
  can: "can",
  cans: "can",
  jar: "jar",
  jars: "jar",
  package: "package",
  packages: "package",
  pack: "package",
  packs: "package",
  bottle: "bottle",
  bottles: "bottle",
  egg: "pcs",
  eggs: "pcs",
  cabbage: "head",
  cabbages: "head",
  onion: "onion",
  onions: "onion",
};

/** Ingredients that are count-based by default (no unit or ambiguous). Key = normalized name pattern. */
const COUNT_DEFAULT_INGREDIENTS: { pattern: RegExp; unit: string }[] = [
  { pattern: /^apple(s)?$|^green apple|^red apple/i, unit: "pcs" },
  { pattern: /^garlic(\s+clove)?s?$/i, unit: "cloves" },
  { pattern: /^fennel(\s+bulb)?s?$/i, unit: "bulbs" },
  { pattern: /^celery(\s+(rib|stalk))?s?$/i, unit: "ribs" },
  { pattern: /^green onion(s)?$|^scallion(s)?$/i, unit: "stalks" },
  { pattern: /^(red\s+|yellow\s+|white\s+)?onion(s)?$/i, unit: "onion" },
  { pattern: /^lemon(s)?$/i, unit: "pcs" },
  { pattern: /^lime(s)?$/i, unit: "pcs" },
  { pattern: /^egg(s)?$/i, unit: "pcs" },
  { pattern: /^(seedless\s+)?cucumber(s)?$/i, unit: "pcs" },
  { pattern: /^carrot(s)?$/i, unit: "pcs" },
  { pattern: /^mango(es)?$/i, unit: "pcs" },
  { pattern: /^avocado(s)?$/i, unit: "pcs" },
  { pattern: /^(green\s+)?(red\s+)?cabbage(\s+head)?s?$/i, unit: "head" },
  { pattern: /^parsley$|^cilantro$|^dill$|^mint$/i, unit: "bunch" },
  { pattern: /^tomato(es)?$/i, unit: "pcs" },
  { pattern: /^potato(es)?$/i, unit: "pcs" },
  { pattern: /^bell pepper(s)?$/i, unit: "pcs" },
  { pattern: /^banana(s)?$/i, unit: "pcs" },
  { pattern: /^orange(s)?$/i, unit: "pcs" },
  { pattern: /^pear(s)?$/i, unit: "pcs" },
  { pattern: /^zucchini$/i, unit: "pcs" },
  { pattern: /^sweet potato(es)?$/i, unit: "pcs" },
];

/** Ingredients that are volume-based by default (no unit). */
const VOLUME_DEFAULT_PATTERNS = /\b(oil|milk|cream|water|broth|stock|juice|vinegar|sauce|honey|syrup|molasses)\b/i;

/** Ingredients that are weight-based by default (no unit). */
const WEIGHT_DEFAULT_PATTERNS = /\b(flour|sugar|tahini|salt|pepper|spice|herb|powder|cocoa|walnut|walnuts|nut|nuts|seed|seeds)\b/i;

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
  if (COUNT_UNIT_NORMALIZE[u] !== undefined) return u;
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

function getCountUnitForIngredient(name: string): string | null {
  const n = name.toLowerCase().trim().replace(/\s+/g, " ");
  for (const { pattern, unit } of COUNT_DEFAULT_INGREDIENTS) {
    if (pattern.test(n)) return unit;
  }
  return null;
}

/**
 * Classify unit (and optional ingredient) into weight, volume, count, or unknown.
 */
export function getUnitType(
  unit: string | undefined,
  ingredientName?: string,
  category?: string
): UnitType {
  const u = normalizeUnit(unit);
  if (VOLUME_TO_ML[u as string] !== undefined) return "volume";
  if (WEIGHT_TO_G[u as string] !== undefined) return "weight";
  if (COUNT_UNIT_NORMALIZE[u as string] !== undefined) return "count";

  if (!u || u === "") {
    if (ingredientName && getCountUnitForIngredient(ingredientName)) return "count";
    if (ingredientName && VOLUME_DEFAULT_PATTERNS.test(ingredientName)) return "volume";
    if (ingredientName && isLiquid(ingredientName, category)) return "volume";
    if (ingredientName && WEIGHT_DEFAULT_PATTERNS.test(ingredientName)) return "weight";
    return "unknown";
  }
  return "unknown";
}

/**
 * Parse quantity string, including fractions and mixed numbers.
 * Examples: "2" -> 2, "1/2" -> 0.5, "3/4" -> 0.75, "1 1/2" -> 1.5, "2 1/2" -> 2.5.
 */
export function parseQuantity(value: string | number): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const s = String(value).trim();
  if (!s) return 0;
  // Mixed number: "1 1/2", "2 1/2"
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const den = parseFloat(mixedMatch[3]);
    if (!Number.isNaN(whole) && den && !Number.isNaN(num) && !Number.isNaN(den)) return whole + num / den;
  }
  // Simple fraction: "1/2", "3/4"
  if (s.includes("/")) {
    const parts = s.split("/").map((x) => parseFloat(x.trim()));
    if (parts.length === 2 && parts[1] && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return parts[0] / parts[1];
    }
  }
  const num = parseFloat(s.replace(/[^\d./-]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

export type PreferredUnit = "g" | "ml" | string; // string = count unit e.g. "pcs", "cloves"

export interface NormalizedQuantity {
  value: number;
  unit: PreferredUnit;
  preferredUnit: PreferredUnit;
  unitType: UnitType;
}

/**
 * Convert quantity + unit to preferred form: weight → g, volume → ml, count → preserve (pcs, cloves, bulbs, etc.).
 * Does not force count-based ingredients into grams.
 */
export function toPreferredUnit(
  quantity: string | number,
  unit: string | undefined,
  ingredientName?: string,
  category?: string
): NormalizedQuantity {
  const q = parseQuantity(quantity);
  const u = normalizeUnit(unit);

  // Known count unit: preserve it
  const countNorm = u ? COUNT_UNIT_NORMALIZE[u] : undefined;
  if (countNorm) {
    return { value: q, unit: countNorm, preferredUnit: countNorm, unitType: "count" };
  }

  // No unit: use ingredient heuristics
  if (!u) {
    const countUnit = ingredientName ? getCountUnitForIngredient(ingredientName) : null;
    if (countUnit) {
      return { value: q, unit: countUnit, preferredUnit: countUnit, unitType: "count" };
    }
    const liquid = ingredientName ? isLiquid(ingredientName, category) : false;
    const pref = liquid ? "ml" : "g";
    return { value: q, unit: pref, preferredUnit: pref, unitType: liquid ? "volume" : "weight" };
  }

  const volMl = VOLUME_TO_ML[u];
  const weightG = WEIGHT_TO_G[u];

  if (volMl !== undefined) {
    const ml = q * volMl;
    const liquid = ingredientName ? isLiquid(ingredientName, category) : true;
    if (liquid) {
      return { value: Math.round(ml * 10) / 10, unit: "ml", preferredUnit: "ml", unitType: "volume" };
    }
    const key = ingredientName?.toLowerCase().trim().replace(/\s+/g, " ");
    const density = key && DENSITY_G_PER_ML[key] ? DENSITY_G_PER_ML[key] : 0.6;
    const grams = ml * density;
    return { value: Math.round(grams * 10) / 10, unit: "g", preferredUnit: "g", unitType: "weight" };
  }

  if (weightG !== undefined) {
    const g = q * weightG;
    return { value: Math.round(g * 10) / 10, unit: "g", preferredUnit: "g", unitType: "weight" };
  }

  // Unknown unit: do not force to g/ml; use ingredient default
  const countUnit = ingredientName ? getCountUnitForIngredient(ingredientName) : null;
  if (countUnit) {
    return { value: q, unit: countUnit, preferredUnit: countUnit, unitType: "count" };
  }
  const liquid = ingredientName ? isLiquid(ingredientName, category) : false;
  const pref = liquid ? "ml" : "g";
  return { value: q, unit: pref, preferredUnit: pref, unitType: liquid ? "volume" : "weight" };
}

/**
 * Format a normalized quantity for display (e.g. "500 g", "1.5 L", "2 pcs", "4 cloves").
 */
/** Singular form for count units when value is 1 (e.g. "1 bulb" not "1 bulbs"). */
const COUNT_UNIT_SINGULAR: Record<string, string> = {
  pcs: "pc",
  cloves: "clove",
  bulbs: "bulb",
  ribs: "rib",
  stalks: "stalk",
  bunch: "bunch",
  head: "head",
  leaves: "leaf",
  can: "can",
  jar: "jar",
  package: "package",
  bottle: "bottle",
  onion: "onion",
};

/** Plural form for count units when value !== 1 (e.g. "1.5 heads", "2 cloves"). */
const COUNT_UNIT_PLURAL: Record<string, string> = {
  pcs: "pcs",
  cloves: "cloves",
  bulbs: "bulbs",
  ribs: "ribs",
  stalks: "stalks",
  bunch: "bunches",
  head: "heads",
  leaves: "leaves",
  can: "cans",
  jar: "jars",
  package: "packages",
  bottle: "bottles",
  onion: "onions",
};

/** For count units, show common fractions as 1/2, 1/4, 3/4 when value is exact. */
function formatCountValue(value: number): string {
  if (value === 0.25) return "1/4";
  if (value === 0.5) return "1/2";
  if (value === 0.75) return "3/4";
  return value % 1 === 0 ? String(value) : String(Math.round(value * 10) / 10);
}

export function formatQuantity(value: number, preferredUnit: PreferredUnit, _unitType?: UnitType): string {
  if (preferredUnit !== "g" && preferredUnit !== "ml") {
    const v = value % 1 === 0 ? value : Math.round(value * 10) / 10;
    const unit =
      value === 1 && COUNT_UNIT_SINGULAR[preferredUnit]
        ? COUNT_UNIT_SINGULAR[preferredUnit]
        : COUNT_UNIT_PLURAL[preferredUnit] ?? preferredUnit;
    const valueStr = formatCountValue(v);
    return `${valueStr} ${unit}`;
  }
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
 * Check if two normalized quantities can be merged (same unit type and same preferred unit for count).
 */
export function canMergeQuantities(a: NormalizedQuantity, b: NormalizedQuantity): boolean {
  if (a.unitType !== b.unitType) return false;
  if (a.unitType === "count" && a.preferredUnit !== b.preferredUnit) return false;
  if (a.unitType === "unknown" || b.unitType === "unknown") return false;
  return true;
}

/**
 * Add two quantities that are compatible (same unit type and same preferred unit).
 * Count units preserve one decimal (e.g. 0.5 + 0.5 + 0.5 = 1.5 cabbages).
 */
export function addQuantities(
  value1: number,
  value2: number,
  preferredUnit: PreferredUnit,
  unitType?: UnitType
): { value: number; formatted: string } {
  const sum = value1 + value2;
  const value = Math.round(sum * 10) / 10;
  return {
    value,
    formatted: formatQuantity(value, preferredUnit, unitType),
  };
}
