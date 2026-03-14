import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseFromText,
  parseFromUrl,
  parseFromImage,
  parseFromPdf,
  findDuplicateTitle,
} from "@/services/recipe-parser-pro";
import type { ParseRecipeProResult } from "@/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") ?? "";
    let result: ParseRecipeProResult;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { type, url, text } = body as {
        type?: "url" | "instagram" | "tiktok" | "image" | "pdf" | "text";
        url?: string;
        text?: string;
      };

      if (url && (type === "url" || type === "instagram" || type === "tiktok" || !type)) {
        const parsed = await parseFromUrl(url);
        result = { recipe: parsed.recipe, warnings: parsed.warnings };
      } else if (text) {
        const sourceType = type === "url" ? "text" : type ?? "text";
        const parsed = await parseFromText(text, sourceType);
        result = { recipe: parsed.recipe, warnings: parsed.warnings };
      } else {
        return NextResponse.json(
          { error: "Provide url or text in JSON body" },
          { status: 400 }
        );
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const text = formData.get("text") as string | null;
      const url = formData.get("url") as string | null;
      const type = (formData.get("type") as string) || "text";

      if (file) {
        const buf = await file.arrayBuffer();
        const buffer = Buffer.from(buf);
        const mime = (file.type || "").toLowerCase();

        if (mime === "application/pdf") {
          const parsed = await parseFromPdf(buffer);
          result = { recipe: parsed.recipe, warnings: parsed.warnings };
        } else {
          const base64 = buffer.toString("base64");
          const mimeType = mime || "image/png";
          const parsed = await parseFromImage(base64, mimeType);
          result = { recipe: parsed.recipe, warnings: parsed.warnings };
        }
      } else if (url) {
        const parsed = await parseFromUrl(url);
        result = { recipe: parsed.recipe, warnings: parsed.warnings };
      } else if (text) {
        const parsed = await parseFromText(text, type as "text");
        result = { recipe: parsed.recipe, warnings: parsed.warnings };
      } else {
        return NextResponse.json(
          { error: "Provide file, url, or text" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Use application/json or multipart/form-data" },
        { status: 400 }
      );
    }

    const existing = await prisma.recipe.findMany({
      where: { userId, isBuiltIn: false },
      select: { id: true, title: true },
    });
    const duplicate = findDuplicateTitle(result.recipe.title, existing);
    if (duplicate) {
      result.duplicateRecipeId = duplicate.id;
      result.duplicateRecipeTitle = duplicate.title;
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("parse-recipe-pro", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 500 }
    );
  }
}
