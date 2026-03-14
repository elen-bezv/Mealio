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
