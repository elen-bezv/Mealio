/**
 * AI recipe translation: detect language and translate with cooking terminology.
 * Preserves quantities, units (tbsp, tsp, cup, cloves, etc.), and structure.
 */

import { openai } from "@/lib/openai";
import type { StructuredRecipe, StructuredIngredient } from "@/types";
import { APP_LOCALES } from "@/lib/constants";

export const SUPPORTED_SOURCE_LANGS = ["en", "uk", "he", "ru", "es", "fr", "it"] as const;
export const TARGET_LOCALES = APP_LOCALES;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

export interface TranslatedRecipe {
  title: string;
  description: string | null;
  instructions: string[];
  ingredients: { displayName: string; preparation: string | null }[];
}

const DETECT_SYSTEM = `You detect the language of the given recipe text. Reply with exactly one ISO 639-1 code: en, uk, he, ru, es, fr, or it. Use "en" for English, "uk" for Ukrainian, "he" for Hebrew, "ru" for Russian, "es" for Spanish, "fr" for French, "it" for Italian. Reply with only the code, nothing else.`;

export async function detectRecipeLanguage(
  title: string,
  descriptionOrInstructions?: string | null
): Promise<string> {
  const text = [title, descriptionOrInstructions].filter(Boolean).join("\n");
  if (!text.trim()) return "en";
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: DETECT_SYSTEM },
      { role: "user", content: text.slice(0, 4000) },
    ],
  });
  const code = (res.choices[0]?.message?.content ?? "en").trim().toLowerCase();
  return SUPPORTED_SOURCE_LANGS.includes(code as (typeof SUPPORTED_SOURCE_LANGS)[number])
    ? code
    : "en";
}

const LOCALE_NAMES_FOR_AI: Record<TargetLocale, string> = {
  uk: "Ukrainian",
  en: "English",
  he: "Hebrew",
};

const TRANSLATE_SYSTEM = `You are an expert translator for recipes. Translate the recipe into the target language.

Rules:
- Preserve ALL numbers, quantities, and units exactly. Do not convert units (e.g. "2 tbsp" stays "2 tbsp" in English or becomes "2 ст. л." in Ukrainian, "1 cup" stays measurable).
- Use correct cooking terminology in the target language. Examples:
  - tablespoon → Ukrainian: столова ложка (or ст. л.), Hebrew: כף
  - teaspoon → Ukrainian: чайна ложка (or ч. л.), Hebrew: כפית
  - cloves (garlic) → Ukrainian: зубчики, Hebrew: שיני שום
  - cup → Ukrainian: чашка, Hebrew: כוס
- Translate: title, description, instruction steps, and each ingredient's name and preparation note (e.g. "chopped" → "нарізаний" in Ukrainian).
- Output valid JSON only, no markdown.`;

export async function translateRecipe(
  recipe: {
    title: string;
    description?: string | null;
    instructions: string[];
    ingredients: StructuredIngredient[];
  },
  fromLang: string,
  toLocale: TargetLocale
): Promise<TranslatedRecipe> {
  if (fromLang === toLocale) {
    return {
      title: recipe.title,
      description: recipe.description ?? null,
      instructions: recipe.instructions ?? [],
      ingredients: recipe.ingredients.map((i) => ({
        displayName: i.name,
        preparation: i.preparation ?? null,
      })),
    };
  }

  const targetLangName = LOCALE_NAMES_FOR_AI[toLocale];
  const payload = JSON.stringify({
    title: recipe.title,
    description: recipe.description ?? "",
    instructions: recipe.instructions,
    ingredients: recipe.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      preparation: i.preparation,
    })),
  });

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: TRANSLATE_SYSTEM },
      {
        role: "user",
        content: `Translate this recipe from ${fromLang} to ${targetLangName}. Preserve numbers and units exactly. Return JSON: { "title": string, "description": string | null, "instructions": string[], "ingredients": [ { "displayName": string, "preparation": string | null } ] }.\n\n${payload}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("No translation response");

  const parsed = JSON.parse(raw) as TranslatedRecipe & {
    ingredients?: { displayName?: string; name?: string; preparation?: string | null }[];
  };
  return {
    title: parsed.title ?? recipe.title,
    description: parsed.description ?? null,
    instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
    ingredients: Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((i) => ({
          displayName: i.displayName ?? (i as { name?: string }).name ?? "",
          preparation: i.preparation ?? null,
        }))
      : recipe.ingredients.map((i) => ({
          displayName: i.name,
          preparation: i.preparation ?? null,
        })),
  };
}

/** Build translatedDisplayName JSON for RecipeIngredient: { "uk": "...", "en": "...", "he": "..." } */
export function buildTranslatedDisplayName(
  existing: Record<string, string> | null,
  locale: string,
  displayName: string
): string {
  const next = existing && typeof existing === "object" ? { ...existing } : {};
  if (locale && displayName) next[locale] = displayName;
  return JSON.stringify(next);
}

/** Parse translatedDisplayName from DB (JSON string) to record. */
export function parseTranslatedDisplayName(
  raw: string | null
): Record<string, string> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}
