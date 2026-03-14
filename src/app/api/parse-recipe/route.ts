import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractIngredientsFromText, extractIngredientsFromImage } from "@/services/ingredient-extraction";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let result;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { text, url } = body;
      if (url) {
        const fetchRes = await fetch(url);
        const html = await fetchRes.text();
        const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        result = await extractIngredientsFromText(textContent.slice(0, 15000));
      } else if (text) {
        result = await extractIngredientsFromText(text);
      } else {
        return NextResponse.json({ error: "Provide text or url" }, { status: 400 });
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const text = formData.get("text") as string | null;
      if (file) {
        const buf = await file.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        const mime = file.type || "image/png";
        result = await extractIngredientsFromImage(base64, mime);
      } else if (text) {
        result = await extractIngredientsFromText(text);
      } else {
        return NextResponse.json({ error: "Provide file or text" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Unsupported content-type" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("parse-recipe", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 500 }
    );
  }
}
