import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSessionData } from "@/lib/encryption";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const connections = await prisma.storeConnection.findMany({
    where: { userId: userId! },
    select: {
      id: true,
      storeKey: true,
      displayName: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(connections);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const body = await req.json();
  const { storeKey, displayName, sessionData } = body; // sessionData = serialized cookies/tokens (from agent after user logs in)
  if (!storeKey || !sessionData) {
    return NextResponse.json({ error: "storeKey and sessionData required" }, { status: 400 });
  }

  const encrypted = await encryptSessionData(
    typeof sessionData === "string" ? sessionData : JSON.stringify(sessionData)
  );

  const conn = await prisma.storeConnection.upsert({
    where: {
      userId_storeKey: { userId: userId!, storeKey },
    },
    create: {
      userId: userId!,
      storeKey,
      displayName: displayName ?? storeKey,
      encryptedSessionData: encrypted,
    },
    update: {
      displayName: displayName ?? undefined,
      encryptedSessionData: encrypted,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({
    id: conn.id,
    storeKey: conn.storeKey,
    displayName: conn.displayName,
  });
}
