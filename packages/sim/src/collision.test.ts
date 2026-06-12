import { describe, expect, it } from "vitest";
import { aabbOverlap } from "./collision";
import { ARENA, input, makeWorld, player, run } from "./test-helpers";

describe("aabbOverlap", () => {
  it("returns true for exact same AABBs", () => {
    expect(aabbOverlap(0, 0, 5, 5, 0, 0, 5, 5)).toBe(true);
  });

  it("returns true for partial overlaps", () => {
    expect(aabbOverlap(0, 0, 5, 5, 4, 4, 5, 5)).toBe(true);
    expect(aabbOverlap(0, 0, 5, 5, -4, -4, 5, 5)).toBe(true);
    expect(aabbOverlap(10, 10, 2, 2, 11, 9, 3, 3)).toBe(true);
  });

  it("returns true when one AABB is completely inside another", () => {
    expect(aabbOverlap(0, 0, 10, 10, 0, 0, 2, 2)).toBe(true);
    expect(aabbOverlap(0, 0, 2, 2, 0, 0, 10, 10)).toBe(true);
    expect(aabbOverlap(0, 0, 10, 10, 2, 3, 2, 2)).toBe(true);
  });

  it("returns false for AABBs missing each other completely on X axis", () => {
    expect(aabbOverlap(0, 0, 5, 5, 12, 0, 5, 5)).toBe(false);
    expect(aabbOverlap(0, 0, 5, 5, -12, 0, 5, 5)).toBe(false);
  });

  it("returns false for AABBs missing each other completely on Y axis", () => {
    expect(aabbOverlap(0, 0, 5, 5, 0, 12, 5, 5)).toBe(false);
    expect(aabbOverlap(0, 0, 5, 5, 0, -12, 5, 5)).toBe(false);
  });

  it("returns false for AABBs that are exactly touching edges", () => {
    expect(aabbOverlap(0, 0, 5, 5, 10, 0, 5, 5)).toBe(false); // Touching right
    expect(aabbOverlap(0, 0, 5, 5, -10, 0, 5, 5)).toBe(false); // Touching left
    expect(aabbOverlap(0, 0, 5, 5, 0, 10, 5, 5)).toBe(false); // Touching bottom
    expect(aabbOverlap(0, 0, 5, 5, 0, -10, 5, 5)).toBe(false); // Touching top
    expect(aabbOverlap(0, 0, 5, 5, 10, 10, 5, 5)).toBe(false); // Touching corner
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
