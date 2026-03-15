/**
 * One-time backfill: ensure every Recipe has at least one RecipeCategoryAssignment (OTHER).
 * Run with: npx tsx prisma/backfill-recipe-categories.ts
 * Use this if recipes are missing from the list because they have no category assignments
 * (e.g. after db push without running the multi-category migration).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const recipesWithoutCategories = await prisma.recipe.findMany({
    where: {
      recipeCategories: { none: {} },
    },
    select: { id: true },
  });

  if (recipesWithoutCategories.length === 0) {
    console.log("All recipes already have at least one category. Nothing to do.");
    return;
  }

  console.log(`Found ${recipesWithoutCategories.length} recipe(s) without category assignments. Adding OTHER...`);

  for (const recipe of recipesWithoutCategories) {
    await prisma.recipeCategoryAssignment.create({
      data: { recipeId: recipe.id, category: "OTHER" },
    });
  }

  console.log(`Done. Added OTHER category to ${recipesWithoutCategories.length} recipe(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
