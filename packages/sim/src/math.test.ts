import { describe, expect, it } from "vitest";
import { approach, clamp, dcos, dsin, rand, TWO_PI } from "./math";

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(3.5, 0, 10)).toBe(3.5);
  });
  it("clamps below min and above max", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("handles negative ranges", () => {
    expect(clamp(5, -10, -1)).toBe(-1);
    expect(clamp(-20, -10, -1)).toBe(-10);
  });
  it("returns the bound when min === max", () => {
    expect(clamp(7, 5, 5)).toBe(5);
  });
});

describe("approach", () => {
  it("moves up toward a higher target without overshooting", () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(8, 10, 5)).toBe(10);
  });
  it("moves down toward a lower target without overshooting", () => {
    expect(approach(10, 0, 3)).toBe(7);
    expect(approach(2, 0, 5)).toBe(0);
  });
  it("returns the target when already there", () => {
    expect(approach(5, 5, 2)).toBe(5);
  });
  it("works with negative values and a zero step", () => {
    expect(approach(-10, -5, 2)).toBe(-8);
    expect(approach(-5, -10, 2)).toBe(-7);
    expect(approach(3, 10, 0)).toBe(3);
  });
});

describe("dsin / dcos (deterministic trig)", () => {
  it("matches the builtin at cardinal angles", () => {
    expect(dsin(0)).toBeCloseTo(0, 6);
    expect(dsin(Math.PI / 2)).toBeCloseTo(1, 6);
    expect(dsin(Math.PI)).toBeCloseTo(0, 6);
    expect(dsin(-Math.PI / 2)).toBeCloseTo(-1, 6);
    expect(dcos(0)).toBeCloseTo(1, 6);
    expect(dcos(Math.PI / 2)).toBeCloseTo(0, 6);
    expect(dcos(Math.PI)).toBeCloseTo(-1, 6);
  });
  it("range-reduces angles outside [-2π, 2π]", () => {
    expect(dsin(TWO_PI + Math.PI / 2)).toBeCloseTo(1, 6);
    expect(dsin(100 * Math.PI)).toBeCloseTo(0, 6);
    expect(dcos(-100 * Math.PI)).toBeCloseTo(1, 6);
  });
  it("stays within ~2e-7 of the builtin across a sweep", () => {
    for (let x = -20; x <= 20; x += 0.1) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-6);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-6);
    }
  });
});

describe("rand (mulberry32)", () => {
  it("is a pure function of its state", () => {
    expect(rand(1)).toEqual(rand(1));
    expect(rand(42)).toEqual(rand(42));
  });
  it("returns values in [0, 1) with an integer next-state", () => {
    let state = 12345;
    for (let i = 0; i < 1000; i++) {
      const [value, next] = rand(state);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(Number.isInteger(next)).toBe(true);
      state = next;
    }
  });
  it("advances state so successive draws differ", () => {
    const [v0, s1] = rand(1);
    const [v1] = rand(s1);
    expect(v0).not.toBe(v1);
  });
  it("locks known outputs (cross-engine determinism regression)", () => {
    expect(rand(1)).toEqual([0.6270739405881613, 1831565814]);
    expect(rand(1831565814)).toEqual([0.002735721180215478, -631835669]);
  });
});
