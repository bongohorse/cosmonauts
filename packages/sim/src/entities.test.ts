import { describe, expect, it } from "vitest";
import { DT } from "./constants";
import { ARENA, input, makeWorld, player, run } from "./test-helpers";

describe("map entities", () => {
  it("jumper launches the player", () => {
    const TALL_ARENA = [
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#S.......#",
      "##########",
    ];
    const world = makeWorld(
      TALL_ARENA,
      [],
      [
        {
          id: "j1",
          type: "jumper",
          pos: { x: 3, y: 8.5 },
          size: { w: 2, h: 1 },
          enabled: true,
          params: { direction: 90, strength: 20 },
        },
      ],
    );

    // Walk into the jumper (at x=3, player starts at x=1.5, y=8.2)
    run(world, 20, input({ moveX: 1 }));
    expect(player(world).vel.y).toBeLessThan(-9);
    expect(player(world).grounded).toBe(false);
  });

  it("forceField applies constant force", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "f1",
          type: "forceField",
          pos: { x: 3, y: 5 },
          size: { w: 2, h: 2 },
          enabled: true,
          params: { forceX: 10, forceY: -50 }, // Stronger than gravity (38)
        },
      ],
    );

    run(world, 20, input({ moveX: 1 })); // Inside the field
    const v1y = player(world).vel.y;
    run(world, 1, input({ moveX: 1 }));
    // Force field adds 10*DT, but stepPlayer might approach(v1, 8, accel*DT)
    expect(player(world).vel.x).not.toBe(8);
    expect(player(world).vel.y).toBeCloseTo(v1y + (38 - 50) * DT);
  });

  it("teleporter moves the player to the target", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "t1",
          type: "teleporter",
          pos: { x: 3, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: { targetId: "t2", preserveVelocity: false },
        },
        {
          id: "t2",
          type: "teleporter",
          pos: { x: 7, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: { targetId: "t1" },
        },
      ],
    );

    // Run until we are past t1's x=3.
    run(world, 40, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeGreaterThan(8);
  });

  it("fireField damages the player", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "fire",
          type: "fireField",
          pos: { x: 3, y: 5.5 },
          size: { w: 2, h: 2 },
          enabled: true,
          params: { dps: 100 },
        },
      ],
    );

    run(world, 20, input({ moveX: 1 }));
    const h1 = player(world).health;
    run(world, 1, input({ moveX: 1 }));
    expect(player(world).health).toBeLessThan(h1);
  });

  it("healField heals the player", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "heal",
          type: "healField",
          pos: { x: 3, y: 5.5 },
          size: { w: 2, h: 2 },
          enabled: true,
          params: { hps: 50 },
        },
      ],
    );

    player(world).health = 50;
    run(world, 20, input({ moveX: 1 }));
    const h1 = player(world).health;
    run(world, 1, input({ moveX: 1 }));
    expect(player(world).health).toBeGreaterThan(h1);
  });

  it("killZone kills the player and triggers respawn", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "kill",
          type: "killZone",
          pos: { x: 3, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: {},
        },
      ],
    );

    run(world, 20, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeLessThan(3);
    expect(player(world).health).toBeGreaterThan(0);
  });

  it("disabled entities have no effect", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "j1",
          type: "jumper",
          pos: { x: 3, y: 5.5 },
          size: { w: 2, h: 1 },
          enabled: false,
          params: { direction: 90, strength: 20 },
        },
      ],
    );

    run(world, 30, input({ moveX: 1 }));
    expect(player(world).vel.y).toBe(0);
  });
});
