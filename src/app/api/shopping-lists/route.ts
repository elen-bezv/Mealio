import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createShoppingListFromIngredients } from "@/services/shopping-list";
import type { ExtractedIngredient } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lists = await prisma.shoppingList.findMany({
    where: { userId },
    include: { items: { include: { ingredient: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, mealPlanId, ingredients } = body;

  if (mealPlanId) {
    const plan = await prisma.mealPlan.findFirst({
      where: { id: mealPlanId, userId },
      include: {
        mealPlanRecipes: {
          include: {
            recipe: { include: { recipeIngredients: { include: { ingredient: true } } } },
          },
        },
      },
    });
    if (!plan) return NextResponse.json({ error: "Meal plan not found" }, { status: 404 });

    const allIng: ExtractedIngredient[] = [];
    for (const mpr of plan.mealPlanRecipes) {
      for (const ri of mpr.recipe.recipeIngredients) {
        allIng.push({
          name: ri.ingredient.name,
          quantity: ri.quantity,
          unit: ri.unit ?? undefined,
          category: ri.ingredient.category ?? undefined,
        });
      }
    }
    const list = await createShoppingListFromIngredients(
      userId,
      allIng,
      mealPlanId,
      name ?? `Meal plan: ${plan.name ?? plan.weekStart.toISOString().slice(0, 10)}`,
      { subtractPantry: true }
    );
    return NextResponse.json(list);
  }

  if (Array.isArray(ingredients) && ingredients.length) {
    const list = await createShoppingListFromIngredients(
      userId,
      ingredients as ExtractedIngredient[],
      undefined,
      name ?? "My list",
      { subtractPantry: true }
    );
    return NextResponse.json(list);
  }

  const list = await prisma.shoppingList.create({
    data: { userId, name: name ?? "My list" },
    include: { items: { include: { ingredient: true } } },
  });
  return NextResponse.json(list);
}
