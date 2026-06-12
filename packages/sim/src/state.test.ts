import { describe, expect, it } from "vitest";
import type { MapData } from "./content-types";
import { playerSpawnPos } from "./state";

describe("playerSpawnPos", () => {
  it("throws an error if map has no player spawns", () => {
    const mockMap = {
      id: "empty-map",
      playerSpawns: [],
    } as unknown as MapData;

    expect(() => playerSpawnPos(mockMap, "RED", 0, 1.6)).toThrow(
      'map "empty-map" has no player spawns',
    );
  });
});
