import { openai } from "@/lib/openai";
import type { ExtractedIngredient, ParseRecipeResult } from "@/types";

const EXTRACT_SYSTEM = `You are a recipe parser. Extract ingredients from the given recipe content.
Return a JSON object with: title (string), description (string or null), ingredients (array).
Each ingredient must have: name (normalized grocery name), quantity (string e.g. "2", "1/2", "200"), unit (e.g. "cups", "ml", "g", "L" or null), category (one of: Vegetables, Dairy, Meat, Pantry, Frozen, or null), rawLine (original text).
Normalize names: "2 cups milk" -> name "Milk", quantity "2", unit "cups". Use metric when possible (e.g. 200ml not "1 cup").
Return ONLY valid JSON, no markdown.`;

export async function extractIngredientsFromText(
  text: string
): Promise<ParseRecipeResult> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: EXTRACT_SYSTEM },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");
  const parsed = JSON.parse(raw) as {
    title: string;
    description?: string | null;
    ingredients: ExtractedIngredient[];
  };
  return {
    title: parsed.title || "Untitled Recipe",
    description: parsed.description ?? undefined,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
  };
}

export async function extractIngredientsFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ParseRecipeResult> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: EXTRACT_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");
  const parsed = JSON.parse(raw) as {
    title: string;
    description?: string | null;
    ingredients: ExtractedIngredient[];
  };
  return {
    title: parsed.title || "Untitled Recipe",
    description: parsed.description ?? undefined,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
  };
}
