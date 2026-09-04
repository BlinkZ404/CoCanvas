import { describe, expect, it } from "vitest";
import { DESIGN_SPEC, isDecorShape, rectangleRole } from "./design";

describe("rectangleRole", () => {
  it("treats a 1px strip as a rule and a tall thin block as a bar", () => {
    expect(rectangleRole({ kind: "rectangle", width: 720, height: 1 })).toBe("rule");
    expect(rectangleRole({ kind: "rectangle", width: 28, height: 120 })).toBe("bar");
    expect(rectangleRole({ kind: "rectangle", width: 720, height: 40 })).toBe("row");
    expect(rectangleRole({ kind: "rectangle", width: 168, height: 104 })).toBeNull();
    expect(rectangleRole({ kind: "ellipse", width: 28, height: 120 })).toBeNull();
  });
});

describe("DESIGN_SPEC", () => {
  it("requires a diagram on void paper and ASCII copy", () => {
    expect(DESIGN_SPEC).toMatch(/#0a0a0a/);
    expect(DESIGN_SPEC).toMatch(/diagram/);
    expect(DESIGN_SPEC).toMatch(/connect/i);
    expect(DESIGN_SPEC).toMatch(/32px/);
    expect(DESIGN_SPEC).toMatch(/newline/);
    expect(DESIGN_SPEC).toMatch(/1400/);
    expect(DESIGN_SPEC).toMatch(/em dash/);
    expect(DESIGN_SPEC).not.toMatch(/[\u2012-\u2015\u2018\u2019\u201C\u201D]/);
    expect(DESIGN_SPEC).toMatch(/No rainbow cards/);
    expect(DESIGN_SPEC).toMatch(/tree/);
    expect(DESIGN_SPEC).toMatch(/Do not connect those four/);
    expect(DESIGN_SPEC).toMatch(/Cited scores are a list/);
    expect(DESIGN_SPEC).toMatch(/compact ellipse/);
    expect(DESIGN_SPEC).toMatch(/Do not stretch the hub/);
  });
});

describe("isDecorShape", () => {
  it("treats rules, rows, and bars as decoration", () => {
    expect(isDecorShape({ kind: "rectangle", width: 720, height: 1 })).toBe(true);
    expect(isDecorShape({ kind: "rectangle", width: 400, height: 28 })).toBe(true);
    expect(isDecorShape({ kind: "rectangle", width: 28, height: 120 })).toBe(true);
    expect(isDecorShape({ kind: "rectangle", width: 220, height: 120 })).toBe(false);
  });
});
