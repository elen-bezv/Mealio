import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPantrySuggestions } from "@/services/pantry-matching";
import type { MergedShoppingItem } from "@/types";

/** GET: Suggestions for a shopping list: "You have X in pantry. Still need it?" query: shoppingListId */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shoppingListId = searchParams.get("shoppingListId");
  if (!shoppingListId) {
    return NextResponse.json({ error: "shoppingListId required" }, { status: 400 });
  }

  const list = await prisma.shoppingList.findFirst({
    where: { id: shoppingListId, userId },
    include: { items: { include: { ingredient: true } } },
  });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  const merged: MergedShoppingItem[] = list.items.map((i) => ({
    name: i.ingredient.name,
    quantity: i.quantity,
    unit: i.unit ?? undefined,
    mergedQuantity: i.mergedQuantity ?? undefined,
    category: i.ingredient.category ?? undefined,
    ingredientIds: [i.ingredientId],
  }));

  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId },
  });

  const suggestions = getPantrySuggestions(
    merged,
    pantryItems.map((p) => ({
      ingredientName: p.ingredientName,
      normalizedIngredientName: p.normalizedIngredientName,
      quantity: p.quantity,
      unit: p.unit,
    }))
  );

  return NextResponse.json({ suggestions });
}
