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
  toApiResult,
} from "@/services/recipe-parser-pro";
import { normalizeUrl } from "@/lib/import-utils";
import type { ParseRecipeProResult, ParseStatus } from "@/types";

export const maxDuration = 60;

function importLogger(importId: string) {
  return (msg: string, data?: Record<string, unknown>) => {
    console.log(`[recipe-import ${importId}] ${msg}`, data ?? "");
  };
}

export async function POST(req: NextRequest) {
  const importId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const log = importLogger(importId);

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

      if (url != null && String(url).trim()) {
        const rawUrl = String(url).trim();
        const normalized = normalizeUrl(rawUrl);
        if (!normalized) {
          log("invalid URL", { rawUrl: rawUrl.slice(0, 100) });
          return NextResponse.json(
            { error: "Invalid URL provided." },
            { status: 400 }
          );
        }
        log("submitted URL", { normalized, sourceType: body.type });
        try {
          const parsed = await parseFromUrl(normalized, log);
          const existing = await prisma.recipe.findMany({
            where: { userId, isBuiltIn: false },
            select: { id: true, title: true },
          });
          const duplicate = findDuplicateTitle(parsed.recipe.title, existing);
          result = toApiResult(parsed, duplicate, log);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Recipe import failed.";
          log("parseFromUrl error", { error: message });
          result = {
            recipe: {
              title: "",
              description: undefined,
              ingredients: [],
              instructions: [],
              sourceType: "url",
            },
            parseStatus: "failed",
            confidence: "low",
            errorMessage: message,
            sourceType: "url",
          };
        }
      } else if (text != null && String(text).trim()) {
        const sourceType = (type === "url" ? "text" : type) ?? "text";
        log("parse text", { textLength: String(text).trim().length, sourceType });
        const parsed = await parseFromText(String(text).trim(), sourceType as "text", log);
        const existing = await prisma.recipe.findMany({
          where: { userId, isBuiltIn: false },
          select: { id: true, title: true },
        });
        const duplicate = findDuplicateTitle(parsed.recipe.title, existing);
        result = toApiResult(parsed, duplicate, log);
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

      const existing = await prisma.recipe.findMany({
        where: { userId, isBuiltIn: false },
        select: { id: true, title: true },
      });

      if (file) {
        const buf = await file.arrayBuffer();
        const buffer = Buffer.from(buf);
        const mime = (file.type || "").toLowerCase();
        log("parse file", { mime, size: buffer.length });

        if (mime === "application/pdf") {
          try {
            const parsed = await parseFromPdf(buffer, log);
            const duplicate = findDuplicateTitle(parsed.recipe.title, existing);
            result = toApiResult(parsed, duplicate, log);
          } catch (e) {
            const message = e instanceof Error ? e.message : "PDF parse failed.";
            log("parseFromPdf error", { error: message });
            result = {
              recipe: { title: "", description: undefined, ingredients: [], instructions: [], sourceType: "pdf" },
              parseStatus: "failed",
              confidence: "low",
              errorMessage: message,
              sourceType: "pdf",
            };
          }
        } else {
          const base64 = buffer.toString("base64");
          const mimeType = mime || "image/png";
          const parsed = await parseFromImage(base64, mimeType, log);
          const duplicate = findDuplicateTitle(parsed.recipe.title, existing);
          result = toApiResult(parsed, duplicate, log);
        }
      } else if (url != null && String(url).trim()) {
        const rawUrl = String(url).trim();
        const normalized = normalizeUrl(rawUrl);
        if (!normalized) {
          return NextResponse.json(
            { error: "Invalid URL provided." },
            { status: 400 }
          );
        }
        try {
          const parsed = await parseFromUrl(normalized, log);
          const duplicate = findDuplicateTitle(parsed.recipe.title, existing);
          result = toApiResult(parsed, duplicate, log);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Recipe import failed.";
          result = {
            recipe: { title: "", description: undefined, ingredients: [], instructions: [], sourceType: "url" },
            parseStatus: "failed",
            confidence: "low",
            errorMessage: message,
            sourceType: "url",
          };
        }
      } else if (text != null && String(text).trim()) {
        const parsed = await parseFromText(String(text).trim(), (type as "text") || "text", log);
        const duplicate = findDuplicateTitle(parsed.recipe.title, existing);
        result = toApiResult(parsed, duplicate, log);
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

    log("response", { parseStatus: result.parseStatus, errorMessage: result.errorMessage ?? undefined });
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[recipe-import ${importId}]`, e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Parse failed",
        parseStatus: "failed" as ParseStatus,
        recipe: {
          title: "",
          description: undefined,
          ingredients: [],
          instructions: [],
        },
        errorMessage: e instanceof Error ? e.message : "Parse failed",
      },
      { status: 500 }
    );
  }
}
