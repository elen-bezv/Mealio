import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getUserLocale } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RecipeCategory } from "@prisma/client";
import { isAppLocale } from "@/lib/constants";
import {
  translateRecipe,
  buildTranslatedDisplayName,
  parseTranslatedDisplayName,
  type TargetLocale,
} from "@/services/recipe-translation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  const localeParam = new URL(req.url).searchParams.get("locale");
  const locale =
    (localeParam && isAppLocale(localeParam) ? localeParam : null) ??
    (userId ? await getUserLocale(userId) : "uk");

  let recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      recipeIngredients: { include: { ingredient: true } },
      tags: true,
      recipeTranslations: true,
    },
  });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let trans = recipe.recipeTranslations.find((t) => t.language === locale);
  if (!trans && recipe.originalLanguage && recipe.originalLanguage !== locale) {
    const origTrans = recipe.recipeTranslations.find(
      (t) => t.language === recipe!.originalLanguage
    );
    const origTitle = origTrans?.title ?? recipe.title;
    const origDesc = origTrans?.description ?? recipe.description;
    let origInstructions: string[] = [];
    try {
      if (origTrans?.instructions) origInstructions = JSON.parse(origTrans.instructions);
    } catch {}
    const ingredients = recipe.recipeIngredients.map((ri) => ({
      name: ri.ingredient.name,
      quantity: ri.quantity,
      unit: ri.unit ?? undefined,
      preparation: undefined,
    }));
    try {
      const translated = await translateRecipe(
        {
          title: origTitle,
          description: origDesc,
          instructions: origInstructions,
          ingredients,
        },
        recipe.originalLanguage,
        locale
      );
      await prisma.recipeTranslation.create({
        data: {
          recipeId: recipe.id,
          language: locale,
          title: translated.title,
          description: translated.description,
          instructions:
            translated.instructions.length > 0
              ? JSON.stringify(translated.instructions)
              : null,
        },
      });
      for (let i = 0; i < recipe.recipeIngredients.length; i++) {
        const ri = recipe.recipeIngredients[i];
        const displayName = translated.ingredients[i]?.displayName ?? ri.ingredient.name;
        const existing = parseTranslatedDisplayName(ri.translatedDisplayName);
        const updated = buildTranslatedDisplayName(existing, locale, displayName);
        await prisma.recipeIngredient.update({
          where: { id: ri.id },
          data: { translatedDisplayName: updated },
        });
      }
      const updatedRecipe = await prisma.recipe.findUnique({
        where: { id },
        include: {
          recipeIngredients: { include: { ingredient: true } },
          tags: true,
          recipeTranslations: true,
        },
      });
      if (updatedRecipe) {
        recipe = updatedRecipe;
        trans = recipe.recipeTranslations.find((t) => t.language === locale);
      }
    } catch (err) {
      console.error("Ensure translation failed", err);
    }
  }

  const displayTitle = trans?.title ?? recipe.title;
  const displayDescription = trans?.description ?? recipe.description;
  let displayInstructions: string[] | null = null;
  try {
    if (trans?.instructions) displayInstructions = JSON.parse(trans.instructions);
  } catch {}
  const recipeIngredients = recipe.recipeIngredients.map((ri) => {
    let displayName = ri.ingredient.name;
    try {
      if (ri.translatedDisplayName) {
        const map = parseTranslatedDisplayName(ri.translatedDisplayName);
        if (map[locale]) displayName = map[locale];
      }
    } catch {}
    return { ...ri, displayName };
  });

  return NextResponse.json({
    ...recipe,
    recipeTranslations: undefined,
    displayTitle,
    displayDescription,
    displayInstructions,
    recipeIngredients,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isBuiltIn) return NextResponse.json({ error: "Cannot edit built-in recipe" }, { status: 403 });

  const body = await req.json();
  const {
    title,
    description,
    category,
    ingredients,
    tags,
    translation,
  } = body;

  if (title !== undefined) existing.title = title;
  if (description !== undefined) existing.description = description;
  if (category !== undefined) existing.category = category as RecipeCategory;

  await prisma.recipe.update({
    where: { id },
    data: {
      title: existing.title,
      description: existing.description,
      category: existing.category,
    },
  });

  if (
    translation &&
    typeof translation === "object" &&
    translation.locale &&
    isAppLocale(translation.locale)
  ) {
    const tLocale = translation.locale;
    const tTitle = translation.title ?? existing.title;
    const tDesc = translation.description ?? existing.description;
    let tInstructions: string | null = null;
    if (Array.isArray(translation.instructions))
      tInstructions = JSON.stringify(translation.instructions);
    await prisma.recipeTranslation.upsert({
      where: {
        recipeId_language: { recipeId: id, language: tLocale },
      },
      create: {
        recipeId: id,
        language: tLocale,
        title: tTitle,
        description: tDesc,
        instructions: tInstructions,
      },
      update: {
        title: tTitle,
        description: tDesc,
        ...(tInstructions !== null && { instructions: tInstructions }),
      },
    });
    if (Array.isArray(translation.ingredientDisplayNames)) {
      const ris = await prisma.recipeIngredient.findMany({
        where: { recipeId: id },
        select: { id: true, translatedDisplayName: true },
      });
      for (let i = 0; i < translation.ingredientDisplayNames.length && i < ris.length; i++) {
        const displayName = translation.ingredientDisplayNames[i];
        if (typeof displayName !== "string") continue;
        const ri = ris[i];
        const existingMap = parseTranslatedDisplayName(ri.translatedDisplayName);
        const updated = buildTranslatedDisplayName(existingMap, tLocale, displayName);
        await prisma.recipeIngredient.update({
          where: { id: ri.id },
          data: { translatedDisplayName: updated },
        });
      }
    }
  }

  if (Array.isArray(tags)) {
    await prisma.recipeTag.deleteMany({ where: { recipeId: id } });
    await prisma.recipeTag.createMany({
      data: tags.map((name: string) => ({ recipeId: id, name })),
      skipDuplicates: true,
    });
  }

  if (Array.isArray(ingredients)) {
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
    for (const ing of ingredients) {
      const name = ing.name ?? ing;
      const quantity = typeof ing === "string" ? "1" : (ing.quantity ?? "1");
      const unit = typeof ing === "string" ? null : ing.unit;
      let ingredient = await prisma.ingredient.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (!ingredient) {
        ingredient = await prisma.ingredient.create({
          data: { name, category: ing.category ?? null, canonicalName: name },
        });
      }
      await prisma.recipeIngredient.create({
        data: {
          recipeId: id,
          ingredientId: ingredient.id,
          quantity,
          unit,
          rawLine: ing.rawLine ?? null,
        },
      });
    }
  }

  const full = await prisma.recipe.findUnique({
    where: { id },
    include: { recipeIngredients: { include: { ingredient: true } }, tags: true },
  });
  return NextResponse.json(full);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isBuiltIn) return NextResponse.json({ error: "Cannot delete built-in recipe" }, { status: 403 });
  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
