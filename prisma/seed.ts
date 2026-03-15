import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BUILT_IN_RECIPES = [
  {
    title: "Avocado Toast",
    description: "Simple and healthy breakfast.",
    category: "BREAKFAST" as const,
    ingredients: [
      { name: "Bread", quantity: "2", unit: "slices", category: "Pantry" },
      { name: "Avocado", quantity: "1", unit: null, category: "Vegetables" },
      { name: "Lemon juice", quantity: "1", unit: "tbsp", category: "Pantry" },
      { name: "Salt", quantity: "1", unit: "pinch", category: "Pantry" },
    ],
  },
  {
    title: "Chicken Salad",
    description: "Light lunch with greens and grilled chicken.",
    category: "LUNCH" as const,
    ingredients: [
      { name: "Chicken breast", quantity: "200", unit: "g", category: "Meat" },
      { name: "Mixed greens", quantity: "100", unit: "g", category: "Vegetables" },
      { name: "Cherry tomatoes", quantity: "6", unit: null, category: "Vegetables" },
      { name: "Olive oil", quantity: "2", unit: "tbsp", category: "Pantry" },
    ],
  },
  {
    title: "Pasta with Tomato Sauce",
    description: "Classic dinner.",
    category: "DINNER" as const,
    ingredients: [
      { name: "Pasta", quantity: "400", unit: "g", category: "Pantry" },
      { name: "Tomatoes", quantity: "4", unit: null, category: "Vegetables" },
      { name: "Garlic", quantity: "2", unit: "cloves", category: "Vegetables" },
      { name: "Olive oil", quantity: "3", unit: "tbsp", category: "Pantry" },
      { name: "Basil", quantity: "1", unit: "handful", category: "Vegetables" },
    ],
  },
  {
    title: "Chocolate Brownies",
    description: "Dessert.",
    category: "DESSERT" as const,
    ingredients: [
      { name: "Butter", quantity: "200", unit: "g", category: "Dairy" },
      { name: "Sugar", quantity: "200", unit: "g", category: "Pantry" },
      { name: "Eggs", quantity: "3", unit: null, category: "Dairy" },
      { name: "Flour", quantity: "100", unit: "g", category: "Pantry" },
      { name: "Cocoa powder", quantity: "50", unit: "g", category: "Pantry" },
    ],
  },
];

async function main() {
  for (const r of BUILT_IN_RECIPES) {
    let rec = await prisma.recipe.findFirst({
      where: { title: r.title, isBuiltIn: true },
    });
    if (!rec) {
      rec = await prisma.recipe.create({
        data: {
          title: r.title,
          description: r.description,
          isBuiltIn: true,
        },
      });
      await prisma.recipeCategoryAssignment.create({
        data: { recipeId: rec.id, category: r.category },
      });
    }

    await prisma.recipeIngredient.deleteMany({ where: { recipeId: rec.id } });
    for (const ing of r.ingredients) {
      let ingredient = await prisma.ingredient.findFirst({
        where: { name: ing.name },
      });
      if (!ingredient) {
        ingredient = await prisma.ingredient.create({
          data: { name: ing.name, category: ing.category, canonicalName: ing.name },
        });
      }
      await prisma.recipeIngredient.create({
        data: {
          recipeId: rec.id,
          ingredientId: ingredient.id,
          quantity: ing.quantity,
          unit: ing.unit,
        },
      });
    }
  }
  console.log("Seed: built-in recipes created.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
