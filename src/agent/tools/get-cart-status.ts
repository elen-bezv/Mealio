import type { GroceryToolContext, ToolResult } from "./types";
import type { CartStatus } from "./types";

/**
 * GetCartStatusTool: Get current cart item count and items.
 */
export async function getCartStatus(ctx: GroceryToolContext): Promise<ToolResult<CartStatus>> {
  const { page, baseUrl } = ctx;
  try {
    const cartUrl = `${baseUrl.replace(/\/$/, "")}/cart`;
    await page.goto(cartUrl, { waitUntil: "domcontentloaded" });

    const items = await page.$$eval(
      '[class*="cart-item"], [data-testid="cart-item"], .cart-item, tr[class*="line-item"]',
      (els) =>
        els.map((el) => {
          const name = el.querySelector("a, [class*='name'], [class*='title']")?.textContent?.trim() ?? "";
          const qty = el.querySelector("input[type='number']")?.getAttribute("value");
          return { name, quantity: parseInt(qty ?? "1", 10) || 1 };
        })
    );

    const countSel = await page.$('[class*="cart-count"], [data-testid="cart-count"], .minicart-quantity');
    const count = countSel
      ? parseInt(await countSel.textContent() ?? "0", 10) || items.length
      : items.length;

    return {
      ok: true,
      data: { itemCount: count, items },
    };
  } catch (e) {
    return {
      ok: true,
      data: { itemCount: 0, items: [] },
    };
  }
}
