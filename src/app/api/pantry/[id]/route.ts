import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeIngredientName } from "@/lib/ingredient-normalize";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;

  const existing = await prisma.pantryItem.findFirst({
    where: { id, userId: userId! },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { ingredientName, quantity, unit, expirationDate } = body;

  const data: { ingredientName?: string; normalizedIngredientName?: string; quantity?: string; unit?: string | null; expirationDate?: Date | null } = {};
  if (ingredientName !== undefined) {
    data.ingredientName = String(ingredientName).trim();
    data.normalizedIngredientName = normalizeIngredientName(data.ingredientName);
  }
  if (quantity !== undefined) data.quantity = String(quantity);
  if (unit !== undefined) data.unit = unit == null ? null : String(unit);
  if (expirationDate !== undefined) data.expirationDate = expirationDate ? new Date(expirationDate) : null;

  const item = await prisma.pantryItem.update({
    where: { id },
    data,
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;

  const existing = await prisma.pantryItem.findFirst({
    where: { id, userId: userId! },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pantryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
