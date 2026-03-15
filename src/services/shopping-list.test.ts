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
});
