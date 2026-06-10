import { describe, expect, it } from "vitest";
import { input, makeWorld, player, run } from "./test-helpers";

const FLAT = [
  "####################",
  "#..................#",
  "#..................#",
  "#..................#",
  "#..................#",
  "#S.................#",
  "####################",
];

// Ramp rising rightward from the floor (y=6) at ~21°: walkable.
const RAMP = [
  {
    id: "ramp",
    kind: "polygon" as const,
    solidity: "solid" as const,
    points: [
      [6, 6],
      [14, 6],
      [14, 3],
    ] as [number, number][],
  },
];

describe("slopes", () => {
  it("walks up a ramp staying grounded the whole climb", () => {
    const world = makeWorld(FLAT, RAMP);
    run(world, 10);
    const startY = player(world).pos.y;

    let groundedTicks = 0;
    let total = 0;
    while (player(world).pos.x < 12 && total < 300) {
      run(world, 1, input({ moveX: 1 }));
      if (player(world).grounded) groundedTicks++;
      total++;
    }
    expect(player(world).pos.x).toBeGreaterThanOrEqual(12);
    expect(player(world).pos.y).toBeLessThan(startY - 1.5); // actually climbed
    expect(player(world).grounded).toBe(true);
    // Snapping keeps us glued to the surface; allow the few airborne ticks at the ramp base.
    expect(groundedTicks / total).toBeGreaterThan(0.9);
  });

  it("stands on a slope without sliding or creeping", () => {
    const world = makeWorld(FLAT, RAMP);
    run(world, 10);
    // Walk onto the middle of the ramp, then let go.
    while (player(world).pos.x < 10) run(world, 1, input({ moveX: 1 }));
    run(world, 10); // decelerate
    const restX = player(world).pos.x;
    const restY = player(world).pos.y;

    run(world, 120);
    expect(player(world).grounded).toBe(true);
    expect(Math.abs(player(world).pos.x - restX)).toBeLessThan(0.01);
    expect(Math.abs(player(world).pos.y - restY)).toBeLessThan(0.01);
  });

  it("cannot stand on a too-steep face and ends up on the floor", () => {
    // ~68° face — steeper than the 50° walkable limit.
    const world = makeWorld(FLAT, [
      {
        id: "steep",
        kind: "polygon" as const,
        solidity: "solid" as const,
        points: [
          [10, 6],
          [12, 6],
          [12, 1],
        ] as [number, number][],
      },
    ]);
    run(world, 5);
    // Drop the player onto the steep face.
    player(world).pos.x = 11.2;
    player(world).pos.y = 1.5;
    player(world).vel.x = 0;
    player(world).vel.y = 0;

    let stoodOnSteep = false;
    for (let i = 0; i < 180; i++) {
      run(world, 1);
      const p = player(world);
      if (p.grounded && p.pos.y < 4.5) stoodOnSteep = true;
    }
    expect(stoodOnSteep).toBe(false); // never counted the steep face as ground
    expect(player(world).grounded).toBe(true); // ended standing somewhere flat
    expect(player(world).pos.y + 0.8).toBeCloseTo(6, 1); // on the floor
  });

  it("walks over a ramp crest without launching airborne", () => {
    // Ramp up to a plateau: crest at (14,3) continuing flat to x=18.
    const world = makeWorld(FLAT, [
      {
        id: "rampTop",
        kind: "polygon" as const,
        solidity: "solid" as const,
        points: [
          [6, 6],
          [19, 6],
          [19, 3],
          [14, 3],
        ] as [number, number][],
      },
    ]);
    run(world, 10);
    let airborneAfterCrest = 0;
    while (player(world).pos.x < 17) {
      run(world, 1, input({ moveX: 1 }));
      const p = player(world);
      if (p.pos.x > 14.5 && !p.grounded) airborneAfterCrest++;
      if (world.state.tick > 600) break;
    }
    expect(player(world).pos.x).toBeGreaterThanOrEqual(17);
    expect(airborneAfterCrest).toBeLessThanOrEqual(2); // snap catches the crest
  });
});
