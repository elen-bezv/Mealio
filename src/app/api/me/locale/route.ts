import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID = ["uk", "en", "he"] as const;

/** PATCH: Update current user locale. Body: { locale: "uk" | "en" | "he" }. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  const body = await req.json();
  const locale = body.locale;
  if (!locale || !VALID.includes(locale)) {
    return NextResponse.json({ error: "locale must be uk, en, or he" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: userId! },
    data: { locale },
  });
  return NextResponse.json({ locale });
}
