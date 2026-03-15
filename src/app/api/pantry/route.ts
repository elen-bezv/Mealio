import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeIngredientName } from "@/lib/ingredient-normalize";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.pantryItem.findMany({
    where: { userId },
    orderBy: { lastUpdated: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ingredientName, quantity, unit, expirationDate } = body;
  if (!ingredientName || quantity === undefined) {
    return NextResponse.json(
      { error: "ingredientName and quantity required" },
      { status: 400 }
    );
  }

  const normalized = normalizeIngredientName(String(ingredientName).trim());
  const item = await prisma.pantryItem.create({
    data: {
      userId,
      ingredientName: String(ingredientName).trim(),
      normalizedIngredientName: normalized,
      quantity: String(quantity),
      unit: unit != null ? String(unit) : null,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
    },
  });
  return NextResponse.json(item);
}

/** DELETE: bulk delete by ids. Body: { ids: string[] }. Only deletes items belonging to the current user. */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids array required and must not be empty" }, { status: 400 });
  }

  const deleted = await prisma.pantryItem.deleteMany({
    where: { id: { in: ids }, userId },
  });
  return NextResponse.json({ ok: true, deleted: deleted.count });
}
