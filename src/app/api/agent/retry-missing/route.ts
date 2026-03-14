import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptSessionData } from "@/lib/encryption";
import { runShoppingAgent } from "@/agent/run";

/**
 * POST: Retry missing/uncertain items only. Tries alternative names and optional different store.
 * Body: { storeConnectionId?, shoppingListId, itemIds? }
 * If itemIds omitted, retries all items with status NOT_FOUND or UNCERTAIN.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;

  const body = await req.json();
  const { storeConnectionId, shoppingListId, itemIds } = body;
  if (!shoppingListId) {
    return NextResponse.json({ error: "shoppingListId required" }, { status: 400 });
  }

  const connId = storeConnectionId;
  if (!connId) return NextResponse.json({ error: "storeConnectionId required" }, { status: 400 });

  const conn = await prisma.storeConnection.findFirst({
    where: { id: connId, userId: userId! },
  });
  if (!conn) return NextResponse.json({ error: "Store connection not found" }, { status: 404 });

  const list = await prisma.shoppingList.findFirst({
    where: { id: shoppingListId, userId: userId! },
    include: { items: { include: { ingredient: true } } },
  });
  if (!list) return NextResponse.json({ error: "Shopping list not found" }, { status: 404 });

  const toRetry = list.items.filter(
    (i) =>
      (i.status === "NOT_FOUND" || i.status === "UNCERTAIN") &&
      (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.includes(i.id))
  );
  if (toRetry.length === 0) {
    return NextResponse.json({
      success: true,
      addedCount: 0,
      report: { added: [], notFound: [], uncertain: [], storeName: conn.displayName ?? conn.storeKey, storeKey: conn.storeKey },
      message: "No missing items to retry.",
    });
  }

  let sessionData: unknown;
  try {
    sessionData = JSON.parse(await decryptSessionData(conn.encryptedSessionData));
  } catch {
    return NextResponse.json(
      { error: "Invalid stored session; please reconnect the store" },
      { status: 400 }
    );
  }

  const items = toRetry.map((i) => ({
    id: i.id,
    name: (i as { alternativeSearchQuery?: string | null }).alternativeSearchQuery ?? i.ingredient.name,
    quantity: i.quantity,
    unit: i.unit ?? undefined,
  }));

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
          retryCount: { increment: 1 },
        },
      });
    }

    await prisma.storeConnection.update({
      where: { id: conn.id },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("agent/retry-missing", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Retry failed" },
      { status: 500 }
    );
  }
}
