import { describe, expect, it } from "vitest";
import { isSolid } from "./collision";
import type { MapData } from "./content-types";
import { ARENA, input, makeWorld, player, run } from "./test-helpers";

describe("isSolid", () => {
  const map = {
    width: 3,
    height: 2,
    solid: [
      true, false, true,
      false, true, false,
    ],
  } as MapData;

  it("returns true for out-of-bounds coordinates", () => {
    expect(isSolid(map, -1, 0)).toBe(true);
    expect(isSolid(map, 0, -1)).toBe(true);
    expect(isSolid(map, 3, 0)).toBe(true);
    expect(isSolid(map, 0, 2)).toBe(true);
    expect(isSolid(map, -5, -5)).toBe(true);
    expect(isSolid(map, 10, 10)).toBe(true);
  });

  it("returns true for in-bounds solid tiles", () => {
    expect(isSolid(map, 0, 0)).toBe(true);
    expect(isSolid(map, 2, 0)).toBe(true);
    expect(isSolid(map, 1, 1)).toBe(true);
  });

  it("returns false for in-bounds non-solid tiles", () => {
    expect(isSolid(map, 1, 0)).toBe(false);
    expect(isSolid(map, 0, 1)).toBe(false);
    expect(isSolid(map, 2, 1)).toBe(false);
  });
});

describe("tile collision", () => {
  it("stands flush on the floor", () => {
    const world = makeWorld(ARENA);
    run(world, 60);
    // Floor is row 6; feet (center + half height) rest on its top edge.
    expect(player(world).pos.y + 0.8).toBeCloseTo(6, 3);
    expect(player(world).grounded).toBe(true);
    expect(player(world).vel.y).toBe(0);
  });

  it("stops at a wall when walking right", () => {
    const world = makeWorld(ARENA);
    run(world, 120, input({ moveX: 1 }));
    // Right wall is column 9; right edge (center + half width) flush against it.
    expect(player(world).pos.x + 0.4).toBeCloseTo(9, 3);
    expect(player(world).vel.x).toBe(0);
  });

  it("stops at a wall when walking left", () => {
    const world = makeWorld(ARENA);
    run(world, 120, input({ moveX: -1 }));
    expect(player(world).pos.x - 0.4).toBeCloseTo(1, 3);
    expect(player(world).vel.x).toBe(0);
  });

  it("bonks on a low ceiling and falls back down", () => {
    const world = makeWorld(["##########", "#........#", "#S.......#", "##########"]);
    run(world, 5);

    run(world, 1, input({ jump: true, jumpHeld: true }));
    let minY = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 60; i++) {
      run(world, 1, input({ jumpHeld: true }));
      minY = Math.min(minY, player(world).pos.y);
    }
    // Ceiling is row 0; head (center - half height) can never pass its bottom edge at y=1.
    expect(minY - 0.8).toBeGreaterThanOrEqual(1 - 1e-3);
    expect(player(world).grounded).toBe(true);
  });
});
