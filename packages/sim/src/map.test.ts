import { describe, expect, it } from "vitest";
import { buildMap } from "./map";

describe("buildMap", () => {
  it("builds a map from ASCII rows", () => {
    const map = buildMap("test", "Test", ["S.", ".D"]);
    expect(map.width).toBe(2);
    expect(map.height).toBe(2);
    expect(map.playerSpawns).toHaveLength(1);
    expect(map.dummySpawns).toHaveLength(1);
    expect(map.solid.every((s) => s === false)).toBe(true);
  });

  it("accepts explicit spawns without an 'S' tile", () => {
    const map = buildMap("test", "Test", ["..", ".."], [], { players: [{ x: 1, y: 1 }] });
    expect(map.playerSpawns).toHaveLength(1);
  });

  it("throws when there are no rows", () => {
    expect(() => buildMap("test", "Test", [])).toThrowError('map "test": no rows');
  });

  it("throws on inconsistent row lengths", () => {
    expect(() => buildMap("test", "Test", ["##", "#"])).toThrowError(
      'map "test": row 1 has length 1, expected 2',
    );
  });

  it("throws on an unknown tile", () => {
    expect(() => buildMap("test", "Test", ["S?"])).toThrowError(
      'map "test": unknown tile "?" at 1,0',
    );
  });

  it("throws when there is no player spawn", () => {
    expect(() => buildMap("test", "Test", ["..", ".."])).toThrowError(
      'map "test": needs at least one player spawn',
    );
  });
});
