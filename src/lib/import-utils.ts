/**
 * Recipe import pipeline utilities: URL normalization, source detection,
 * and validation. Used by API and services to avoid silent empty successes.
 */

export type DetectedSourceType =
  | "instagram"
  | "tiktok"
  | "website"
  | "unknown";

const INSTAGRAM_HOSTS = ["instagram.com", "www.instagram.com", "m.instagram.com"];
const TIKTOK_HOSTS = ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"];

/** Junk query params to strip when normalizing (keep path and needed params for reels/posts). */
const JUNK_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
]);

/**
 * Normalize URL before processing: trim, validate, strip junk params.
 * Returns null if URL is malformed or invalid.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const filtered = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (!JUNK_PARAMS.has(key.toLowerCase())) filtered.set(key, value);
    });
    const qs = filtered.toString();
    const path = url.pathname.replace(/\/+/g, "/") || "/";
    url.search = qs ? `?${qs}` : "";
    url.pathname = path;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Detect source type from normalized URL host.
 */
export function detectSourceType(url: string): DetectedSourceType {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (INSTAGRAM_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)))
      return "instagram";
    if (TIKTOK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)))
      return "tiktok";
    if (host && host !== "localhost") return "website";
  } catch {
    /* invalid url */
  }
  return "unknown";
}

/** Check if a string is a meaningful title (not placeholder or empty). */
export function isMeaningfulTitle(title: string | null | undefined): boolean {
  if (!title || typeof title !== "string") return false;
  const t = title.trim();
  if (t.length < 2) return false;
  const lower = t.toLowerCase();
  const placeholders = [
    "not provided",
    "untitled",
    "untitled recipe",
    "no title",
    "n/a",
    "unknown",
  ];
  if (placeholders.some((p) => lower === p || lower.startsWith(p + " ")))
    return false;
  return true;
}

/** Check if ingredients array has at least one real item (non-empty name). */
export function hasMeaningfulIngredients(
  ingredients: Array<{ name?: string }> | null | undefined
): boolean {
  if (!Array.isArray(ingredients)) return false;
  return ingredients.some(
    (i) => i && typeof i.name === "string" && i.name.trim().length > 0
  );
}

/** Check if instructions array has at least one real step. */
export function hasMeaningfulInstructions(
  instructions: string[] | null | undefined
): boolean {
  if (!Array.isArray(instructions)) return false;
  return instructions.some(
    (s) => typeof s === "string" && s.trim().length > 0
  );
}

/**
 * Strict success rule: recipe is valid only if at least one of
 * title, ingredients, or instructions is meaningful.
 */
export function isRecipeMeaningful(recipe: {
  title?: string | null;
  ingredients?: Array<{ name?: string }> | null;
  instructions?: string[] | null;
}): boolean {
  return (
    isMeaningfulTitle(recipe.title) ||
    hasMeaningfulIngredients(recipe.ingredients) ||
    hasMeaningfulInstructions(recipe.instructions)
  );
}

/** Minimum content length to consider sending to AI (avoid URL-only or empty). */
export const MIN_CONTENT_LENGTH_FOR_AI = 50;

/** Minimum content length for Instagram to avoid "blocked" or login-wall only. */
export const MIN_INSTAGRAM_CONTENT_LENGTH = 80;
