import { describe, it, expect } from "vitest";
import {
  toApiResult,
  findDuplicateTitle,
  type ParserResult,
} from "./recipe-parser-pro";

describe("toApiResult", () => {
  it("marks result as failed when recipe is not meaningful", () => {
    const parsed: ParserResult = {
      recipe: {
        title: "",
        description: undefined,
        ingredients: [],
        instructions: [],
        sourceType: "url",
      },
      parseStatus: "success",
      confidence: "high",
      errorMessage: null,
      sourceType: "url",
    };
    const result = toApiResult(parsed, null);
    expect(result.parseStatus).toBe("failed");
    expect(result.errorMessage).toBeTruthy();
  });

  it("keeps failed status when already failed", () => {
    const parsed: ParserResult = {
      recipe: {
        title: "",
        description: undefined,
        ingredients: [],
        instructions: [],
        sourceType: "instagram",
      },
      parseStatus: "failed",
      confidence: "low",
      errorMessage: "Instagram content could not be read directly.",
      sourceType: "instagram",
    };
    const result = toApiResult(parsed, null);
    expect(result.parseStatus).toBe("failed");
    expect(result.errorMessage).toContain("Instagram");
  });

  it("keeps success when recipe has meaningful data", () => {
    const parsed: ParserResult = {
      recipe: {
        title: "Chocolate Cake",
        description: "A classic cake.",
        ingredients: [{ name: "flour", quantity: "2", unit: "cups" }],
        instructions: ["Mix dry ingredients.", "Bake at 350°F."],
        sourceType: "url",
      },
      parseStatus: "success",
      confidence: "high",
      errorMessage: null,
      sourceType: "url",
    };
    const result = toApiResult(parsed, null);
    expect(result.parseStatus).toBe("success");
    expect(result.recipe.title).toBe("Chocolate Cake");
  });

  it("keeps partial when only ingredients exist", () => {
    const parsed: ParserResult = {
      recipe: {
        title: "Soup",
        description: undefined,
        ingredients: [{ name: "broth", quantity: "1", unit: "cup" }],
        instructions: [],
        sourceType: "url",
      },
      parseStatus: "partial",
      confidence: "medium",
      errorMessage: "Instructions could not be extracted.",
      sourceType: "url",
    };
    const result = toApiResult(parsed, null);
    expect(result.parseStatus).toBe("partial");
    expect(result.recipe.ingredients).toHaveLength(1);
  });

  it("attaches duplicate when provided", () => {
    const parsed: ParserResult = {
      recipe: { title: "Cake", description: undefined, ingredients: [], instructions: ["Bake."], sourceType: "text" },
      parseStatus: "success",
      confidence: "high",
      errorMessage: null,
      sourceType: "text",
    };
    const result = toApiResult(parsed, { id: "rec-1", title: "Cake" });
    expect(result.duplicateRecipeId).toBe("rec-1");
    expect(result.duplicateRecipeTitle).toBe("Cake");
  });
});

describe("findDuplicateTitle", () => {
  it("returns null for empty title", () => {
    expect(findDuplicateTitle("", [{ id: "1", title: "Something" }])).toBeNull();
  });

  it("returns match for exact same title", () => {
    const existing = [{ id: "1", title: "Chocolate Cake" }];
    expect(findDuplicateTitle("Chocolate Cake", existing)).toEqual({ id: "1", title: "Chocolate Cake" });
  });

  it("returns match for similar title", () => {
    const existing = [{ id: "1", title: "Chocolate Cake" }];
    expect(findDuplicateTitle("Chocolate Cake (Vegan)", existing)).toEqual({ id: "1", title: "Chocolate Cake" });
  });

  it("returns null when no match", () => {
    expect(findDuplicateTitle("New Recipe", [{ id: "1", title: "Other" }])).toBeNull();
  });
});
