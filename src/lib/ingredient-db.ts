/**
 * Unified ingredient persistence. All recipe and shopping flows should use
 * getOrCreateIngredient so Ingredient rows are normalized and deduplicated.
 */

import { prisma } from "@/lib/db";
import { normalizeIngredientName } from "@/lib/ingredient-normalize";

/**
 * Find or create an Ingredient by name. Uses normalized (canonical) name for
 * lookup so "Tomatoes" and "tomatoes" resolve to the same row. Sets
 * canonicalName for consistency with pantry and shopping merge.
 */
export async function getOrCreateIngredient(
  name: string,
  category?: string | null
): Promise<{ id: string; name: string; category: string | null; canonicalName: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Ingredient name is required");

  const canonicalName = normalizeIngredientName(trimmed);

  let ingredient = await prisma.ingredient.findFirst({
    where: { name: { equals: canonicalName, mode: "insensitive" } },
  });

  if (!ingredient) {
    ingredient = await prisma.ingredient.create({
      data: {
        name: canonicalName,
        category: category ?? null,
        canonicalName,
      },
    });
  }

  return {
    id: ingredient.id,
    name: ingredient.name,
    category: ingredient.category,
    canonicalName: ingredient.canonicalName,
  };
}
