import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCookbookPdf } from "@/services/cookbook-pdf";

export const maxDuration = 120;
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

/** POST: Upload PDF cookbook; extract text, detect recipes, parse each. Returns cookbook + parsedRecipes for preview. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "Untitled Cookbook";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 200 MB)" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const cookbookName = name.trim() || (file.name?.replace(/\.pdf$/i, "") || "Cookbook");

    const cookbook = await prisma.cookbook.create({
      data: { userId, name: cookbookName, status: "processing" },
    });

    try {
      const result = await parseCookbookPdf(buffer, cookbookName);
      await prisma.cookbook.update({
        where: { id: cookbook.id },
        data: {
          status: "ready",
          parsedRecipes: JSON.stringify(result.recipes),
        },
      });
      return NextResponse.json({
        cookbookId: cookbook.id,
        name: cookbook.name,
        status: "ready",
        recipes: result.recipes,
        totalDetected: result.totalDetected,
      });
    } catch (e) {
      await prisma.cookbook.update({
        where: { id: cookbook.id },
        data: { status: "failed", errorMessage: e instanceof Error ? e.message : "Parse failed" },
      });
      throw e;
    }
  } catch (e) {
    console.error("cookbooks/upload", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
