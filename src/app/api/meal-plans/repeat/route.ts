import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST: Duplicate a meal plan for a new week.
 * Body: { sourcePlanId: string, newWeekStart?: string (ISO) }
 * If newWeekStart is omitted, uses the Monday of next week.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { sourcePlanId, newWeekStart: newWeekStartStr } = body;
  if (!sourcePlanId || typeof sourcePlanId !== "string") {
    return NextResponse.json({ error: "sourcePlanId required" }, { status: 400 });
  }

  const source = await prisma.mealPlan.findFirst({
    where: { id: sourcePlanId, userId },
    include: { mealPlanRecipes: true },
  });
  if (!source) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  let newWeekStart: Date;
  if (newWeekStartStr) {
    newWeekStart = new Date(newWeekStartStr);
    if (Number.isNaN(newWeekStart.getTime())) {
      return NextResponse.json({ error: "Invalid newWeekStart" }, { status: 400 });
    }
  } else {
    const nextMonday = new Date(source.weekStart);
    nextMonday.setDate(nextMonday.getDate() + 7);
    newWeekStart = nextMonday;
  }

  const plan = await prisma.mealPlan.create({
    data: {
      userId,
      name: source.name ? `${source.name} (copy)` : null,
      weekStart: newWeekStart,
    },
  });

  if (source.mealPlanRecipes.length > 0) {
    await prisma.mealPlanRecipe.createMany({
      data: source.mealPlanRecipes.map((r) => ({
        mealPlanId: plan.id,
        recipeId: r.recipeId,
        dayOfWeek: r.dayOfWeek,
        mealSlot: r.mealSlot,
      })),
    });
  }

  const full = await prisma.mealPlan.findUnique({
    where: { id: plan.id },
    include: { mealPlanRecipes: { include: { recipe: true } } },
  });
  return NextResponse.json(full);
}
