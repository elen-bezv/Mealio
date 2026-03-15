import { prisma } from "@/lib/db";
import type { ExtractedIngredient, MergedShoppingItem } from "@/types";
import { getCanonicalKey, normalizeIngredientName } from "@/lib/ingredient-normalize";
import { getOrCreateIngredient } from "@/lib/ingredient-db";
import {
  toPreferredUnit,
  addQuantities,
  formatQuantity,
  canMergeQuantities,
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
 * Merge key: canonical name + unit type + (for count) preferred unit. Incompatible units stay separate.
 */
function mergeKey(canonicalName: string, norm: NormalizedQuantity): string {
  const base = getCanonicalKey(canonicalName);
  if (norm.unitType === "count") return `${base}::count::${norm.preferredUnit}`;
  if (norm.unitType === "volume") return `${base}::volume`;
  if (norm.unitType === "weight") return `${base}::weight`;
  return `${base}::${norm.preferredUnit}`;
}

/**
 * Smart merge: normalize names, convert to preferred units (g/ml/count), merge only compatible units.
 * Count-based ingredients stay in count units (pcs, cloves, bulbs, etc.).
 */
export function mergeIngredients(items: ItemForMerge[]): MergedShoppingItem[] {
  const byKey = new Map<
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
    const normalized = toPreferredUnit(
      item.quantity,
      item.unit,
      item.name,
      item.category
    );
    const key = mergeKey(canonicalName, normalized);

    const existing = byKey.get(key);
    if (existing) {
      if (!canMergeQuantities(existing.total, normalized)) {
        const keyOther = mergeKey(canonicalName, normalized);
        const existingOther = byKey.get(keyOther);
        if (existingOther && canMergeQuantities(existingOther.total, normalized)) {
          const added = addQuantities(
            existingOther.total.value,
            normalized.value,
            normalized.preferredUnit,
            normalized.unitType
          );
          existingOther.total = { ...existingOther.total, value: added.value };
          if (item.ingredientId) existingOther.ingredientIds.push(item.ingredientId);
        } else {
          byKey.set(keyOther, {
            canonicalName,
            total: { value: normalized.value, unit: normalized.unit, preferredUnit: normalized.preferredUnit, unitType: normalized.unitType },
            category: item.category,
            ingredientIds: item.ingredientId ? [item.ingredientId] : [],
          });
        }
        continue;
      }
      const added = addQuantities(
        existing.total.value,
        normalized.value,
        normalized.preferredUnit,
        normalized.unitType
      );
      existing.total = { ...existing.total, value: added.value };
      if (item.ingredientId) existing.ingredientIds.push(item.ingredientId);
    } else {
      byKey.set(key, {
        canonicalName,
        total: {
          value: normalized.value,
          unit: normalized.unit,
          preferredUnit: normalized.preferredUnit,
          unitType: normalized.unitType,
        },
        category: item.category,
        ingredientIds: item.ingredientId ? [item.ingredientId] : [],
      });
    }
  }

  return Array.from(byKey.values()).map((x) => ({
    name: x.canonicalName,
    quantity: x.total.value.toString(),
    unit: x.total.preferredUnit,
    mergedQuantity: formatQuantity(x.total.value, x.total.preferredUnit, x.total.unitType),
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
