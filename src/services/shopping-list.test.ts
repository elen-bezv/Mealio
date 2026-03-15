import { mergeIngredients } from "@/services/shopping-list";

describe("mergeIngredients", () => {
  it("merges same count unit (apples)", () => {
    const result = mergeIngredients([
      { name: "green apple", quantity: "2", unit: "pieces" },
      { name: "green apple", quantity: "3", unit: "pcs" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("green apple");
    expect(result[0].quantity).toBe("5");
    expect(result[0].unit).toBe("pcs");
    expect(result[0].mergedQuantity).toBe("5 pcs");
  });

  it("merges garlic in cloves", () => {
    const result = mergeIngredients([
      { name: "garlic", quantity: "2", unit: "cloves" },
      { name: "garlic", quantity: "4", unit: "cloves" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("6 cloves");
  });

  it("keeps count and weight separate (apples)", () => {
    const result = mergeIngredients([
      { name: "apple", quantity: "2", unit: "pieces" },
      { name: "apple", quantity: "200", unit: "g" },
    ]);
    expect(result).toHaveLength(2);
    const countEntry = result.find((r) => r.unit === "pcs");
    const weightEntry = result.find((r) => r.unit === "g");
    expect(countEntry?.mergedQuantity).toBe("2 pcs");
    expect(weightEntry?.mergedQuantity).toBe("200 g");
  });

  it("merges weight (flour)", () => {
    const result = mergeIngredients([
      { name: "flour", quantity: "200", unit: "g" },
      { name: "flour", quantity: "100", unit: "g" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("300 g");
  });

  it("merges volume (olive oil)", () => {
    const result = mergeIngredients([
      { name: "olive oil", quantity: "250", unit: "ml" },
      { name: "olive oil", quantity: "250", unit: "ml" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("500 ml");
  });

  it("preserves fennel in bulbs", () => {
    const result = mergeIngredients([
      { name: "fennel bulb", quantity: "1", unit: "bulb" },
      { name: "fennel bulb", quantity: "2", unit: "bulbs" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("3 bulbs");
  });

  it("preserves celery in ribs", () => {
    const result = mergeIngredients([
      { name: "celery", quantity: "2", unit: "ribs" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("2 ribs");
  });

  it("aggregates repeated 1/2 green cabbage (meal plan style)", () => {
    const result = mergeIngredients([
      { name: "green cabbage", quantity: "1/2", unit: undefined },
      { name: "green cabbage", quantity: "1/2", unit: undefined },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("1 head");
    expect(result[0].unit).toBe("head");
  });

  it("aggregates 3x 1/2 cabbage to 1.5 heads", () => {
    const result = mergeIngredients([
      { name: "green cabbage", quantity: "1/2" },
      { name: "green cabbage", quantity: "1/2" },
      { name: "green cabbage", quantity: "1/2" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("1.5 heads");
    expect(result[0].quantity).toBe("1.5");
  });

  it("does not merge incompatible units (bunch vs grams)", () => {
    const result = mergeIngredients([
      { name: "parsley", quantity: "1", unit: "bunch" },
      { name: "parsley", quantity: "10", unit: "g" },
    ]);
    expect(result).toHaveLength(2);
    const byUnit = result.reduce((acc, r) => ({ ...acc, [r.unit!]: r }), {} as Record<string, typeof result[0]>);
    expect(byUnit.bunch?.mergedQuantity).toBe("1 bunch");
    expect(byUnit.g?.mergedQuantity).toBe("10 g");
  });

  it("recipe-style: 2 seedless cucumbers stay 2 pcs in merged list", () => {
    const result = mergeIngredients([
      { name: "seedless cucumbers", quantity: "2", unit: undefined },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("2 pcs");
    expect(result[0].unit).toBe("pcs");
  });

  it("recipe-style: 1/2 red onion stays 1/2 onion (not grams)", () => {
    const result = mergeIngredients([
      { name: "red onion", quantity: "1/2", unit: undefined },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("1/2 onions");
    expect(result[0].unit).toBe("onion");
  });

  it("recipe-style: 1/2 cabbage twice aggregates to 1 head", () => {
    const result = mergeIngredients([
      { name: "green cabbage", quantity: "1/2" },
      { name: "green cabbage", quantity: "1/2" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedQuantity).toBe("1 head");
  });

  it("meal plan aggregation: repeated recipes preserve units (cucumbers + garlic)", () => {
    const result = mergeIngredients([
      { name: "cucumber", quantity: "1", unit: undefined },
      { name: "cucumber", quantity: "1", unit: undefined },
      { name: "garlic", quantity: "2", unit: "cloves" },
      { name: "garlic", quantity: "4", unit: "cloves" },
    ]);
    expect(result).toHaveLength(2);
    const cuc = result.find((r) => r.name.toLowerCase().includes("cucumber"));
    const garlic = result.find((r) => r.name.toLowerCase().includes("garlic"));
    expect(cuc?.mergedQuantity).toBe("2 pcs");
    expect(garlic?.mergedQuantity).toBe("6 cloves");
  });
});
