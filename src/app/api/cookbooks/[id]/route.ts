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
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;

  const cookbook = await prisma.cookbook.findFirst({
    where: { id, userId: userId! },
    include: { recipes: { include: { recipeIngredients: { include: { ingredient: true } }, tags: true } } },
  });
  if (!cookbook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsedRecipes = cookbook.parsedRecipes ? (JSON.parse(cookbook.parsedRecipes) as unknown[]) : [];
  return NextResponse.json({ ...cookbook, parsedRecipes });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;

  const cookbook = await prisma.cookbook.findFirst({
    where: { id, userId: userId! },
  });
  if (!cookbook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name } = body;
  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const updated = await prisma.cookbook.update({
    where: { id },
    data: { name: name.trim() },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;

  const cookbook = await prisma.cookbook.findFirst({
    where: { id, userId: userId! },
  });
  if (!cookbook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.recipe.updateMany({ where: { cookbookId: id }, data: { cookbookId: null } });
  await prisma.cookbook.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
