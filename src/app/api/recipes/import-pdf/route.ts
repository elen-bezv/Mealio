import { NextRequest, NextResponse } from "next/server";
import { getRequireUserId } from "@/lib/auth";
import { RecipeCategory } from "@prisma/client";
import { parseCookbookPdf } from "@/services/cookbook-pdf";
import { createRecipeFromStructured } from "@/services/recipe-creation";
import type { StructuredRecipe, StructuredIngredient } from "@/types";

export const maxDuration = 120;
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

const VALID_CATEGORIES = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "SNACK", "OTHER"] as const;

function parseCategoriesFormData(formData: FormData): RecipeCategory[] {
  const raw = formData.get("categories");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((c): c is RecipeCategory =>
          typeof c === "string" && VALID_CATEGORIES.includes(c as typeof VALID_CATEGORIES[number])
        );
        if (filtered.length) return [...new Set(filtered)];
      }
    } catch {}
  }
  const single = (formData.get("category") as string) || "OTHER";
  return VALID_CATEGORIES.includes(single as typeof VALID_CATEGORIES[number])
    ? [single as RecipeCategory]
    : [RecipeCategory.OTHER];
}

/**
 * POST: Upload a PDF (e.g. recipe book), parse it, and insert all extracted
 * recipes directly into Recipe Library. No separate cookbook destination.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getRequireUserId();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const validCategories = parseCategoriesFormData(formData);

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 200 MB)" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name?.replace(/\.pdf$/i, "") || "PDF";

    const result = await parseCookbookPdf(buffer, name);
    const recipeIds: string[] = [];

    for (const rec of result.recipes) {
      const recipe = await createRecipeFromStructured({
        userId,
        title: rec.title || "Untitled Recipe",
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
        categories: validCategories,
        sourceType: "pdf",
        cookbookId: null,
        prepTimeMinutes: rec.prepTimeMinutes ?? null,
        cookTimeMinutes: rec.cookTimeMinutes ?? null,
        servings: rec.servings ?? null,
        needsReview: rec.needsReview ?? false,
      });
      if (recipe) recipeIds.push(recipe.id);
    }

    return NextResponse.json({ imported: recipeIds.length, recipeIds });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("recipes/import-pdf", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
