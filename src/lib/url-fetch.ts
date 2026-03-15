/**
 * Fetch and extract main text from URLs (websites, Instagram, TikTok).
 * Strips HTML, scripts; extracts JSON-LD Recipe, Open Graph, meta, caption-like content.
 * Throws with actionable messages when content is too weak (never returns URL as "text").
 */

import {
  detectSourceType,
  type DetectedSourceType,
  MIN_CONTENT_LENGTH_FOR_AI,
  MIN_INSTAGRAM_CONTENT_LENGTH,
} from "@/lib/import-utils";

export type SourceHint = "website" | "instagram" | "tiktok";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function toSourceHint(d: DetectedSourceType): SourceHint {
  if (d === "instagram") return "instagram";
  if (d === "tiktok") return "tiktok";
  return "website";
}

/** Extract Open Graph and meta description from HTML */
function extractOgAndMeta(html: string): string {
  const parts: string[] = [];
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)?.[1];
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)?.[1];
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1];
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (ogTitle?.trim()) parts.push(ogTitle.trim());
  if (ogDesc?.trim()) parts.push(ogDesc.trim());
  if (metaDesc?.trim() && !parts.includes(metaDesc.trim())) parts.push(metaDesc.trim());
  if (titleTag?.trim() && !parts.some((p) => p.includes(titleTag.trim()))) parts.push(titleTag.trim());
  return parts.join("\n\n");
}

/** Try to extract caption-like text from Instagram JSON-LD or window.__additionalDataLoaded / edge_media_to_caption */
function extractInstagramCaptionLike(html: string): string {
  const parts: string[] = [];
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const obj = Array.isArray(data) ? data[0] : data;
      if (obj?.caption) parts.push(String(obj.caption));
      if (obj?.articleBody) parts.push(String(obj.articleBody));
      if (obj?.description) parts.push(String(obj.description));
      if (obj?.name && !obj.caption) parts.push(String(obj.name));
    } catch {
      /* ignore */
    }
  }
  try {
    const embedCaption = html.match(/"caption":\s*"((?:[^"\\]|\\.)*)"/);
    if (embedCaption?.[1]) parts.push(embedCaption[1].replace(/\\"/g, '"'));
  } catch {
    /* ignore */
  }
  return parts.filter(Boolean).join("\n\n");
}

/** Extract main body text from HTML (strip scripts, nav, footer, tags) */
function extractBodyText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const chunk = bodyMatch ? bodyMatch[1] : html;
  const noScript = chunk.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const noNav = noScript.replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<header[\s\S]*?<\/header>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "");
  const noComments = noNav.replace(/<!--[\s\S]*?-->/g, "");
  const withSpaces = noComments.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<\/div>/gi, "\n");
  return withSpaces.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Fetch URL and extract text. Uses source-specific extraction.
 * Throws if content is too weak (never returns URL string as text).
 */
export async function fetchPageText(
  url: string,
  log?: (msg: string, data?: Record<string, unknown>) => void
): Promise<{ text: string; sourceHint: SourceHint }> {
  const sourceType = detectSourceType(url);
  const sourceHint = toSourceHint(sourceType);
  const logMsg = (msg: string, data?: Record<string, unknown>) => log?.(`[fetchPageText] ${msg}`, data);

  logMsg("fetching", { url: url.slice(0, 80), sourceType });

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  });

  logMsg("fetch response", { status: res.status, ok: res.ok });

  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

  const html = await res.text();
  logMsg("html length", { length: html.length });

  // 1) JSON-LD Recipe (any source)
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      const inner = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/gi, "").trim();
      try {
        const data = JSON.parse(inner);
        const recipe = Array.isArray(data) ? data.find((d: { "@type"?: string }) => d["@type"] === "Recipe") : data["@type"] === "Recipe" ? data : null;
        if (recipe) {
          const name = recipe.name ?? "";
          const ing = (recipe.recipeIngredient ?? []).join("\n");
          const steps = (recipe.recipeInstructions ?? []).map((s: { text?: string; name?: string }) => s.text ?? s.name ?? "").filter(Boolean);
          const text = [name, ing, steps.join("\n")].filter(Boolean).join("\n\n");
          if (text.length > 100) {
            logMsg("json-ld recipe found", { textLength: text.length });
            return { text: text.slice(0, 25000), sourceHint };
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 2) Instagram: OG + meta + caption-like only; require minimum content
  if (sourceType === "instagram") {
    const ogMeta = extractOgAndMeta(html);
    const captionLike = extractInstagramCaptionLike(html);
    const bodyFallback = extractBodyText(html);
    const combined = [ogMeta, captionLike, bodyFallback].filter(Boolean).join("\n\n").trim().slice(0, 25000);
    logMsg("instagram extraction", { ogMetaLength: ogMeta.length, captionLength: captionLike.length, bodyLength: bodyFallback.length, combinedLength: combined.length });

    if (combined.length < MIN_INSTAGRAM_CONTENT_LENGTH) {
      throw new Error("Instagram content could not be read directly. Please paste the caption text or upload a screenshot.");
    }
    return { text: combined, sourceHint };
  }

  // 3) TikTok: OG + meta + body
  if (sourceType === "tiktok") {
    const ogMeta = extractOgAndMeta(html);
    const body = extractBodyText(html);
    const combined = [ogMeta, body].filter(Boolean).join("\n\n").trim().slice(0, 25000);
    logMsg("tiktok extraction", { combinedLength: combined.length });
    if (combined.length < MIN_CONTENT_LENGTH_FOR_AI) {
      throw new Error("This page did not contain enough readable recipe content to import.");
    }
    return { text: combined, sourceHint };
  }

  // 4) Website: body text
  const stripped = extractBodyText(html);
  const truncated = stripped.slice(0, 25000);
  logMsg("website extraction", { strippedLength: stripped.length, truncatedLength: truncated.length });

  if (truncated.length < MIN_CONTENT_LENGTH_FOR_AI) {
    throw new Error("This page did not contain enough readable recipe content to import.");
  }
  return { text: truncated, sourceHint };
}
