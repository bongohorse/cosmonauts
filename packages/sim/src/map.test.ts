import { describe, it, expect } from "vitest";
import { buildMap } from "./map";

describe("buildMap", () => {
  it("throws if there are no rows", () => {
    expect(() => buildMap("test", "Test Map", [])).toThrow('map "test": no rows');
  });

  it("throws if a row length is inconsistent", () => {
    expect(() => buildMap("test", "Test Map", ["S.", "."])).toThrow('map "test": row 1 has length 1, expected 2');
  });

  it("throws if there is an unknown tile", () => {
    expect(() => buildMap("test", "Test Map", ["S?", ".."])).toThrow('map "test": unknown tile "?" at 1,0');
  });

  it("throws if there is no player spawn", () => {
    expect(() => buildMap("test", "Test Map", ["..", ".."])).toThrow('map "test": needs at least one player spawn');
  });

  it("builds a map successfully on happy path", () => {
    const result = buildMap("test", "Test Map", ["S.", ".D"]);
    expect(result.id).toBe("test");
    expect(result.name).toBe("Test Map");
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.playerSpawns.length).toBe(1);
    expect(result.dummySpawns.length).toBe(1);
    expect(result.solid).toEqual([false, false, false, false]); // 'S.', '.D' all are non-solid ('#')
  });
});
