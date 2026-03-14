/**
 * Smart product selection: rank by match accuracy, package size, avoid oversized.
 * Returns best product + human-readable reason for transparency.
 */

import type { SearchProductResult } from "./types";

const SIZE_REGEX = /\b(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb)\b/gi;

function parseSizeFromName(name: string): { sizeG?: number; sizeMl?: number } {
  const out: { sizeG?: number; sizeMl?: number } = {};
  let m: RegExpExecArray | null;
  const re = new RegExp(SIZE_REGEX.source, "gi");
  while ((m = re.exec(name)) !== null) {
    const val = parseFloat(m[1]);
    const u = (m[2] || "").toLowerCase();
    if (u === "g") out.sizeG = (out.sizeG ?? 0) + val;
    else if (u === "kg") out.sizeG = (out.sizeG ?? 0) + val * 1000;
    else if (u === "ml") out.sizeMl = (out.sizeMl ?? 0) + val;
    else if (u === "l") out.sizeMl = (out.sizeMl ?? 0) + val * 1000;
    else if (u === "oz") out.sizeG = (out.sizeG ?? 0) + val * 28.35;
    else if (u === "lb") out.sizeG = (out.sizeG ?? 0) + val * 453.6;
  }
  return out;
}

export function enrichSearchResults(results: SearchProductResult[]): SearchProductResult[] {
  return results.map((r) => {
    const parsed = parseSizeFromName(r.name);
    return {
      ...r,
      sizeG: r.sizeG ?? parsed.sizeG,
      sizeMl: r.sizeMl ?? parsed.sizeMl,
    };
  });
}

/**
 * Parse required quantity from ingredient (e.g. "500", "1.5" with unit "g" or "L").
 */
export function parseRequiredQuantity(quantity: string, unit?: string): { value: number; isWeight: boolean } {
  const value = parseFloat(String(quantity).replace(/[^\d./-]/g, "")) || 0;
  const u = (unit || "").toLowerCase();
  const isWeight = /^(g|kg|oz|lb)$/.test(u) || (!u && value < 1000);
  return { value, isWeight };
}

/**
 * Convert required quantity to grams or ml for comparison.
 */
function requiredToStandard(value: number, unit?: string): { g?: number; ml?: number } {
  const u = (unit || "").toLowerCase();
  if (u === "g") return { g: value };
  if (u === "kg") return { g: value * 1000 };
  if (u === "oz") return { g: value * 28.35 };
  if (u === "lb") return { g: value * 453.6 };
  if (u === "ml") return { ml: value };
  if (u === "l" || u === "liter" || u === "litre") return { ml: value * 1000 };
  if (u === "cup" || u === "cups") return { ml: value * 237 };
  if (u === "tbsp") return { ml: value * 14.8 };
  if (u === "tsp") return { ml: value * 4.9 };
  return { g: value };
}

/**
 * Score product for match: ingredient name match, size match, avoid oversized.
 */
function scoreProduct(
  product: SearchProductResult,
  ingredientName: string,
  requiredG?: number,
  requiredMl?: number
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = product.matchScore;

  const nameLower = ingredientName.toLowerCase();
  const productLower = product.name.toLowerCase();
  if (productLower.includes(nameLower) || nameLower.split(/\s+/).some((w) => productLower.includes(w))) {
    score += 0.2;
    reasons.push("ingredient name match");
  }

  if (requiredG != null && requiredG > 0 && product.sizeG != null) {
    const ratio = product.sizeG / requiredG;
    if (ratio >= 0.9 && ratio <= 1.2) {
      score += 0.25;
      reasons.push("closest weight match");
    } else if (ratio >= 0.5 && ratio <= 2) {
      score += 0.1;
      reasons.push("reasonable package size");
    } else if (ratio > 3) {
      score -= 0.2;
      reasons.push("avoided oversized package");
    }
  }
  if (requiredMl != null && requiredMl > 0 && product.sizeMl != null) {
    const ratio = product.sizeMl / requiredMl;
    if (ratio >= 0.9 && ratio <= 1.2) {
      score += 0.25;
      reasons.push("closest volume match");
    } else if (ratio >= 0.5 && ratio <= 2) {
      score += 0.1;
    } else if (ratio > 3) {
      score -= 0.2;
      reasons.push("avoided oversized package");
    }
  }

  if (product.rating != null && product.rating >= 4) {
    score += 0.05;
    reasons.push("good rating");
  }
  if (product.reviewCount != null && product.reviewCount > 10) {
    score += 0.05;
    reasons.push("popular");
  }

  return { score: Math.min(1, Math.max(0, score)), reasons };
}

export interface BestProductResult {
  product: SearchProductResult;
  reason: string;
  /** For quantity optimization: e.g. 1.5L → 1×1L + 1×0.5L */
  addQuantity?: number;
}

/**
 * Select best product from search results.
 * Ranks by: ingredient match, package size match, avoid oversized, optional rating/popularity.
 */
export function selectBestProduct(
  candidates: SearchProductResult[],
  ingredientName: string,
  quantity: string,
  unit?: string
): BestProductResult | null {
  if (!candidates.length) return null;

  const req = parseRequiredQuantity(quantity, unit);
  const std = requiredToStandard(req.value, unit);
  const requiredG = std.g;
  const requiredMl = std.ml;

  const enriched = enrichSearchResults(candidates);
  const scored = enriched.map((p) => {
    const { score, reasons } = scoreProduct(p, ingredientName, requiredG, requiredMl);
    return { product: { ...p, matchScore: score, selectionReason: reasons.join("; ") }, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;

  const reason =
    best.reasons.length > 0
      ? `Best match for ingredient and required quantity. ${best.reasons.join(". ")}.`
      : "Best available match from search results.";

  return {
    product: { ...best.product, selectionReason: reason },
    reason,
    addQuantity: 1,
  };
}

/**
 * Optional: quantity optimization — if needed is 1.5L and we have 1L and 0.5L, return both.
 * For now we add single product with calculated qty; caller can use addQuantity for multi-unit.
 */
export function suggestQuantityOptimization(
  product: SearchProductResult,
  requiredValue: number,
  requiredIsWeight: boolean
): { quantity: number; reason?: string } {
  const size = requiredIsWeight ? product.sizeG : product.sizeMl;
  if (size == null || size <= 0) return { quantity: Math.ceil(requiredValue) || 1 };
  const ratio = requiredValue / size;
  if (ratio <= 1.1) return { quantity: 1, reason: "Single package meets need" };
  const qty = Math.ceil(ratio);
  return { quantity: qty, reason: `Added ${qty}× to meet required amount` };
}
