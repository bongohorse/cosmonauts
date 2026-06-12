import { describe, expect, it } from "vitest";
import { approach } from "./math";

describe("approach", () => {
  it("moves current towards target by maxDelta when current < target", () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(3, 10, 3)).toBe(6);
  });

  it("clamps to target when current < target and maxDelta would overshoot", () => {
    expect(approach(8, 10, 5)).toBe(10);
  });

  it("moves current towards target by maxDelta when current > target", () => {
    expect(approach(10, 0, 3)).toBe(7);
    expect(approach(7, 0, 3)).toBe(4);
  });

  it("clamps to target when current > target and maxDelta would overshoot", () => {
    expect(approach(2, 0, 5)).toBe(0);
  });

  it("returns target when current equals target", () => {
    expect(approach(5, 5, 2)).toBe(5);
  });

  it("works correctly with negative values", () => {
    expect(approach(-10, -5, 2)).toBe(-8);
    expect(approach(-5, -10, 2)).toBe(-7);
    expect(approach(-7, -5, 10)).toBe(-5);
    expect(approach(-5, -7, 10)).toBe(-7);
  });

  it("does not move when maxDelta is 0", () => {
    expect(approach(0, 10, 0)).toBe(0);
    expect(approach(10, 0, 0)).toBe(10);
  });
});
