import { describe, expect, it } from "vitest";
import { aabbOverlap, isSolid } from "./collision";
import type { MapData } from "./content-types";
import { ARENA, input, makeWorld, player, run } from "./test-helpers";

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

describe("aabbOverlap", () => {
  it("detects identical and partially overlapping boxes", () => {
    expect(aabbOverlap(0, 0, 1, 1, 0, 0, 1, 1)).toBe(true);
    expect(aabbOverlap(0, 0, 1, 1, 1.5, 0, 1, 1)).toBe(true);
  });
  it("treats a fully-contained box as overlapping", () => {
    expect(aabbOverlap(0, 0, 2, 2, 0, 0, 0.5, 0.5)).toBe(true);
  });
  it("returns false when separated on either axis", () => {
    expect(aabbOverlap(0, 0, 1, 1, 3, 0, 1, 1)).toBe(false);
    expect(aabbOverlap(0, 0, 1, 1, 0, 3, 1, 1)).toBe(false);
  });
  it("treats exactly-touching edges as non-overlapping (strict <)", () => {
    expect(aabbOverlap(0, 0, 1, 1, 2, 0, 1, 1)).toBe(false);
  });
});

describe("isSolid", () => {
  // 3x2 grid, row-major: index = ty * width + tx
  const map = {
    width: 3,
    height: 2,
    solid: [false, true, false, false, false, true],
  } as unknown as MapData;

  it("reads the row-major solid grid", () => {
    expect(isSolid(map, 1, 0)).toBe(true);
    expect(isSolid(map, 0, 0)).toBe(false);
    expect(isSolid(map, 2, 1)).toBe(true);
  });
  it("treats out-of-bounds tiles as solid", () => {
    expect(isSolid(map, -1, 0)).toBe(true);
    expect(isSolid(map, 0, -1)).toBe(true);
    expect(isSolid(map, 3, 0)).toBe(true);
    expect(isSolid(map, 0, 2)).toBe(true);
  });
});
