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
  it("parses simple fractions", () => {
    expect(parseQuantity("1/2")).toBe(0.5);
    expect(parseQuantity("1/4")).toBe(0.25);
    expect(parseQuantity("3/4")).toBe(0.75);
  });
  it("parses mixed numbers", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("2 1/2")).toBe(2.5);
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

  it("1/2 green cabbage stays count-based (not grams)", () => {
    const half = toPreferredUnit("1/2", undefined, "green cabbage");
    expect(half.unitType).toBe("count");
    expect(half.preferredUnit).toBe("head");
    expect(half.value).toBe(0.5);
  });

  it("red cabbage and cabbage stay count-based", () => {
    expect(toPreferredUnit(1, undefined, "red cabbage").unitType).toBe("count");
    expect(toPreferredUnit(0.5, undefined, "cabbage").preferredUnit).toBe("head");
  });

  it("seedless cucumber stays count-based (not grams)", () => {
    const c = toPreferredUnit(2, undefined, "seedless cucumbers");
    expect(c.unitType).toBe("count");
    expect(c.preferredUnit).toBe("pcs");
    expect(c.value).toBe(2);
  });

  it("red onion stays count-based with onion unit", () => {
    const half = toPreferredUnit("1/2", undefined, "red onion");
    expect(half.unitType).toBe("count");
    expect(half.preferredUnit).toBe("onion");
    expect(half.value).toBe(0.5);
  });

  it("avocado stays pcs", () => {
    const a = toPreferredUnit(1, undefined, "avocado");
    expect(a.unitType).toBe("count");
    expect(a.preferredUnit).toBe("pcs");
  });

  it("garlic stays cloves when given cloves", () => {
    const g = toPreferredUnit(4, "cloves", "garlic");
    expect(g.unitType).toBe("count");
    expect(g.preferredUnit).toBe("cloves");
    expect(g.value).toBe(4);
  });

  it("fennel bulb stays bulbs", () => {
    const f = toPreferredUnit(2, undefined, "fennel bulb");
    expect(f.unitType).toBe("count");
    expect(f.preferredUnit).toBe("bulbs");
  });

  it("walnuts default to weight", () => {
    const w = toPreferredUnit(35, undefined, "walnuts");
    expect(w.unitType).toBe("weight");
    expect(w.preferredUnit).toBe("g");
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
  it("preserves fractional count (0.5 + 0.5 = 1, 0.5 + 0.5 + 0.5 = 1.5)", () => {
    expect(addQuantities(0.5, 0.5, "head", "count").value).toBe(1);
    expect(addQuantities(1, 0.5, "head", "count").value).toBe(1.5);
    expect(addQuantities(0.5, 0.5, "head", "count").formatted).toBe("1 head");
    expect(addQuantities(1, 0.5, "head", "count").formatted).toBe("1.5 heads");
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

describe("formatQuantity singular and plural", () => {
  it("uses singular for 1 count unit", () => {
    expect(formatQuantity(1, "bulbs")).toBe("1 bulb");
    expect(formatQuantity(1, "cloves")).toBe("1 clove");
    expect(formatQuantity(1, "pcs")).toBe("1 pc");
    expect(formatQuantity(1, "head")).toBe("1 head");
  });
  it("uses plural for non-1 count (e.g. 1.5 heads, 2 cloves)", () => {
    expect(formatQuantity(1.5, "head")).toBe("1.5 heads");
    expect(formatQuantity(2, "head")).toBe("2 heads");
    expect(formatQuantity(6, "cloves")).toBe("6 cloves");
  });
  it("formats 0.5 count as 1/2 (e.g. 1/2 onion, 1/2 heads)", () => {
    expect(formatQuantity(0.5, "onion")).toBe("1/2 onions");
    expect(formatQuantity(0.5, "head")).toBe("1/2 heads");
  });
});
