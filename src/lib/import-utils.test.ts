import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  detectSourceType,
  isMeaningfulTitle,
  hasMeaningfulIngredients,
  hasMeaningfulInstructions,
  isRecipeMeaningful,
} from "./import-utils";

describe("normalizeUrl", () => {
  it("returns normalized URL for valid https URL", () => {
    expect(normalizeUrl("  https://example.com/recipe  ")).toBe("https://example.com/recipe");
  });

  it("strips junk UTM params", () => {
    const out = normalizeUrl("https://example.com/p?utm_source=foo&id=1");
    expect(out).toContain("id=1");
    expect(out).not.toContain("utm_source");
  });

  it("returns null for empty or whitespace", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
  });

  it("returns null for malformed URL", () => {
    expect(normalizeUrl("not-a-url")).toBeNull();
    expect(normalizeUrl("ftp://example.com")).toBeNull();
  });

  it("preserves path and needed query for reels", () => {
    const out = normalizeUrl("https://www.instagram.com/reel/ABC123/");
    expect(out).toBe("https://www.instagram.com/reel/ABC123/");
  });
});

describe("detectSourceType", () => {
  it("detects instagram.com", () => {
    expect(detectSourceType("https://instagram.com/p/1")).toBe("instagram");
    expect(detectSourceType("https://www.instagram.com/reel/abc/")).toBe("instagram");
    expect(detectSourceType("https://m.instagram.com/p/1")).toBe("instagram");
  });

  it("detects tiktok.com", () => {
    expect(detectSourceType("https://tiktok.com/@user/video/1")).toBe("tiktok");
    expect(detectSourceType("https://www.tiktok.com/t/abc")).toBe("tiktok");
  });

  it("detects standard recipe website as website", () => {
    expect(detectSourceType("https://allrecipes.com/recipe/123")).toBe("website");
    expect(detectSourceType("https://example.com")).toBe("website");
  });

  it("returns unknown for invalid URL", () => {
    expect(detectSourceType("")).toBe("unknown");
  });
});

describe("isMeaningfulTitle", () => {
  it("rejects empty and placeholders", () => {
    expect(isMeaningfulTitle("")).toBe(false);
    expect(isMeaningfulTitle("Not Provided")).toBe(false);
    expect(isMeaningfulTitle("Untitled Recipe")).toBe(false);
    expect(isMeaningfulTitle("N/A")).toBe(false);
  });

  it("accepts real titles", () => {
    expect(isMeaningfulTitle("Chocolate Cake")).toBe(true);
    expect(isMeaningfulTitle("Pasta")).toBe(true);
  });
});

describe("hasMeaningfulIngredients", () => {
  it("returns false for empty or no names", () => {
    expect(hasMeaningfulIngredients([])).toBe(false);
    expect(hasMeaningfulIngredients([{ name: "" }])).toBe(false);
  });

  it("returns true when at least one ingredient has name", () => {
    expect(hasMeaningfulIngredients([{ name: "flour" }])).toBe(true);
    expect(hasMeaningfulIngredients([{ name: "" }, { name: "sugar" }])).toBe(true);
  });
});

describe("hasMeaningfulInstructions", () => {
  it("returns false for empty or blank steps", () => {
    expect(hasMeaningfulInstructions([])).toBe(false);
    expect(hasMeaningfulInstructions(["  "])).toBe(false);
  });

  it("returns true when at least one step has content", () => {
    expect(hasMeaningfulInstructions(["Preheat oven."])).toBe(true);
  });
});

describe("isRecipeMeaningful", () => {
  it("returns false when title, ingredients, and instructions are all empty/meaningless", () => {
    expect(isRecipeMeaningful({ title: "", ingredients: [], instructions: [] })).toBe(false);
    expect(isRecipeMeaningful({ title: "Not Provided", ingredients: [], instructions: [] })).toBe(false);
  });

  it("returns true when at least one of title, ingredients, or instructions is meaningful", () => {
    expect(isRecipeMeaningful({ title: "Cake", ingredients: [], instructions: [] })).toBe(true);
    expect(isRecipeMeaningful({ title: "", ingredients: [{ name: "flour" }], instructions: [] })).toBe(true);
    expect(isRecipeMeaningful({ title: "", ingredients: [], instructions: ["Step 1"] })).toBe(true);
  });
});
