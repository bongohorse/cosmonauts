import { describe, expect, it } from "vitest";
import { input, makeWorld, player, run, type World } from "./test-helpers";

const ROOM = [
  "##########",
  "#........#",
  "#........#",
  "#........#",
  "#........#",
  "#........#",
  "#S.......#",
  "##########",
];

// Horizontal glass platform at y=4.5 — reachable with a single full hop from the
// floor (feet at y=7, apex ≈ 2.77 tiles).
const GLASS = [
  {
    id: "glass1",
    kind: "polyline" as const,
    solidity: "glass" as const,
    points: [
      [1, 4.5],
      [8, 4.5],
    ] as [number, number][],
  },
];

function landOnGlass(world: World): void {
  run(world, 10); // settle on floor
  run(world, 1, input({ jump: true, jumpHeld: true }));
  run(world, 90, input({ jumpHeld: true }));
}

describe("glass platforms (drop-through)", () => {
  it("jumps up through the glass and lands on top of it", () => {
    const world = makeWorld(ROOM, GLASS);
    landOnGlass(world);
    const p = player(world);
    expect(p.grounded).toBe(true);
    expect(p.groundGlass).toBe(true);
    expect(p.pos.y + 0.8).toBeCloseTo(4.5, 2); // feet on the glass face
  });

  it("pressing down alone drops through (the default)", () => {
    const world = makeWorld(ROOM, GLASS);
    landOnGlass(world);

    run(world, 1, input({ down: true }));
    expect(player(world).grounded).toBe(false);
    expect(player(world).jumpsUsed).toBe(0);

    run(world, 90);
    expect(player(world).pos.y + 0.8).toBeCloseTo(7, 2); // on the floor below
  });

  it("holding down on solid ground does nothing", () => {
    const world = makeWorld(ROOM, GLASS);
    run(world, 10);
    run(world, 30, input({ down: true }));
    const p = player(world);
    expect(p.grounded).toBe(true);
    expect(p.pos.y + 0.8).toBeCloseTo(7, 2); // still standing on the floor
  });

  it("down+jump drops through without consuming a jump", () => {
    const world = makeWorld(ROOM, GLASS);
    landOnGlass(world);
    expect(player(world).jumpsUsed).toBe(0);

    run(world, 1, input({ down: true, jump: true, jumpHeld: true }));
    expect(player(world).grounded).toBe(false);
    expect(player(world).jumpsUsed).toBe(0); // a drop, not a jump

    run(world, 90);
    const p = player(world);
    expect(p.grounded).toBe(true);
    expect(p.groundGlass).toBe(false);
    expect(p.pos.y + 0.8).toBeCloseTo(7, 2); // back on the solid floor
  });

  it("down+jump on solid ground is just a jump", () => {
    const world = makeWorld(ROOM, GLASS);
    run(world, 10);
    run(world, 1, input({ down: true, jump: true, jumpHeld: true }));
    const p = player(world);
    expect(p.vel.y).toBeLessThan(0); // rising
    expect(p.jumpsUsed).toBe(1);
  });

  it("walking off the glass edge falls instead of snapping to it", () => {
    const world = makeWorld(ROOM, GLASS);
    landOnGlass(world);
    // Walk right past the platform edge at x=8 and keep walking through the fall.
    for (let i = 0; i < 200 && player(world).grounded; i++) {
      run(world, 1, input({ moveX: 1 }));
    }
    run(world, 120, input({ moveX: 1 }));
    const p = player(world);
    expect(p.grounded).toBe(true);
    expect(p.pos.y + 0.8).toBeCloseTo(7, 2); // landed on the floor below
  });

  it("projectiles fly through glass but not through solid", () => {
    const world = makeWorld(ROOM, GLASS);
    run(world, 10);
    // Shoot straight up through the glass: projectile should survive past it
    // and die on the ceiling instead.
    run(world, 1, input({ shoot: true, aimX: 0, aimY: -1 }));
    expect(world.state.projectiles).toHaveLength(1);
    run(world, 8); // ~2.9 tiles of travel — already past the glass at y=4.5
    expect(world.state.projectiles).toHaveLength(1);
    run(world, 30); // reaches the ceiling
    expect(world.state.projectiles).toHaveLength(0);
  });
});
