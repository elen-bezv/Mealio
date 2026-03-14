import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    include: {
      mealPlanRecipes: { include: { recipe: true } },
    },
    orderBy: { weekStart: "desc" },
  });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, weekStart, slots } = body; // slots: { dayOfWeek, mealSlot, recipeId }[]
  const start = weekStart ? new Date(weekStart) : getWeekStart();

  const plan = await prisma.mealPlan.create({
    data: { userId, name: name ?? null, weekStart: start },
  });

  if (Array.isArray(slots)) {
    await prisma.mealPlanRecipe.createMany({
      data: slots.map((s: { dayOfWeek: number; mealSlot: string; recipeId: string }) => ({
        mealPlanId: plan.id,
        recipeId: s.recipeId,
        dayOfWeek: s.dayOfWeek,
        mealSlot: s.mealSlot,
      })),
      skipDuplicates: true,
    });
  }

  const full = await prisma.mealPlan.findUnique({
    where: { id: plan.id },
    include: { mealPlanRecipes: { include: { recipe: true } } },
  });
  return NextResponse.json(full);
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
