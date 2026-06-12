import { describe, expect, it } from "vitest";
import { dcos, dsin, TWO_PI } from "./math";

describe("deterministic trigonometry", () => {
  describe("dsin", () => {
    it("handles common angles", () => {
      expect(dsin(0)).toBeCloseTo(0, 5);
      expect(dsin(Math.PI / 2)).toBeCloseTo(1, 5);
      expect(dsin(Math.PI)).toBeCloseTo(0, 5);
      expect(dsin((3 * Math.PI) / 2)).toBeCloseTo(-1, 5);
      expect(dsin(TWO_PI)).toBeCloseTo(0, 5);
    });

    it("handles negative angles", () => {
      expect(dsin(-Math.PI / 2)).toBeCloseTo(-1, 5);
      expect(dsin(-Math.PI)).toBeCloseTo(0, 5);
      expect(dsin((-3 * Math.PI) / 2)).toBeCloseTo(1, 5);
      expect(dsin(-TWO_PI)).toBeCloseTo(0, 5);
    });

    it("handles angles outside [-2π, 2π]", () => {
      expect(dsin(5 * Math.PI)).toBeCloseTo(0, 5);
      expect(dsin((9 * Math.PI) / 2)).toBeCloseTo(1, 5);
      expect(dsin(-5 * Math.PI)).toBeCloseTo(0, 5);
      expect(dsin((-9 * Math.PI) / 2)).toBeCloseTo(-1, 5);
      expect(dsin(100 * Math.PI)).toBeCloseTo(0, 5);
    });

    it("is close to Math.sin", () => {
      for (let i = -10; i <= 10; i += 0.5) {
        expect(dsin(i)).toBeCloseTo(Math.sin(i), 6);
      }
    });
  });

  describe("dcos", () => {
    it("handles common angles", () => {
      expect(dcos(0)).toBeCloseTo(1, 5);
      expect(dcos(Math.PI / 2)).toBeCloseTo(0, 5);
      expect(dcos(Math.PI)).toBeCloseTo(-1, 5);
      expect(dcos((3 * Math.PI) / 2)).toBeCloseTo(0, 5);
      expect(dcos(TWO_PI)).toBeCloseTo(1, 5);
    });

    it("handles negative angles", () => {
      expect(dcos(-Math.PI / 2)).toBeCloseTo(0, 5);
      expect(dcos(-Math.PI)).toBeCloseTo(-1, 5);
      expect(dcos((-3 * Math.PI) / 2)).toBeCloseTo(0, 5);
      expect(dcos(-TWO_PI)).toBeCloseTo(1, 5);
    });

    it("handles angles outside [-2π, 2π]", () => {
      expect(dcos(5 * Math.PI)).toBeCloseTo(-1, 5);
      expect(dcos((9 * Math.PI) / 2)).toBeCloseTo(0, 5);
      expect(dcos(-5 * Math.PI)).toBeCloseTo(-1, 5);
      expect(dcos((-9 * Math.PI) / 2)).toBeCloseTo(0, 5);
      expect(dcos(100 * Math.PI)).toBeCloseTo(1, 5);
    });

    it("is close to Math.cos", () => {
      for (let i = -10; i <= 10; i += 0.5) {
        expect(dcos(i)).toBeCloseTo(Math.cos(i), 6);
      }
    });
  });
});
