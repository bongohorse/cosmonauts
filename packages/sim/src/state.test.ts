import { describe, expect, it } from "vitest";
import type { MapData } from "./content-types";
import { cloneState, playerSpawnPos } from "./state";
import { ARENA, makeWorld } from "./test-helpers";

describe("playerSpawnPos", () => {
  const map = {
    id: "spawns",
    playerSpawns: [
      { x: 1, y: 1, team: "RED" },
      { x: 5, y: 1, team: "BLU" },
    ],
  } as unknown as MapData;

  it("places feet on the spawn tile, offset by half the hitbox height", () => {
    expect(playerSpawnPos(map, "RED", 0, 1.6)).toEqual({ x: 1, y: 1 + 0.5 - 0.8 });
  });
  it("filters spawns by team", () => {
    expect(playerSpawnPos(map, "BLU", 0, 1.0)).toEqual({ x: 5, y: 1 });
  });
  it("wraps the index over the team's spawns", () => {
    expect(playerSpawnPos(map, "BLU", 3, 1.0)).toEqual({ x: 5, y: 1 });
  });
  it("falls back to all spawns when a team has none", () => {
    const redOnly = {
      id: "red-only",
      playerSpawns: [{ x: 2, y: 2, team: "RED" }],
    } as unknown as MapData;
    expect(playerSpawnPos(redOnly, "BLU", 0, 0)).toEqual({ x: 2, y: 2.5 });
  });
  it("throws when the map has no player spawns", () => {
    const empty = { id: "empty", playerSpawns: [] } as unknown as MapData;
    expect(() => playerSpawnPos(empty, "RED", 0, 1.6)).toThrowError(
      'map "empty" has no player spawns',
    );
  });
});

describe("cloneState", () => {
  it("deep-clones into an independent snapshot", () => {
    const { state } = makeWorld(ARENA);
    const clone = cloneState(state);

    expect(clone).toEqual(state);
    expect(clone).not.toBe(state);
    expect(clone.players).not.toBe(state.players);
    expect(clone.players[0]).not.toBe(state.players[0]);
  });

  it("does not let clone mutations leak into the original", () => {
    const { state } = makeWorld(ARENA);
    const clone = cloneState(state);

    clone.tick = 999;
    const p = clone.players[0];
    if (p) p.health = 0;
    clone.projectiles.push({
      id: 1,
      team: "RED",
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 0.2,
      damage: 5,
      ticksLeft: 10,
    });

    expect(state.tick).toBe(0);
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.health).toBe(100); // unchanged from maxHealth, not the clone's 0
    expect(state.projectiles).toHaveLength(0);
  });
});
