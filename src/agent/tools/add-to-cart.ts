import type { GroceryToolContext, ToolResult } from "./types";

/**
 * AddToCartTool: Add a product to the cart (by product ID or name from search).
 */
export async function addToCart(
  ctx: GroceryToolContext,
  productId: string,
  quantity: number = 1
): Promise<ToolResult<{ added: boolean }>> {
  const { page, baseUrl } = ctx;
  try {
    if (productId && (productId.startsWith("http") || productId.startsWith("/"))) {
      const url = productId.startsWith("http") ? productId : new URL(productId, baseUrl).href;
      await page.goto(url, { waitUntil: "domcontentloaded" });
    }

    const addButton = await page.$(
      'button:has-text("Add to cart"), button:has-text("Add to Cart"), [data-testid="add-to-cart"], [class*="add-to-cart"]'
    );
    if (addButton) {
      for (let i = 0; i < quantity; i++) {
        await addButton.click();
        await new Promise((r) => setTimeout(r, 500));
      }
      return { ok: true, data: { added: true } };
    }

    // Fallback: try first "Add" or "Add to bag"
    const anyAdd = await page.$('button:has-text("Add"), a:has-text("Add to cart")');
    if (anyAdd) {
      await anyAdd.click();
      return { ok: true, data: { added: true } };
    }

    return { ok: true, data: { added: false } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Add to cart failed",
    };
  }
}
