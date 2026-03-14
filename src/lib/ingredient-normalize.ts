/**
 * Smart ingredient normalization: dictionary, fuzzy matching, canonical forms.
 * Merges equivalents: tomato/tomatoes, olive oil/extra virgin olive oil, etc.
 */

/** Variant → canonical name. Multiple variants can map to same canonical. */
export const INGREDIENT_DICTIONARY: Record<string, string> = {
  // Tomatoes
  tomato: "tomatoes",
  tomatoes: "tomatoes",
  "roma tomatoes": "tomatoes",
  "cherry tomatoes": "tomatoes",
  "grape tomatoes": "tomatoes",
  // Oils
  "olive oil": "olive oil",
  "extra virgin olive oil": "olive oil",
  "evoo": "olive oil",
  "vegetable oil": "vegetable oil",
  "cooking oil": "vegetable oil",
  // Peppers
  "bell pepper": "bell pepper",
  "bell peppers": "bell pepper",
  "red pepper": "bell pepper",
  "red peppers": "bell pepper",
  "green pepper": "bell pepper",
  "yellow pepper": "bell pepper",
  // Alliums
  scallion: "green onion",
  scallions: "green onion",
  "green onion": "green onion",
  "green onions": "green onion",
  "spring onion": "green onion",
  "spring onions": "green onion",
  // Dairy
  milk: "milk",
  "whole milk": "milk",
  "skim milk": "milk",
  "2% milk": "milk",
  "half and half": "half and half",
  cream: "cream",
  "heavy cream": "cream",
  "sour cream": "sour cream",
  "greek yogurt": "yogurt",
  yogurt: "yogurt",
  "plain yogurt": "yogurt",
  "ricotta cheese": "ricotta",
  ricotta: "ricotta",
  // Herbs
  "fresh basil": "basil",
  basil: "basil",
  "dried basil": "basil",
  "fresh parsley": "parsley",
  parsley: "parsley",
  "fresh cilantro": "cilantro",
  cilantro: "cilantro",
  "coriander leaves": "cilantro",
  // Pantry
  "all-purpose flour": "flour",
  flour: "flour",
  "white sugar": "sugar",
  sugar: "sugar",
  "brown sugar": "brown sugar",
  "granulated sugar": "sugar",
  "powdered sugar": "confectioners sugar",
  "confectioners sugar": "confectioners sugar",
  "icing sugar": "confectioners sugar",
  salt: "salt",
  "table salt": "salt",
  "kosher salt": "salt",
  "black pepper": "black pepper",
  pepper: "black pepper",
  "vanilla extract": "vanilla extract",
  vanilla: "vanilla extract",
  "baking soda": "baking soda",
  "baking powder": "baking powder",
  honey: "honey",
  butter: "butter",
  "unsalted butter": "butter",
  "salted butter": "butter",
  eggs: "eggs",
  egg: "eggs",
  // Garlic/ginger
  garlic: "garlic",
  "garlic clove": "garlic",
  "garlic cloves": "garlic",
  ginger: "ginger",
  "fresh ginger": "ginger",
  "ground ginger": "ginger",
};

/** Canonical names set for fuzzy matching fallback. */
const CANONICAL_SET = new Set(Object.values(INGREDIENT_DICTIONARY));

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/\b(ml|g|kg|oz|lb|cups?|tbsp|tsp)\b/gi, "").trim();
}

/** Levenshtein distance for fuzzy match. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Best matching canonical name from set, or null. */
function fuzzyMatchCanonical(name: string, threshold = 0.75): string | null {
  const key = normalizeKey(name);
  if (!key) return null;
  let best: { canon: string; sim: number } | null = null;
  for (const canon of CANONICAL_SET) {
    const canonKey = normalizeKey(canon);
    const sim = similarity(key, canonKey);
    if (sim >= threshold && (!best || sim > best.sim)) {
      best = { canon, sim };
    }
  }
  return best?.canon ?? null;
}

/**
 * Normalize ingredient name to a canonical form for merging.
 * 1) Dictionary lookup (exact key)
 * 2) Fuzzy match against canonical set
 * 3) Return trimmed, title-cased original
 */
export function normalizeIngredientName(name: string): string {
  if (!name?.trim()) return name;
  const key = normalizeKey(name);
  if (INGREDIENT_DICTIONARY[key]) return INGREDIENT_DICTIONARY[key];
  const fuzzy = fuzzyMatchCanonical(name);
  if (fuzzy) return fuzzy;
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Get canonical key for grouping (lowercase, no units).
 * Use this when grouping ingredients for merge.
 */
export function getCanonicalKey(name: string): string {
  const canonical = normalizeIngredientName(name);
  return canonical.toLowerCase();
}

/**
 * Optional: AI normalization fallback for ambiguous ingredients.
 * When OPENAI_API_KEY is set, call this to suggest canonical form for names
 * that didn't match dictionary or fuzzy. Integrate in batch jobs or API, not sync merge.
 */
export async function normalizeIngredientNameAI(name: string): Promise<string> {
  const { openai } = await import("./openai");
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Reply with only the canonical grocery ingredient name, one or two words. Examples: 'roma tomatoes' -> 'tomatoes', 'extra virgin olive oil' -> 'olive oil', 'scallions' -> 'green onion'.",
      },
      { role: "user", content: name },
    ],
    max_tokens: 30,
  });
  const out = res.choices[0]?.message?.content?.trim();
  return out || name;
}
