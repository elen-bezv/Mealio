/**
 * AI Recipe Parser Pro: extract structured recipe from URL, image, PDF, or text.
 * Returns strict parseStatus (success | partial | failed) and never treats empty parse as success.
 */

import { openai } from "@/lib/openai";
import { fetchPageText } from "@/lib/url-fetch";
import {
  isMeaningfulTitle,
  hasMeaningfulIngredients,
  hasMeaningfulInstructions,
  isRecipeMeaningful,
  normalizeUrl,
  detectSourceType,
} from "@/lib/import-utils";
import type {
  StructuredRecipe,
  StructuredIngredient,
  ParserWarning,
  ParseStatus,
  ParseRecipeProResult,
} from "@/types";

const STRUCTURE_SYSTEM = `You are an expert recipe parser. Convert the given content into a standardized structured recipe.
Output JSON only, no markdown.

Required fields:
- title (string, or null if not found)
- description (string or null)
- ingredients (array). Each item: name (normalized grocery name), quantity (string, e.g. "2", "1/2"), unit (e.g. "cups", "g", "ml", or null), category (Vegetables|Dairy|Meat|Pantry|Frozen|null), preparation (e.g. "chopped", "diced", or null), rawLine (original text if from source)
- instructions (array of strings, one per step. Clear numbered steps.)
- warnings (optional object): missingQuantities (array of ingredient names), missingUnits (array of ingredient names), missingSteps (boolean), suggested (array of { ingredientIndex (number), ingredientName (string), suggestion (string) } e.g. suggestion "2 cloves" for missing garlic quantity)

Rules:
- Ignore ads, comments, unrelated text. Extract only recipe content.
- If no recipe content is present, return title null, ingredients [], instructions [].
- Normalize ingredient names. "2 cups chopped tomatoes" -> name "tomatoes", quantity "2", unit "cups", preparation "chopped".
- If quantity or unit is missing, add a suggested value in warnings.suggested and leave quantity/unit as best guess or empty.
- If instructions are missing, set instructions to [] and set warnings.missingSteps true.
- Use metric when reasonable (e.g. 200 ml not "1 cup") but keep original if only option.
- Return ONLY valid JSON.`;

export type ParserResult = {
  recipe: StructuredRecipe;
  warnings?: ParserWarning;
  parseStatus: ParseStatus;
  confidence: "high" | "medium" | "low";
  errorMessage: string | null;
  sourceType?: string;
};

function parseStructuredResponse(raw: string, log?: (msg: string, data?: Record<string, unknown>) => void): ParserResult {
  const logMsg = (msg: string, data?: Record<string, unknown>) => log?.("[parseStructuredResponse] " + msg, data);

  let parsed: {
    title?: string | null;
    description?: string | null;
    ingredients?: StructuredIngredient[];
    instructions?: string[];
    warnings?: ParserWarning;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch (e) {
    logMsg("invalid JSON", { error: String(e) });
    return {
      recipe: {
        title: "",
        description: undefined,
        ingredients: [],
        instructions: [],
        sourceType: "text",
      },
      parseStatus: "failed",
      confidence: "low",
      errorMessage: "The AI parser returned invalid data.",
      sourceType: "text",
    };
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  const instructions = Array.isArray(parsed.instructions) ? parsed.instructions : [];

  const recipe: StructuredRecipe = {
    title: isMeaningfulTitle(title) ? title : "",
    description: parsed.description != null ? String(parsed.description).trim() || undefined : undefined,
    ingredients,
    instructions,
    sourceType: "text",
  };

  const hasTitle = isMeaningfulTitle(recipe.title);
  const hasIng = hasMeaningfulIngredients(recipe.ingredients);
  const hasInstr = hasMeaningfulInstructions(recipe.instructions);

  let parseStatus: ParseStatus = "success";
  let confidence: "high" | "medium" | "low" = "high";
  let errorMessage: string | null = null;

  if (!hasTitle && !hasIng && !hasInstr) {
    parseStatus = "failed";
    confidence = "low";
    errorMessage = "The AI parser returned incomplete data.";
    logMsg("empty parse", { title: recipe.title, ingredientsCount: ingredients.length, instructionsCount: instructions.length });
  } else if (!hasIng && hasInstr) {
    parseStatus = "partial";
    confidence = "medium";
    errorMessage = "Ingredients could not be extracted; you can add them after saving.";
    logMsg("partial: instructions only");
  } else if (hasIng && !hasInstr) {
    parseStatus = "partial";
    confidence = "medium";
    errorMessage = "Instructions could not be extracted; you may add them after saving.";
    logMsg("partial: ingredients only");
  } else if (!hasTitle && (hasIng || hasInstr)) {
    parseStatus = "partial";
    confidence = "medium";
    recipe.title = "Untitled Recipe";
    logMsg("partial: no title");
  }

  if (parseStatus === "success" && !hasTitle && (hasIng || hasInstr)) {
    recipe.title = "Untitled Recipe";
  }

  return {
    recipe,
    warnings: parsed.warnings,
    parseStatus,
    confidence,
    errorMessage,
    sourceType: "text",
  };
}

export async function parseFromText(
  text: string,
  sourceType: StructuredRecipe["sourceType"] = "text",
  log?: (msg: string, data?: Record<string, unknown>) => void
): Promise<ParserResult> {
  const logMsg = (msg: string, data?: Record<string, unknown>) => log?.("[parseFromText] " + msg, data);
  const content = text.slice(0, 28000);
  logMsg("calling AI", { contentLength: content.length, sourceType });

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: STRUCTURE_SYSTEM },
      { role: "user", content: `Source: ${sourceType}\n\nContent:\n${content}` },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) {
    logMsg("no AI response");
    return {
      recipe: { title: "", description: undefined, ingredients: [], instructions: [], sourceType },
      parseStatus: "failed",
      confidence: "low",
      errorMessage: "No response from parser.",
      sourceType,
    };
  }
  logMsg("AI raw length", { length: raw.length });
  const out = parseStructuredResponse(raw, log);
  out.recipe.sourceType = sourceType;
  out.sourceType = sourceType;
  return out;
}

