/**
 * Cookbook PDF pipeline: extract text → detect recipe boundaries → parse each with Parser Pro.
 * Supports native text PDFs; scanned PDFs need OCR (text extraction may be minimal).
 */

import { openai } from "@/lib/openai";
import { parseFromText } from "./recipe-parser-pro";
import type { StructuredRecipe } from "@/types";

const MAX_PDF_TEXT = 120000;
const MAX_RECIPES_PER_COOKBOOK = 80;
const BOUNDARY_SYSTEM = `You are an expert at analyzing cookbook and recipe collection documents.
Your task: split the raw text into individual recipe sections.

Typical patterns: Recipe title (often bold or on its own line), then ingredient list, then cooking instructions.
Use section headers, "Ingredients" / "Instructions" headings, numbered steps, and recipe title formatting to detect boundaries.

Return JSON only, no markdown:
{
  "recipes": [
    { "title": "Detected recipe title or placeholder", "text": "full raw text for this recipe only" }
  ]
}

Rules:
- Each recipe's "text" must be self-contained (title + ingredients + instructions).
- If the document has no clear recipe structure, return a single recipe with the whole text.
- Prefer over-splitting rather than merging two recipes into one.
- Maximum 80 recipes. If there are more, split the first 80.
- "title" can be extracted from the first line/heading of that section or "Recipe N" if unclear.`;

export interface DetectedRecipeChunk {
  title: string;
  text: string;
}

export interface CookbookParseResult {
  recipes: StructuredRecipe[];
  cookbookName: string;
  totalDetected: number;
}

/** Extract text from PDF (native text). Scanned PDFs may return little text. */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  const text = (data.text as string)?.replace(/\s+/g, " ").trim() || "";
  const pageCount = (data.numpages as number) ?? 0;
  return { text: text.slice(0, MAX_PDF_TEXT), pageCount };
}

/** Use AI to split cookbook text into recipe chunks. */
export async function detectRecipeBoundaries(fullText: string): Promise<DetectedRecipeChunk[]> {
  const chunk = fullText.slice(0, 90000);
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: BOUNDARY_SYSTEM },
      { role: "user", content: `Document text:\n\n${chunk}` },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { recipes?: { title: string; text: string }[] };
  const list = Array.isArray(parsed.recipes) ? parsed.recipes : [];
  return list.slice(0, MAX_RECIPES_PER_COOKBOOK).map((r) => ({
    title: r.title || "Untitled",
    text: (r.text || "").trim(),
  }));
}

/** Parse each detected chunk with Recipe Parser Pro; apply ingredient normalization via existing flow. */
export async function parseCookbookPdf(
  buffer: Buffer,
  cookbookName: string
): Promise<CookbookParseResult> {
  const { text, pageCount } = await extractTextFromPdf(buffer);
  if (!text || text.length < 100) {
    throw new Error(
      "PDF produced no or very little text. If this is a scanned cookbook, OCR support may be required."
    );
  }

  const chunks = await detectRecipeBoundaries(text);
  const recipes: StructuredRecipe[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.text || chunk.text.length < 20) continue;
    try {
      const { recipe } = await parseFromText(chunk.text, "pdf");
      recipe.title = recipe.title || chunk.title || `Recipe ${i + 1}`;
      if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
        recipe.needsReview = true;
      }
      recipes.push(recipe);
    } catch (e) {
      recipes.push({
        title: chunk.title || `Recipe ${i + 1}`,
        ingredients: [],
        instructions: [],
        sourceType: "pdf",
        needsReview: true,
      });
    }
  }

  return {
    recipes,
    cookbookName,
    totalDetected: recipes.length,
  };
}
