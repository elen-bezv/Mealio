import { prisma } from "@/lib/db";
import type { ExtractedIngredient, MergedShoppingItem } from "@/types";
import { getCanonicalKey, normalizeIngredientName } from "@/lib/ingredient-normalize";
import { getOrCreateIngredient } from "@/lib/ingredient-db";
import {
  toPreferredUnit,
  addQuantities,
  formatQuantity,
  type NormalizedQuantity,
} from "@/lib/unit-conversion";
import { applyPantryToMerged } from "@/services/pantry-matching";

export interface ItemForMerge {
  name: string;
  quantity: string;
  unit?: string;
  category?: string;
  ingredientId?: string;
}

/**
 * Smart merge: normalize names (dictionary + fuzzy), convert to preferred units (g/ml), then sum.
 * Example: Recipe1 "Tomatoes – 3" + Recipe2 "Tomatoes – 2" → "Tomatoes – 5"
 *          "1 cup sugar" + "200 g sugar" → "Sugar – 400 g" (after conversion).
 */
export function mergeIngredients(items: ItemForMerge[]): MergedShoppingItem[] {
  const byCanonical = new Map<
    string,
    {
      canonicalName: string;
      total: NormalizedQuantity;
      category?: string;
      ingredientIds: string[];
    }
  >();

  for (const item of items) {
    const canonicalName = normalizeIngredientName(item.name);
    const key = getCanonicalKey(canonicalName);
    const normalized = toPreferredUnit(
      item.quantity,
      item.unit,
      item.name,
      item.category
    );

    const existing = byCanonical.get(key);
    if (existing) {
      const added = addQuantities(
        existing.total.value,
        normalized.value,
        normalized.preferredUnit
      );
      existing.total = { ...existing.total, value: added.value };
      existing.total.preferredUnit = normalized.preferredUnit;
      if (item.ingredientId) existing.ingredientIds.push(item.ingredientId);
    } else {
      byCanonical.set(key, {
        canonicalName,
        total: {
          value: normalized.value,
          unit: normalized.unit,
          preferredUnit: normalized.preferredUnit,
        },
        category: item.category,
        ingredientIds: item.ingredientId ? [item.ingredientId] : [],
      });
    }
  }

  return Array.from(byCanonical.values()).map((x) => ({
    name: x.canonicalName,
    quantity: x.total.value.toString(),
    unit: x.total.preferredUnit === "ml" ? "ml" : "g",
    mergedQuantity: formatQuantity(x.total.value, x.total.preferredUnit),
    category: x.category,
    ingredientIds: x.ingredientIds,
  }));
}

export async function createShoppingListFromIngredients(
  userId: string,
  ingredients: ExtractedIngredient[],
  mealPlanId?: string,
  name?: string,
  options?: { subtractPantry?: boolean }
) {
  let merged = mergeIngredients(
    ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      category: ing.category,
    }))
  );

  if (options?.subtractPantry) {
    const pantryItems = await prisma.pantryItem.findMany({
      where: { userId },
    });
    merged = applyPantryToMerged(
      merged,
      pantryItems.map((p) => ({
        ingredientName: p.ingredientName,
        normalizedIngredientName: p.normalizedIngredientName,
        quantity: p.quantity,
        unit: p.unit,
      }))
    );
  }

  const list = await prisma.shoppingList.create({
    data: { userId, mealPlanId, name: name ?? "My list" },
  });

  for (const item of merged) {
    const ingRecord = await getOrCreateIngredient(item.name, item.category);

    const quantity = item.mergedQuantity ?? `${item.quantity} ${item.unit ?? ""}`;
    const [qtyPart] = quantity.split(/\s/);
    await prisma.shoppingListItem.upsert({
      where: {
        shoppingListId_ingredientId: {
          shoppingListId: list.id,
          ingredientId: ingRecord.id,
        },
      },
      create: {
        shoppingListId: list.id,
        ingredientId: ingRecord.id,
        quantity: qtyPart ?? item.quantity,
        unit: item.unit ?? null,
        mergedQuantity: item.mergedQuantity ?? null,
      },
      update: {
        quantity: qtyPart ?? item.quantity,
        unit: item.unit ?? null,
        mergedQuantity: item.mergedQuantity ?? null,
      },
    });
  }

  return prisma.shoppingList.findUnique({
    where: { id: list.id },
    include: { items: { include: { ingredient: true } } },
  });
}

/**
 * Merge ingredients from multiple recipe sources (e.g. meal plan) into a single list.
 * Use when building list from meal plan: collect all RecipeIngredients, then merge.
 */
export function mergeRecipeIngredients(
  items: {
    name: string;
    quantity: string;
    unit?: string | null;
    category?: string | null;
    ingredientId?: string;
  }[]
): MergedShoppingItem[] {
  return mergeIngredients(
    items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit ?? undefined,
      category: i.category ?? undefined,
      ingredientId: i.ingredientId,
    }))
  );
}
