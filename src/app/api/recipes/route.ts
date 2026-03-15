import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRequireUserId, getUserLocale } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RecipeCategory } from "@prisma/client";
import { isAppLocale } from "@/lib/constants";
import { createRecipeFromStructured } from "@/services/recipe-creation";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") as RecipeCategory | null;
    const localeParam = searchParams.get("locale");
    const userId = session?.user ? (session.user as { id?: string }).id : null;

    const where: { userId?: string | null; category?: RecipeCategory } = {};
    if (userId) {
      where.userId = userId;
    } else {
      return NextResponse.json([]);
    }
    if (category) where.category = category;

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        recipeIngredients: { include: { ingredient: true } },
        tags: true,
        recipeTranslations: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const locale =
      localeParam && isAppLocale(localeParam)
        ? localeParam
        : userId
          ? await getUserLocale(userId)
          : "uk";

    const withDisplay = recipes.map((r) => {
      const trans = r.recipeTranslations.find((t) => t.language === locale);
      const displayTitle = trans?.title ?? r.title;
      const displayDescription = trans?.description ?? r.description;
      const displayInstructions = trans?.instructions ?? null;
      const ingredients = r.recipeIngredients.map((ri) => {
        let displayName = ri.ingredient.name;
        try {
          if (ri.translatedDisplayName) {
            const map = JSON.parse(ri.translatedDisplayName) as Record<string, string>;
            if (map[locale]) displayName = map[locale];
          }
        } catch {}
        return { ...ri, displayName };
      });
      return {
        ...r,
        recipeTranslations: undefined,
        displayTitle,
        displayDescription,
        displayInstructions,
        recipeIngredients: ingredients,
      };
    });

    return NextResponse.json(withDisplay);
  } catch (e) {
    console.error("recipes GET", e);
    return NextResponse.json({ error: "Failed to list recipes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequireUserId();
    const body = await req.json();
    const {
      title,
      description,
      category,
      sourceUrl,
      sourceType,
      ingredients,
      instructions,
      originalLanguage,
      tags,
    } = body;
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

    const instructionsArr = Array.isArray(instructions) ? instructions : [];
    const ingList = Array.isArray(ingredients)
      ? ingredients.map((ing: { name?: string; quantity?: string; unit?: string; category?: string; rawLine?: string; preparation?: string }) => ({
          name: ing.name ?? "",
          quantity: ing.quantity ?? "1",
          unit: ing.unit ?? null,
          category: ing.category,
          rawLine: ing.rawLine,
          preparation: ing.preparation,
        }))
      : [];

    const full = await createRecipeFromStructured({
      userId,
      title,
      description: description ?? null,
      ingredients: ingList,
      instructions: instructionsArr,
      originalLanguage: originalLanguage ?? null,
      category: (category as RecipeCategory) ?? "OTHER",
      sourceUrl: sourceUrl ?? null,
      sourceType: sourceType ?? null,
      tags: Array.isArray(tags) ? tags : undefined,
    });

    if (!full) return NextResponse.json({ error: "Create failed" }, { status: 500 });
    const userLocale = await getUserLocale(userId);
    const trans = full.recipeTranslations.find((t) => t.language === userLocale);
    const out = {
      ...full,
      displayTitle: trans?.title ?? full.title,
      displayDescription: trans?.description ?? full.description,
      displayInstructions: trans?.instructions ?? null,
      recipeIngredients: full.recipeIngredients.map((ri) => {
        let displayName = ri.ingredient.name;
        try {
          if (ri.translatedDisplayName) {
            const map = JSON.parse(ri.translatedDisplayName) as Record<string, string>;
            if (map[userLocale]) displayName = map[userLocale];
          }
        } catch {}
        return { ...ri, displayName };
      }),
    };
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("recipes POST", e);
    return NextResponse.json({ error: "Failed to create recipe" }, { status: 500 });
  }
}
