import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const plan = await prisma.mealPlan.findFirst({
    where: { id, userId: (session.user as { id?: string }).id },
    include: { mealPlanRecipes: { include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } } },
    },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;

  const existing = await prisma.mealPlan.findFirst({
    where: { id, userId: userId! },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, weekStart, slots } = body;

  await prisma.mealPlan.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(weekStart !== undefined && { weekStart: new Date(weekStart) }),
    },
  });

  if (Array.isArray(slots)) {
    await prisma.mealPlanRecipe.deleteMany({ where: { mealPlanId: id } });
    await prisma.mealPlanRecipe.createMany({
      data: slots.map((s: { dayOfWeek: number; mealSlot: string; recipeId: string }) => ({
        mealPlanId: id,
        recipeId: s.recipeId,
        dayOfWeek: s.dayOfWeek,
        mealSlot: s.mealSlot,
      })),
    });
  }

  const full = await prisma.mealPlan.findUnique({
    where: { id },
    include: { mealPlanRecipes: { include: { recipe: true } } },
  });
  return NextResponse.json(full);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.mealPlan.findFirst({
    where: { id, userId: (session.user as { id?: string }).id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.mealPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
