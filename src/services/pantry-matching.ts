/**
 * Smart pantry matching: subtract pantry quantities from shopping list using
 * ingredient normalization (dictionary + fuzzy) and unit conversion.
 */

import { getCanonicalKey, normalizeIngredientName } from "@/lib/ingredient-normalize";
import {
  toPreferredUnit,
  formatQuantity,
  type NormalizedQuantity,
} from "@/lib/unit-conversion";
import type { MergedShoppingItem } from "@/types";

export interface PantryItemInput {
  ingredientName: string;
  normalizedIngredientName: string;
  quantity: string;
  unit?: string | null;
}

/**
 * Convert pantry quantity to same normalized form (g or ml) for comparison.
 */
function pantryToNormalized(
  quantity: string,
  unit: string | undefined,
  ingredientName: string
): NormalizedQuantity {
  return toPreferredUnit(quantity, unit ?? undefined, ingredientName, undefined);
}

/**
 * Subtract pantry quantities from a merged shopping list.
 * Matching uses normalized/canonical names (tomato/tomatoes, olive oil/extra virgin olive oil).
 * Returns adjusted list: items with remaining quantity > 0, and suggestions for "might be in pantry".
 */
export function subtractPantryFromMerged(
  merged: MergedShoppingItem[],
  pantryItems: PantryItemInput[]
): {
  adjusted: MergedShoppingItem[];
  removed: { name: string; hadEnough: string }[];
  suggestions: { listName: string; pantryName: string; message: string }[];
} {
  const removed: { name: string; hadEnough: string }[] = [];
  const suggestions: { listName: string; pantryName: string; message: string }[] = [];

  const pantryByKey = new Map<string, PantryItemInput[]>();
  for (const p of pantryItems) {
    const key = getCanonicalKey(p.normalizedIngredientName);
    if (!pantryByKey.has(key)) pantryByKey.set(key, []);
    pantryByKey.get(key)!.push(p);
  }

  const adjusted: MergedShoppingItem[] = [];

  for (const item of merged) {
    const key = getCanonicalKey(item.name);
    const pantryList = pantryByKey.get(key);

    if (!pantryList || pantryList.length === 0) {
      adjusted.push(item);
      continue;
    }

    const needNorm = toPreferredUnit(
      item.quantity,
      item.unit,
      item.name,
      item.category
    );
    let needValue = needNorm.value;

    for (const p of pantryList) {
      const haveNorm = pantryToNormalized(p.quantity, p.unit ?? undefined, p.ingredientName);
      if (haveNorm.preferredUnit !== needNorm.preferredUnit) continue;
      needValue = Math.max(0, needValue - haveNorm.value);
      if (needValue <= 0) break;
    }

    if (needValue <= 0) {
      removed.push({
        name: item.name,
        hadEnough: pantryList.map((p) => `${p.ingredientName} – ${p.quantity} ${p.unit ?? ""}`.trim()).join("; "),
      });
      continue;
    }

    adjusted.push({
      ...item,
      quantity: needValue.toString(),
      mergedQuantity: formatQuantity(needValue, needNorm.preferredUnit),
    });
  }

  return { adjusted, removed, suggestions };
}

/**
 * Build adjusted merged list for a user: merge list then subtract pantry.
 * Used when creating a new shopping list from ingredients.
 */
export function applyPantryToMerged(
  merged: MergedShoppingItem[],
  pantryItems: PantryItemInput[]
): MergedShoppingItem[] {
  const { adjusted } = subtractPantryFromMerged(merged, pantryItems);
  return adjusted;
}

/**
 * For "Do you still have X?" suggestions: find shopping list items that
 * have a possible pantry match (same canonical key) so user can confirm.
 */
export function getPantrySuggestions(
  merged: MergedShoppingItem[],
  pantryItems: PantryItemInput[]
): { listName: string; pantryName: string; pantryQuantity: string }[] {
  const pantryByKey = new Map<string, PantryItemInput[]>();
  for (const p of pantryItems) {
    const key = getCanonicalKey(p.normalizedIngredientName);
    if (!pantryByKey.has(key)) pantryByKey.set(key, []);
    pantryByKey.get(key)!.push(p);
  }

  const out: { listName: string; pantryName: string; pantryQuantity: string }[] = [];
  for (const item of merged) {
    const key = getCanonicalKey(item.name);
    const list = pantryByKey.get(key);
    if (!list?.length) continue;
    for (const p of list) {
      out.push({
        listName: item.name,
        pantryName: p.ingredientName,
        pantryQuantity: `${p.quantity} ${p.unit ?? ""}`.trim(),
      });
    }
  }
  return out;
}
