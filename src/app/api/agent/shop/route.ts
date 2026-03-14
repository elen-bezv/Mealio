import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptSessionData } from "@/lib/encryption";
import { runShoppingAgent } from "@/agent/run";
import { getCanonicalKey } from "@/lib/ingredient-normalize";
import { subtractPantryFromMerged } from "@/services/pantry-matching";
import type { MergedShoppingItem } from "@/types";

/**
 * POST: Run the grocery shopping agent for a given store and shopping list.
 * Body: { storeConnectionId, shoppingListId }
 * Persists per-item status (FOUND / NOT_FOUND / UNCERTAIN) and returns Missing Items Report.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;

  const body = await req.json();
  const { storeConnectionId, shoppingListId } = body;
  if (!storeConnectionId || !shoppingListId) {
    return NextResponse.json(
      { error: "storeConnectionId and shoppingListId required" },
      { status: 400 }
    );
  }

  const conn = await prisma.storeConnection.findFirst({
    where: { id: storeConnectionId, userId: userId! },
  });
  if (!conn) return NextResponse.json({ error: "Store connection not found" }, { status: 404 });

  const list = await prisma.shoppingList.findFirst({
    where: { id: shoppingListId, userId: userId! },
    include: { items: { include: { ingredient: true } } },
  });
  if (!list) return NextResponse.json({ error: "Shopping list not found" }, { status: 404 });

  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId: userId! },
  });

  const merged: MergedShoppingItem[] = list.items.map((i) => ({
    name: i.ingredient.name,
    quantity: i.quantity,
    unit: i.unit ?? undefined,
    mergedQuantity: i.mergedQuantity ?? undefined,
    category: i.ingredient.category ?? undefined,
    ingredientIds: [i.ingredientId],
  }));

  const { adjusted } = subtractPantryFromMerged(
    merged,
    pantryItems.map((p) => ({
      ingredientName: p.ingredientName,
      normalizedIngredientName: p.normalizedIngredientName,
      quantity: p.quantity,
      unit: p.unit,
    }))
  );

  const items = adjusted.map((adj) => {
    const listItem = list.items.find(
      (li) => getCanonicalKey(li.ingredient.name) === getCanonicalKey(adj.name)
    );
    if (!listItem) return null;
    return {
      id: listItem.id,
      name: (listItem as { alternativeSearchQuery?: string | null }).alternativeSearchQuery ?? adj.name,
      quantity: adj.quantity,
      unit: adj.unit ?? undefined,
    };
  }).filter(Boolean) as { id: string; name: string; quantity: string; unit?: string }[];

  let sessionData: unknown;
  try {
    sessionData = JSON.parse(await decryptSessionData(conn.encryptedSessionData));
  } catch {
    return NextResponse.json(
      { error: "Invalid stored session; please reconnect the store" },
      { status: 400 }
    );
  }

  try {
    const result = await runShoppingAgent(conn.storeKey, sessionData, items);

    const allResults = [
      ...result.report.added,
      ...result.report.notFound,
      ...result.report.uncertain,
    ];
    for (const r of allResults) {
      await prisma.shoppingListItem.update({
        where: { id: r.itemId },
        data: {
          status: r.status,
          matchedProductName: r.matchedProductName ?? null,
          storeName: r.storeName,
        },
      });
    }

    await prisma.storeConnection.update({
      where: { id: conn.id },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("agent/shop", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Agent failed" },
      { status: 500 }
    );
  }
}