export async function parseFromUrl(
  url: string,
  log?: (msg: string, data?: Record<string, unknown>) => void
): Promise<ParserResult> {
  const logMsg = (msg: string, data?: Record<string, unknown>) => log?.("[parseFromUrl] " + msg, data);

  const normalized = normalizeUrl(url);
  if (!normalized) {
    logMsg("invalid URL", { url: url.slice(0, 80) });
    throw new Error("Invalid URL provided.");
  }
  const sourceType = detectSourceType(normalized);
  logMsg("normalized", { normalized: normalized.slice(0, 80), sourceType });

  const { text, sourceHint } = await fetchPageText(normalized, log);
  const hint = sourceHint === "instagram" ? "instagram" : sourceHint === "tiktok" ? "tiktok" : "url";
  logMsg("fetchPageText done", { textLength: text.length, sourceHint: hint });

  const out = await parseFromText(text, hint, log);
  out.recipe.sourceUrl = normalized;
  out.recipe.sourceType = hint;
  out.sourceType = hint;
  return out;
}

export async function parseFromImage(
  imageBase64: string,
  mimeType: string,
  log?: (msg: string, data?: Record<string, unknown>) => void
): Promise<ParserResult> {
  const logMsg = (msg: string, data?: Record<string, unknown>) => log?.("[parseFromImage] " + msg, data);
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
  if (!raw) {
    logMsg("no AI response");
    return {
      recipe: { title: "", description: undefined, ingredients: [], instructions: [], sourceType: "image" },
      parseStatus: "failed",
      confidence: "low",
      errorMessage: "No response from parser.",
      sourceType: "image",
    };
  }
  const out = parseStructuredResponse(raw, log);
  out.recipe.sourceType = "image";
  out.sourceType = "image";
  return out;
}

export async function parseFromPdf(
  pdfBuffer: Buffer,
  log?: (msg: string, data?: Record<string, unknown>) => void
): Promise<ParserResult> {
  const logMsg = (msg: string, data?: Record<string, unknown>) => log?.("[parseFromPdf] " + msg, data);
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(pdfBuffer);
  const text = (data.text as string)?.slice(0, 28000) || "";
  if (!text.trim()) {
    logMsg("no text from PDF");
    throw new Error("PDF produced no text");
  }
  logMsg("PDF text length", { length: text.length });
  return parseFromText(text, "pdf", log);
}

/** Build full API result and enforce strict success rule (no empty recipe as success). */
export function toApiResult(
  parsed: ParserResult,
  duplicate: { id: string; title: string } | null,
  log?: (msg: string, data?: Record<string, unknown>) => void
): ParseRecipeProResult {
  const logMsg = (msg: string, data?: Record<string, unknown>) => log?.("[toApiResult] " + msg, data);
  let { parseStatus, errorMessage, recipe } = parsed;

  if (parseStatus !== "failed" && !isRecipeMeaningful(recipe)) {
    logMsg("overriding to failed: not meaningful");
    parseStatus = "failed";
    errorMessage = "Recipe import failed. Please try another source or paste the recipe text directly.";
  }

  const result: ParseRecipeProResult = {
    recipe,
    warnings: parsed.warnings,
    duplicateRecipeId: duplicate?.id,
    duplicateRecipeTitle: duplicate?.title,
    parseStatus,
    confidence: parsed.confidence,
    errorMessage: errorMessage ?? null,
    sourceType: parsed.sourceType,
  };
  logMsg("final result", { parseStatus, hasTitle: !!recipe.title, ingredientsCount: recipe.ingredients?.length ?? 0, instructionsCount: recipe.instructions?.length ?? 0 });
  return result;
}

/** Check for duplicate by title (existing user recipe with same or very similar title). */
export function findDuplicateTitle(
  title: string,
  existingTitles: { id: string; title: string }[]
): { id: string; title: string } | null {
  const t = title.trim().toLowerCase();
  if (!t) return null;
  for (const r of existingTitles) {
    const rn = r.title.trim().toLowerCase();
    if (rn === t) return r;
    if (rn.includes(t) || t.includes(rn)) return r;
  }
  return null;
}
