import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeIngredientName } from "@/lib/ingredient-normalize";

/** POST: Add shopping list items to pantry. Body: { shoppingListId, itemIds?: string[] }. If itemIds omitted, add all. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { shoppingListId, itemIds } = body;
  if (!shoppingListId) {
    return NextResponse.json({ error: "shoppingListId required" }, { status: 400 });
  }

  const list = await prisma.shoppingList.findFirst({
    where: { id: shoppingListId, userId },
    include: { items: { include: { ingredient: true } } },
  });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  let items = list.items;
  if (Array.isArray(itemIds) && itemIds.length) {
    items = items.filter((i) => itemIds.includes(i.id));
  }

  const added: { id: string; ingredientName: string }[] = [];
  for (const si of items) {
    const name = si.ingredient.name;
    const normalized = normalizeIngredientName(name);
    const qty = si.mergedQuantity ?? `${si.quantity} ${si.unit ?? ""}`.trim();
    const [qtyPart] = qty.split(/\s/);
    await prisma.pantryItem.create({
      data: {
        userId,
        ingredientName: name,
        normalizedIngredientName: normalized,
        quantity: qtyPart ?? si.quantity,
        unit: si.unit,
      },
    });
    added.push({ id: si.id, ingredientName: name });
  }

  return NextResponse.json({ added: added.length, items: added });
}
