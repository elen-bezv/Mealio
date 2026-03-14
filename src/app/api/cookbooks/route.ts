import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id;

    const cookbooks = await prisma.cookbook.findMany({
      where: { userId: userId! },
      include: { _count: { select: { recipes: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(cookbooks);
  } catch (e) {
    console.error("cookbooks GET", e);
    return NextResponse.json({ error: "Failed to list cookbooks" }, { status: 500 });
  }
}
