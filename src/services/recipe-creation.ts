/**
 * Unified recipe creation: one path for manual/import and cookbook import.
 * Creates Recipe, RecipeTranslation(s), and RecipeIngredients (with getOrCreateIngredient).
 */

import { prisma } from "@/lib/db";
import { RecipeCategory } from "@prisma/client";
import { getUserLocale } from "@/lib/auth";
import { getOrCreateIngredient } from "@/lib/ingredient-db";
import {
  detectRecipeLanguage,
  translateRecipe,
  buildTranslatedDisplayName,
  type TargetLocale,
} from "@/services/recipe-translation";

const SOURCE_LANGS = ["en", "uk", "he", "ru", "es", "fr", "it"] as const;

export interface StructuredIngredientInput {
  name: string;
  quantity: string;
  unit?: string | null;
  category?: string | null;
  rawLine?: string | null;
  preparation?: string | null;
}

export interface CreateRecipeFromStructuredInput {
  userId: string;
  title: string;
  description?: string | null;
  ingredients: StructuredIngredientInput[];
  instructions?: string[];
  originalLanguage?: string | null;
  category?: RecipeCategory;
  sourceUrl?: string | null;
  sourceType?: string | null;
  tags?: string[];
  cookbookId?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  needsReview?: boolean;
}

/**
 * Create a recipe from structured input: detect language, create Recipe +
 * RecipeTranslation(s), translate if needed, create ingredients via getOrCreateIngredient.
 */
export async function createRecipeFromStructured(
  input: CreateRecipeFromStructuredInput
) {
  const {
    userId,
    title,
    description,
    ingredients: ingList,
    instructions = [],
    originalLanguage: providedLang,
    category = "OTHER",
    sourceUrl,
    sourceType,
    tags,
    cookbookId,
    prepTimeMinutes,
    cookTimeMinutes,
    servings,
    needsReview = false,
  } = input;

  let origLang = providedLang;
  if (!origLang || !SOURCE_LANGS.includes(origLang as (typeof SOURCE_LANGS)[number])) {
    origLang = await detectRecipeLanguage(
      title,
      description ?? (instructions.length ? instructions.join("\n") : null)
    );
  }

  const recipe = await prisma.recipe.create({
    data: {
      userId,
      cookbookId: cookbookId ?? null,
      title,
      description: description ?? null,
      originalLanguage: origLang,
      sourceUrl: sourceUrl ?? null,
      sourceType: sourceType ?? null,
      category,
      isBuiltIn: false,
      prepTimeMinutes: prepTimeMinutes ?? null,
      cookTimeMinutes: cookTimeMinutes ?? null,
      servings: servings ?? null,
      needsReview,
    },
  });

  const instructionsJson = instructions.length > 0 ? JSON.stringify(instructions) : null;
  await prisma.recipeTranslation.create({
    data: {
      recipeId: recipe.id,
      language: origLang,
      title,
      description: description ?? null,
      instructions: instructionsJson,
    },
  });

  const userLocale = await getUserLocale(userId);
  let translatedDisplayNames: { displayName: string }[] = ingList.map((i) => ({
    displayName: i.name,
  }));

  if (userLocale !== origLang && ingList.length > 0) {
    try {
      const translated = await translateRecipe(
        {
          title,
          description: description ?? null,
          instructions,
          ingredients: ingList.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit ?? undefined,
            category: i.category ?? undefined,
            preparation: i.preparation ?? undefined,
          })),
        },
        origLang,
        userLocale as TargetLocale
      );
      translatedDisplayNames = translated.ingredients;
      await prisma.recipeTranslation.create({
        data: {
          recipeId: recipe.id,
          language: userLocale,
          title: translated.title,
          description: translated.description,
          instructions:
            translated.instructions.length > 0
              ? JSON.stringify(translated.instructions)
              : null,
        },
      });
    } catch (err) {
      console.error("Recipe translation failed", err);
    }
  }

  if (Array.isArray(tags) && tags.length) {
    await prisma.recipeTag.createMany({
      data: tags.map((name) => ({ recipeId: recipe.id, name })),
      skipDuplicates: true,
    });
  }

  for (let i = 0; i < ingList.length; i++) {
    const ing = ingList[i];
    const displayName = translatedDisplayNames[i]?.displayName ?? ing.name;
    const ingredient = await getOrCreateIngredient(ing.name, ing.category);
    const translatedDisplayNameJson = buildTranslatedDisplayName(
      null,
      userLocale,
      displayName
    );
    await prisma.recipeIngredient.create({
      data: {
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        quantity: ing.quantity,
        unit: ing.unit ?? null,
        rawLine: ing.rawLine ?? null,
        translatedDisplayName: translatedDisplayNameJson,
      },
    });
  }

  return prisma.recipe.findUnique({
    where: { id: recipe.id },
    include: {
      recipeIngredients: { include: { ingredient: true } },
      tags: true,
      recipeTranslations: true,
    },
  });
}
