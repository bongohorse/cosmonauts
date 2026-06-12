import { describe, expect, it } from "vitest";
import { clamp } from "./math";

describe("clamp", () => {
  it("returns the value when it is within the bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns the minimum bound when the value is below it", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns the maximum bound when the value is above it", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("works with negative ranges", () => {
    expect(clamp(-5, -10, -2)).toBe(-5);
    expect(clamp(-15, -10, -2)).toBe(-10);
    expect(clamp(0, -10, -2)).toBe(-2);
  });

  it("works with floating point numbers", () => {
    expect(clamp(5.5, 0.5, 10.5)).toBe(5.5);
    expect(clamp(0.1, 0.5, 10.5)).toBe(0.5);
    expect(clamp(11.5, 0.5, 10.5)).toBe(10.5);
  });

  it("handles edge case where min equals max", () => {
    expect(clamp(5, 10, 10)).toBe(10);
    expect(clamp(15, 10, 10)).toBe(10);
    expect(clamp(10, 10, 10)).toBe(10);
  });
});
