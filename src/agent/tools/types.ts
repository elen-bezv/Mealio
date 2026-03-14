/**
 * MCP-style tool definitions for grocery store automation.
 * Each store adapter implements these tools for its domain.
 */

export interface SearchProductResult {
  productId: string;
  name: string;
  price?: string;
  matchScore: number;
  /** Parsed from product name (e.g. "500g", "1L") for smart selection */
  sizeG?: number;
  sizeMl?: number;
  rating?: number;
  reviewCount?: number;
  /** Selection reason for transparency */
  selectionReason?: string;
}

export interface CartStatus {
  itemCount: number;
  items: { name: string; quantity: number }[];
}

export interface GroceryToolContext {
  storeKey: string;
  sessionData: unknown;
  page: import("playwright").Page;
  baseUrl: string;
}

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
