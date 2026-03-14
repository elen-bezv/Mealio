import type { GroceryToolContext, ToolResult } from "./types";
import type { SearchProductResult } from "./types";

const DEFAULT_CANDIDATES = 10;

/**
 * SearchProductTool: Search for products on the grocery site.
 * Returns multiple candidates for smart product selection (ranking, size match).
 */
export async function searchProduct(
  ctx: GroceryToolContext,
  query: string,
  maxResults: number = DEFAULT_CANDIDATES
): Promise<ToolResult<SearchProductResult[]>> {
  const { page, baseUrl } = ctx;
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const searchSelector = 'input[type="search"], input[name="q"], input[placeholder*="Search"]';
    await page.waitForSelector(searchSelector, { timeout: 10000 });
    await page.fill(searchSelector, query);
    await page.press(searchSelector, "Enter");
    await page.waitForLoadState("domcontentloaded");

    const items = await page.$$eval(
      '[data-testid="product"], .product-card, .product-tile, [class*="ProductCard"], a[href*="/product"]',
      (els, max) =>
        els.slice(0, max).map((el) => {
          const name =
            el.querySelector("h2, h3, [class*='title']")?.textContent?.trim() ??
            el.textContent?.trim()?.slice(0, 120) ??
            "";
          const price = el.querySelector("[class*='price']")?.textContent?.trim();
          const link = el.querySelector("a")?.getAttribute("href");
          const ratingEl = el.querySelector("[class*='rating'], [aria-label*='star'], [data-rating]");
          let rating: number | undefined;
          let reviewCount: number | undefined;
          if (ratingEl) {
            const text = ratingEl.textContent?.trim() ?? ratingEl.getAttribute("data-rating") ?? "";
            const num = parseFloat(text.replace(/[^\d.]/g, ""));
            if (!Number.isNaN(num)) rating = num;
            const reviewText = el.querySelector("[class*='review']")?.textContent?.trim();
            if (reviewText) {
              const rev = parseInt(reviewText.replace(/\D/g, ""), 10);
              if (!Number.isNaN(rev)) reviewCount = rev;
            }
          }
          return {
            name,
            price,
            productId: link ?? "",
            rating,
            reviewCount,
          };
        }),
      maxResults
    );

    if (items.length === 0) {
      return {
        ok: true,
        data: [{ productId: "", name: query, matchScore: 0.5 }],
      };
    }

    const results: SearchProductResult[] = items.map((item, i) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      matchScore: 1 - i * 0.08,
      rating: item.rating,
      reviewCount: item.reviewCount,
    }));
    return { ok: true, data: results };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Search failed",
    };
  }
}
