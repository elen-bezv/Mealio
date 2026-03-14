import { NextRequest, NextResponse } from "next/server";
import { getRequireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RecipeCategory } from "@prisma/client";
import type { StructuredRecipe, StructuredIngredient } from "@/types";
import { createRecipeFromStructured } from "@/services/recipe-creation";

/** POST: Import selected recipes from cookbook into Recipe Library. Body: { recipeIndices: number[] } or omit for all. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getRequireUserId();
    const { id: cookbookId } = await params;

    const cookbook = await prisma.cookbook.findFirst({
      where: { id: cookbookId, userId },
    });
    if (!cookbook) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!cookbook.parsedRecipes) return NextResponse.json({ error: "No recipes to import" }, { status: 400 });

    const recipes = JSON.parse(cookbook.parsedRecipes) as StructuredRecipe[];
    const body = await req.json().catch(() => ({}));
    const indices = Array.isArray(body.recipeIndices) ? (body.recipeIndices as number[]) : undefined;
    const toImport =
      indices != null
        ? indices.filter((i) => i >= 0 && i < recipes.length).map((i) => recipes[i])
        : recipes;

    const cookbookTag = cookbook.name;
    const created: string[] = [];

    for (const rec of toImport) {
      const recipe = await createRecipeFromStructured({
        userId,
        title: rec.title,
        description: rec.description ?? null,
        ingredients: (rec.ingredients || []).map((i: StructuredIngredient) => ({
          name: i.name,
          quantity: i.quantity ?? "1",
          unit: i.unit ?? null,
          category: i.category ?? null,
          rawLine: i.rawLine ?? null,
          preparation: i.preparation ?? null,
        })),
        instructions: rec.instructions ?? [],
        category: RecipeCategory.OTHER,
        sourceType: "pdf",
        cookbookId,
        prepTimeMinutes: rec.prepTimeMinutes ?? null,
        cookTimeMinutes: rec.cookTimeMinutes ?? null,
        servings: rec.servings ?? null,
        needsReview: rec.needsReview ?? false,
        tags: [cookbookTag],
      });
      if (recipe) created.push(recipe.id);
    }

    return NextResponse.json({ imported: created.length, recipeIds: created });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("cookbooks/import", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
