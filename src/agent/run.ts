/**
 * Grocery shopping agent: orchestrates MCP-style tools (search, add to cart).
 * Tracks found / not_found / uncertain per item and tries:
 * product search → alternative keyword search → category search.
 */

import { chromium, type BrowserContext } from "playwright";
import { STORE_CONFIG } from "./stores";
import { searchProduct } from "./tools/search-product";
import { addToCart } from "./tools/add-to-cart";
import { selectBestProduct, suggestQuantityOptimization } from "./tools/product-selection";
import { toPreferredUnit } from "@/lib/unit-conversion";
import type { GroceryToolContext } from "./tools/types";
import type { SearchProductResult } from "./tools/types";

const FOUND_THRESHOLD = 0.8;
const UNCERTAIN_THRESHOLD = 0.4;

export interface ShopItem {
  id: string; // ShoppingListItem id
  name: string;
  quantity: string;
  unit?: string;
}

export interface ItemResult {
  itemId: string;
  ingredientName: string;
  status: "FOUND" | "NOT_FOUND" | "UNCERTAIN";
  matchedProductName?: string;
  matchScore?: number;
  storeName: string;
  /** Why this product was selected (smart selection transparency) */
  selectionReason?: string;
}

export interface MissingItemsReport {
  added: ItemResult[];
  notFound: ItemResult[];
  uncertain: ItemResult[];
  storeName: string;
  storeKey: string;
}

export interface RunResult {
  success: boolean;
  addedCount: number;
  report: MissingItemsReport;
  message: string;
}

/** Generate alternative search terms (strip adjectives, try core noun). */
function alternativeSearchTerms(name: string): string[] {
  const t = name.trim().toLowerCase();
  const terms: string[] = [t];
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    terms.push(words[words.length - 1]); // e.g. "fresh basil" -> "basil"
    if (words.length > 2) terms.push(words.slice(-2).join(" "));
  }
  return [...new Set(terms)];
}

export async function runShoppingAgent(
  storeKey: string,
  sessionData: unknown,
  items: ShopItem[]
): Promise<RunResult> {
  const config = STORE_CONFIG[storeKey] ?? STORE_CONFIG.generic;
  const storeName = config.name;

  const browser = await chromium.launch({
    headless: process.env.AGENT_HEADLESS !== "false",
    args: ["--no-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });

  await restoreSession(context, sessionData);

  const page = await context.newPage();
  const ctx: GroceryToolContext = {
    storeKey,
    sessionData,
    page,
    baseUrl: config.baseUrl,
  };

  const added: ItemResult[] = [];
  const notFound: ItemResult[] = [];
  const uncertain: ItemResult[] = [];

  for (const item of items) {
    const qty = parseInt(item.quantity, 10) || 1;
    let candidates: SearchProductResult[] = [];
    let searchQuery = item.name;

    // 1) Product search with main name
    let searchRes = await searchProduct(ctx, item.name);
    if (searchRes.ok && searchRes.data.length) candidates = searchRes.data;

    // 2) Alternative keyword search if no good match
    if (candidates.length === 0 || candidates[0].matchScore < FOUND_THRESHOLD) {
      const alts = alternativeSearchTerms(item.name);
      for (const alt of alts) {
        if (alt === item.name.trim().toLowerCase()) continue;
        searchRes = await searchProduct(ctx, alt);
        if (searchRes.ok && searchRes.data.length) {
          if (searchRes.data[0].matchScore > (candidates[0]?.matchScore ?? 0)) {
            candidates = searchRes.data;
            searchQuery = alt;
          }
        }
      }
    }

    const bestSelection = selectBestProduct(
      candidates,
      item.name,
      item.quantity,
      item.unit
    );
    const bestMatch = bestSelection?.product ?? (candidates[0] ? { productId: candidates[0].productId, name: candidates[0].name, matchScore: candidates[0].matchScore } : null);
    const bestScore = bestMatch?.matchScore ?? 0;

    const status: ItemResult["status"] =
      bestScore >= FOUND_THRESHOLD
        ? "FOUND"
        : bestScore >= UNCERTAIN_THRESHOLD
          ? "UNCERTAIN"
          : "NOT_FOUND";

    const normalized = toPreferredUnit(item.quantity, item.unit, item.name);
    const addQty =
      normalized.unitType === "count"
        ? Math.max(1, Math.round(normalized.value))
        : bestSelection?.addQuantity ??
          (bestSelection?.product
            ? suggestQuantityOptimization(
                bestSelection.product,
                normalized.value,
                normalized.preferredUnit === "g"
              ).quantity
            : 1);

    const resultEntry: ItemResult = {
      itemId: item.id,
      ingredientName: item.name,
      status,
      storeName,
      ...(bestMatch && {
        matchedProductName: bestMatch.name,
        matchScore: bestMatch.matchScore,
      }),
      selectionReason: bestSelection?.reason ?? bestSelection?.product?.selectionReason,
    };

    if (status === "FOUND" && bestMatch) {
      const addRes = await addToCart(ctx, bestMatch.productId || bestMatch.name, addQty * qty);
      if (addRes.ok && addRes.data.added) {
        added.push(resultEntry);
      } else {
        uncertain.push({ ...resultEntry, status: "UNCERTAIN" });
      }
    } else if (status === "UNCERTAIN" && bestMatch) {
      const addRes = await addToCart(ctx, bestMatch.productId || bestMatch.name, addQty * qty);
      if (addRes.ok && addRes.data.added) {
        uncertain.push(resultEntry);
      } else {
        notFound.push({ ...resultEntry, status: "NOT_FOUND", matchedProductName: bestMatch.name });
      }
    } else {
      notFound.push(resultEntry);
    }
  }

  await browser.close();

  const report: MissingItemsReport = {
    added,
    notFound,
    uncertain,
    storeName,
    storeKey,
  };

  return {
    success: notFound.length === 0 && uncertain.length === 0,
    addedCount: added.length,
    report,
    message:
      notFound.length === 0 && uncertain.length === 0
        ? "All items added to cart."
        : `Added ${added.length} items. ${notFound.length} not found. ${uncertain.length} need confirmation.`,
  };
}

async function restoreSession(context: BrowserContext, sessionData: unknown): Promise<void> {
  if (!sessionData || typeof sessionData !== "object") return;
  const data = sessionData as { cookies?: Array<{ name: string; value: string; domain?: string; path?: string }> };
  if (Array.isArray(data.cookies) && data.cookies.length) {
    await context.addCookies(
      data.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain ?? undefined,
        path: c.path ?? "/",
      }))
    );
  }
}
