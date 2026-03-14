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

  const list = await prisma.shoppingList.findFirst({
    where: { id, userId: userId! },
    include: { items: { include: { ingredient: true } } },
  });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(list);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;

  const existing = await prisma.shoppingList.findFirst({
    where: { id, userId: userId! },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, itemId, checked, alternativeSearchQuery } = body;

  if (name !== undefined) {
    await prisma.shoppingList.update({
      where: { id },
      data: { name },
    });
  }
  if (itemId !== undefined && typeof checked === "boolean") {
    await prisma.shoppingListItem.updateMany({
      where: { id: itemId, shoppingListId: id },
      data: { checked },
    });
  }
  if (itemId !== undefined && alternativeSearchQuery !== undefined) {
    await prisma.shoppingListItem.updateMany({
      where: { id: itemId, shoppingListId: id },
      data: { alternativeSearchQuery: alternativeSearchQuery === "" ? null : alternativeSearchQuery },
    });
  }

  const list = await prisma.shoppingList.findUnique({
    where: { id },
    include: { items: { include: { ingredient: true } } },
  });
  return NextResponse.json(list);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const { id } = await params;
  const existing = await prisma.shoppingList.findFirst({
    where: { id, userId: userId! },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.shoppingList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
