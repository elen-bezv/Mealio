import {
  toPreferredUnit,
  formatQuantity,
  canMergeQuantities,
  addQuantities,
  getUnitType,
  parseQuantity,
} from "@/lib/unit-conversion";

describe("parseQuantity", () => {
  it("parses whole numbers and decimals", () => {
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity(3)).toBe(3);
  });
  it("parses fractions", () => {
    expect(parseQuantity("1/2")).toBe(0.5);
    expect(parseQuantity("1/4")).toBe(0.25);
  });
});

describe("getUnitType", () => {
  it("classifies volume units", () => {
    expect(getUnitType("ml")).toBe("volume");
    expect(getUnitType("cup")).toBe("volume");
    expect(getUnitType("L")).toBe("volume");
  });
  it("classifies weight units", () => {
    expect(getUnitType("g")).toBe("weight");
    expect(getUnitType("kg")).toBe("weight");
  });
  it("classifies count units", () => {
    expect(getUnitType("pieces")).toBe("count");
    expect(getUnitType("cloves")).toBe("count");
    expect(getUnitType("bulbs")).toBe("count");
    expect(getUnitType("ribs")).toBe("count");
  });
  it("uses ingredient default for no unit", () => {
    expect(getUnitType(undefined, "apple")).toBe("count");
    expect(getUnitType(undefined, "garlic")).toBe("count");
    expect(getUnitType(undefined, "fennel bulb")).toBe("count");
    expect(getUnitType(undefined, "celery")).toBe("count");
    expect(getUnitType(undefined, "green onion")).toBe("count");
    expect(getUnitType(undefined, "olive oil")).toBe("volume");
    expect(getUnitType(undefined, "flour")).toBe("weight");
  });
});

describe("toPreferredUnit", () => {
  it("preserves count-based units", () => {
    expect(toPreferredUnit(2, "pieces", "apple")).toEqual({
      value: 2,
      unit: "pcs",
      preferredUnit: "pcs",
      unitType: "count",
    });
    expect(toPreferredUnit(4, "cloves", "garlic")).toEqual({
      value: 4,
      unit: "cloves",
      preferredUnit: "cloves",
      unitType: "count",
    });
    expect(toPreferredUnit(1, "bulb", "fennel")).toEqual({
      value: 1,
      unit: "bulbs",
      preferredUnit: "bulbs",
      unitType: "count",
    });
    expect(toPreferredUnit(2, "ribs", "celery")).toEqual({
      value: 2,
      unit: "ribs",
      preferredUnit: "ribs",
      unitType: "count",
    });
    expect(toPreferredUnit(6, undefined, "green onion")).toEqual({
      value: 6,
      unit: "stalks",
      preferredUnit: "stalks",
      unitType: "count",
    });
  });

  it("does not convert count-based ingredients to grams", () => {
    const apple = toPreferredUnit(2, undefined, "green apple");
    expect(apple.unitType).toBe("count");
    expect(apple.preferredUnit).toBe("pcs");
    expect(apple.value).toBe(2);

    const garlic = toPreferredUnit(20, undefined, "garlic");
    expect(garlic.unitType).toBe("count");
    expect(garlic.preferredUnit).toBe("cloves");
    expect(garlic.value).toBe(20);

    const fennel = toPreferredUnit(2, undefined, "fennel bulb");
    expect(fennel.unitType).toBe("count");
    expect(fennel.preferredUnit).toBe("bulbs");
  });

  it("converts volume to ml for liquids", () => {
    const oil = toPreferredUnit(1, "cup", "olive oil");
    expect(oil.unitType).toBe("volume");
    expect(oil.preferredUnit).toBe("ml");
    expect(oil.value).toBeGreaterThan(200);
  });

  it("converts weight to g", () => {
    const flour = toPreferredUnit(200, "g", "flour");
    expect(flour.unitType).toBe("weight");
    expect(flour.preferredUnit).toBe("g");
    expect(flour.value).toBe(200);
  });

  it("parsley as bunch when no unit", () => {
    const p = toPreferredUnit(1, undefined, "parsley");
    expect(p.unitType).toBe("count");
    expect(p.preferredUnit).toBe("bunch");
  });

  it("water in ml/L", () => {
    const w = toPreferredUnit(500, "ml", "water");
    expect(w.preferredUnit).toBe("ml");
    expect(w.value).toBe(500);
  });

  it("spices in grams when given weight", () => {
    const s = toPreferredUnit(10, "g", "black pepper");
    expect(s.unitType).toBe("weight");
    expect(s.preferredUnit).toBe("g");
  });
});

describe("formatQuantity", () => {
  it("formats count units", () => {
    expect(formatQuantity(2, "pcs")).toBe("2 pcs");
    expect(formatQuantity(4, "cloves")).toBe("4 cloves");
    expect(formatQuantity(1, "bulbs")).toBe("1 bulb");
    expect(formatQuantity(2, "ribs")).toBe("2 ribs");
  });
  it("formats weight and volume", () => {
    expect(formatQuantity(500, "g")).toBe("500 g");
    expect(formatQuantity(1500, "ml")).toBe("1.5 L");
    expect(formatQuantity(1000, "g")).toBe("1 kg");
  });
});

describe("canMergeQuantities", () => {
  it("allows merge for same weight", () => {
    const a = toPreferredUnit(200, "g", "flour");
    const b = toPreferredUnit(100, "g", "flour");
    expect(canMergeQuantities(a, b)).toBe(true);
  });
  it("allows merge for same count unit", () => {
    const a = toPreferredUnit(2, "pieces", "apple");
    const b = toPreferredUnit(3, "pcs", "apple");
    expect(canMergeQuantities(a, b)).toBe(true);
  });
  it("rejects merge for different count units", () => {
    const a = toPreferredUnit(2, "cloves", "garlic");
    const b = toPreferredUnit(1, "head", "garlic");
    expect(canMergeQuantities(a, b)).toBe(false);
  });
  it("rejects merge for count vs weight", () => {
    const a = toPreferredUnit(2, "pieces", "apple");
    const b = toPreferredUnit(200, "g", "apple");
    expect(canMergeQuantities(a, b)).toBe(false);
  });
});

describe("addQuantities", () => {
  it("adds count quantities", () => {
    const r = addQuantities(2, 3, "pcs", "count");
    expect(r.value).toBe(5);
    expect(r.formatted).toBe("5 pcs");
  });
  it("adds weight quantities", () => {
    const r = addQuantities(200, 100, "g", "weight");
    expect(r.value).toBe(300);
    expect(r.formatted).toBe("300 g");
  });
  it("adds volume quantities", () => {
    const r = addQuantities(500, 500, "ml", "volume");
    expect(r.value).toBe(1000);
    expect(r.formatted).toBe("1 L");
  });
});

describe("formatQuantity singular", () => {
  it("uses singular for 1 count unit", () => {
    expect(formatQuantity(1, "bulbs")).toBe("1 bulb");
    expect(formatQuantity(1, "cloves")).toBe("1 clove");
    expect(formatQuantity(1, "pcs")).toBe("1 pc");
  });
});
