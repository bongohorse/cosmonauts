import { describe, expect, it } from "vitest";
import { rand, clamp, approach, dsin, dcos } from "./math.js";

describe("math", () => {
  describe("clamp", () => {
    it("returns value if within bounds", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
    it("returns min if value is less than min", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });
    it("returns max if value is greater than max", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe("approach", () => {
    it("moves current toward target by maxDelta", () => {
      expect(approach(0, 10, 2)).toBe(2);
      expect(approach(10, 0, 2)).toBe(8);
    });
    it("does not overshoot target", () => {
      expect(approach(8, 10, 5)).toBe(10);
      expect(approach(2, 0, 5)).toBe(0);
    });
    it("returns target if current is already target", () => {
      expect(approach(5, 5, 2)).toBe(5);
    });
  });

  describe("dsin", () => {
    it("approximates Math.sin", () => {
      expect(dsin(0)).toBeCloseTo(Math.sin(0), 5);
      expect(dsin(Math.PI / 2)).toBeCloseTo(Math.sin(Math.PI / 2), 5);
      expect(dsin(Math.PI)).toBeCloseTo(Math.sin(Math.PI), 5);
      expect(dsin((3 * Math.PI) / 2)).toBeCloseTo(Math.sin((3 * Math.PI) / 2), 5);
      expect(dsin(2 * Math.PI)).toBeCloseTo(Math.sin(2 * Math.PI), 5);
      expect(dsin(-Math.PI / 4)).toBeCloseTo(Math.sin(-Math.PI / 4), 5);
    });
  });

  describe("dcos", () => {
    it("approximates Math.cos", () => {
      expect(dcos(0)).toBeCloseTo(Math.cos(0), 5);
      expect(dcos(Math.PI / 2)).toBeCloseTo(Math.cos(Math.PI / 2), 5);
      expect(dcos(Math.PI)).toBeCloseTo(Math.cos(Math.PI), 5);
      expect(dcos((3 * Math.PI) / 2)).toBeCloseTo(Math.cos((3 * Math.PI) / 2), 5);
      expect(dcos(2 * Math.PI)).toBeCloseTo(Math.cos(2 * Math.PI), 5);
      expect(dcos(-Math.PI / 4)).toBeCloseTo(Math.cos(-Math.PI / 4), 5);
    });
  });

  describe("rand", () => {
    it("is deterministic (same seed yields same sequence)", () => {
      let state1 = 12345;
      const seq1: number[] = [];
      for (let i = 0; i < 10; i++) {
        const [val, nextState] = rand(state1);
        seq1.push(val);
        state1 = nextState;
      }

      let state2 = 12345;
      const seq2: number[] = [];
      for (let i = 0; i < 10; i++) {
        const [val, nextState] = rand(state2);
        seq2.push(val);
        state2 = nextState;
      }

      expect(seq1).toEqual(seq2);
    });

    it("produces values between 0 (inclusive) and 1 (exclusive)", () => {
      let state = 98765;
      for (let i = 0; i < 1000; i++) {
        const [val, nextState] = rand(state);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
        state = nextState;
      }
    });

    it("returns expected fixed values for a known seed", () => {
      let state = 1;
      const [val1, nextState1] = rand(state);
      expect(val1).toBeCloseTo(0.6270739405881613, 5);
      expect(nextState1).toBe(1831565814);

      const [val2, nextState2] = rand(nextState1);
      expect(val2).toBeCloseTo(0.002735721180215478, 5);
      expect(nextState2).toBe(-631835669);
    });
  });
});
