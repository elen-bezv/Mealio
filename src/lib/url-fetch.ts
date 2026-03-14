/**
 * Fetch and extract main text from URLs (websites, Instagram, TikTok).
 * Strips HTML, scripts, ads-like sections; extracts JSON-LD Recipe if present.
 */

export type SourceHint = "website" | "instagram" | "tiktok";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function detectSourceHint(url: string): SourceHint {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  return "website";
}

/** Extract text from HTML, optionally preferring recipe JSON-LD */
export async function fetchPageText(url: string): Promise<{ text: string; sourceHint: SourceHint }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const html = await res.text();
  const sourceHint = detectSourceHint(url);

  let text = "";

  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      const inner = block.replace(/<script[^>]*>[\s\S]*?/i, "").replace(/<\/script>/gi, "").trim();
      try {
        const data = JSON.parse(inner);
        const recipe = Array.isArray(data) ? data.find((d: { "@type"?: string }) => d["@type"] === "Recipe") : data["@type"] === "Recipe" ? data : null;
        if (recipe) {
          const name = recipe.name ?? "";
          const ing = (recipe.recipeIngredient ?? []).join("\n");
          const steps = (recipe.recipeInstructions ?? []).map((s: { text?: string; name?: string }) => s.text ?? s.name ?? "").filter(Boolean);
          text = [name, ing, steps.join("\n")].filter(Boolean).join("\n\n");
          if (text.length > 100) return { text, sourceHint };
        }
      } catch {
        /* ignore */
      }
    }
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const chunk = bodyMatch ? bodyMatch[1] : html;
  const noScript = chunk.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const noNav = noScript.replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<header[\s\S]*?<\/header>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "");
  const noComments = noNav.replace(/<!--[\s\S]*?-->/g, "");
  const withSpaces = noComments.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<\/div>/gi, "\n");
  const stripped = withSpaces.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const truncated = stripped.slice(0, 25000);

  return { text: truncated || url, sourceHint };
}
