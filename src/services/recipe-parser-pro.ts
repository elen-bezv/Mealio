/**
 * AI Recipe Parser Pro: extract structured recipe from URL, image, PDF, or text.
 * Combines HTML scraping, OCR/vision, and AI for maximum accuracy.
 */

import { openai } from "@/lib/openai";
import { fetchPageText } from "@/lib/url-fetch";
import type {
  StructuredRecipe,
  StructuredIngredient,
  ParserWarning,
  ParseRecipeProResult,
} from "@/types";

const STRUCTURE_SYSTEM = `You are an expert recipe parser. Convert the given content into a standardized structured recipe.
Output JSON only, no markdown.

Required fields:
- title (string)
- description (string or null)
- ingredients (array). Each item: name (normalized grocery name), quantity (string, e.g. "2", "1/2"), unit (e.g. "cups", "g", "ml", or null), category (Vegetables|Dairy|Meat|Pantry|Frozen|null), preparation (e.g. "chopped", "diced", or null), rawLine (original text if from source)
- instructions (array of strings, one per step. Clear numbered steps.)
- warnings (optional object): missingQuantities (array of ingredient names), missingUnits (array of ingredient names), missingSteps (boolean), suggested (array of { ingredientIndex (number), ingredientName (string), suggestion (string) } e.g. suggestion "2 cloves" for missing garlic quantity)

Rules:
- Ignore ads, comments, unrelated text. Extract only recipe content.
- Normalize ingredient names. "2 cups chopped tomatoes" -> name "tomatoes", quantity "2", unit "cups", preparation "chopped".
- If quantity or unit is missing, add a suggested value in warnings.suggested and leave quantity/unit as best guess or empty.
- If instructions are missing, set instructions to [] and set warnings.missingSteps true.
- Use metric when reasonable (e.g. 200 ml not "1 cup") but keep original if only option.
- Return ONLY valid JSON.`;

function parseStructuredResponse(raw: string): { recipe: StructuredRecipe; warnings?: ParserWarning } {
  const parsed = JSON.parse(raw) as {
    title: string;
    description?: string | null;
    ingredients: StructuredIngredient[];
    instructions: string[];
    warnings?: ParserWarning;
  };
  return {
    recipe: {
      title: parsed.title || "Untitled Recipe",
      description: parsed.description ?? undefined,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
    },
    warnings: parsed.warnings,
  };
}

export async function parseFromText(
  text: string,
  sourceType: StructuredRecipe["sourceType"] = "text"
): Promise<{ recipe: StructuredRecipe; warnings?: ParserWarning }> {
  const content = text.slice(0, 28000);
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: STRUCTURE_SYSTEM },
      { role: "user", content: `Source: ${sourceType}\n\nContent:\n${content}` },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from parser");
  const out = parseStructuredResponse(raw);
  out.recipe.sourceType = sourceType;
  return out;
}

export async function parseFromUrl(url: string): Promise<{ recipe: StructuredRecipe; warnings?: ParserWarning }> {
  const { text, sourceHint } = await fetchPageText(url);
  const sourceType =
    sourceHint === "instagram" ? "instagram" : sourceHint === "tiktok" ? "tiktok" : "url";
  const out = await parseFromText(text, sourceType);
  out.recipe.sourceUrl = url;
  out.recipe.sourceType = sourceType;
  return out;
}

export async function parseFromImage(
  imageBase64: string,
  mimeType: string
): Promise<{ recipe: StructuredRecipe; warnings?: ParserWarning }> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: STRUCTURE_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          { type: "text", text: "Extract the full recipe from this image (photo, screenshot, or cookbook page). Include title, ingredients with quantities/units/preparation, and step-by-step instructions. If anything is unclear, add it to warnings.suggested." },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from parser");
  const out = parseStructuredResponse(raw);
  out.recipe.sourceType = "image";
  return out;
}

export async function parseFromPdf(pdfBuffer: Buffer): Promise<{ recipe: StructuredRecipe; warnings?: ParserWarning }> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(pdfBuffer);
  const text = (data.text as string)?.slice(0, 28000) || "";
  if (!text.trim()) throw new Error("PDF produced no text");
  const out = await parseFromText(text, "pdf");
  return out;
}

/** Check for duplicate by title (existing user recipe with same or very similar title). */
export function findDuplicateTitle(
  title: string,
  existingTitles: { id: string; title: string }[]
): { id: string; title: string } | null {
  const t = title.trim().toLowerCase();
  for (const r of existingTitles) {
    const rn = r.title.trim().toLowerCase();
    if (rn === t) return r;
    if (rn.includes(t) || t.includes(rn)) return r;
  }
  return null;
}
