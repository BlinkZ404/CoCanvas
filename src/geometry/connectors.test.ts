import { describe, expect, it } from "vitest";
import { box } from "../test/helpers";
import { connectorLayout } from "./connectors";

describe("connectorLayout", () => {
  it("draws a straight horizontal path when nodes share a band", () => {
    const from = box({ id: "a", x: 0, y: 40, width: 100, height: 80 });
    const to = box({ id: "b", x: 220, y: 40, width: 100, height: 80 });
    const geo = connectorLayout(from, to);
    expect(geo.d.startsWith("M ")).toBe(true);
    expect(geo.d.includes(" L ")).toBe(true);
    expect(geo.length).toBeGreaterThan(80);
    expect(geo.d.split(" L ")).toHaveLength(2);
  });

  it("uses an elbow when nodes are offset", () => {
    const from = box({ id: "a", x: 0, y: 0, width: 80, height: 60 });
    const to = box({ id: "b", x: 200, y: 180, width: 80, height: 60 });
    const geo = connectorLayout(from, to);
    expect(geo.d.split(" L ").length).toBeGreaterThan(2);
    expect(geo.length).toBeGreaterThan(0);
  });

  it("routes vertically when the target is below", () => {
    const from = box({ id: "a", x: 40, y: 0, width: 80, height: 40 });
    const to = box({ id: "b", x: 40, y: 200, width: 80, height: 40 });
    const geo = connectorLayout(from, to);
    expect(geo.length).toBeGreaterThan(100);
    expect(geo.labelX).toBeGreaterThan(0);
  });

  it("attaches to an ellipse rim instead of the bounding box", () => {
    const from = box({ id: "a", kind: "ellipse", x: 0, y: 0, width: 100, height: 100 });
    const to = box({ id: "b", x: 200, y: 0, width: 80, height: 40 });
    const geo = connectorLayout(from, to);
    const startX = Number(geo.d.split(" ")[1]);
    expect(startX).toBeLessThan(100);
    expect(startX).toBeGreaterThan(50);
  });
});
