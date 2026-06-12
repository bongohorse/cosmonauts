import { describe, expect, it } from "vitest";
import { dcos, dsin, TWO_PI } from "./math";

describe("math", () => {
  describe("dsin", () => {
    it("handles standard angles correctly", () => {
      expect(dsin(0)).toBeCloseTo(Math.sin(0), 6);
      expect(dsin(Math.PI / 2)).toBeCloseTo(Math.sin(Math.PI / 2), 6);
      expect(dsin(-Math.PI / 2)).toBeCloseTo(Math.sin(-Math.PI / 2), 6);
      expect(dsin(Math.PI)).toBeCloseTo(Math.sin(Math.PI), 6);
      expect(dsin(-Math.PI)).toBeCloseTo(Math.sin(-Math.PI), 6);
    });

    it("handles out of bounds values correctly", () => {
      expect(dsin(TWO_PI)).toBeCloseTo(Math.sin(TWO_PI), 6);
      expect(dsin(-TWO_PI)).toBeCloseTo(Math.sin(-TWO_PI), 6);
      expect(dsin(TWO_PI + Math.PI / 2)).toBeCloseTo(Math.sin(TWO_PI + Math.PI / 2), 6);
      expect(dsin(10 * TWO_PI + Math.PI / 4)).toBeCloseTo(Math.sin(10 * TWO_PI + Math.PI / 4), 6);
    });

    it("matches Math.sin within 3e-7 tolerance across a range", () => {
      for (let i = -10; i <= 10; i += 0.1) {
        expect(Math.abs(dsin(i) - Math.sin(i))).toBeLessThan(3e-7);
      }
    });
  });

  describe("dcos", () => {
    it("handles standard angles correctly", () => {
      expect(dcos(0)).toBeCloseTo(Math.cos(0), 6);
      expect(dcos(Math.PI / 2)).toBeCloseTo(Math.cos(Math.PI / 2), 6);
      expect(dcos(-Math.PI / 2)).toBeCloseTo(Math.cos(-Math.PI / 2), 6);
      expect(dcos(Math.PI)).toBeCloseTo(Math.cos(Math.PI), 6);
      expect(dcos(-Math.PI)).toBeCloseTo(Math.cos(-Math.PI), 6);
    });

    it("matches Math.cos within 3e-7 tolerance across a range", () => {
      for (let i = -10; i <= 10; i += 0.1) {
        expect(Math.abs(dcos(i) - Math.cos(i))).toBeLessThan(3e-7);
      }
    });
  });
});
