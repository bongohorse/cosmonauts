import { describe, expect, it } from "vitest";
import { ARENA, input, makeWorld, player, run } from "./test-helpers";

describe("horizontal movement", () => {
  it("accelerates to max run speed and stops when input ends", () => {
    const world = makeWorld(ARENA);
    run(world, 5); // settle on the ground
    const startX = player(world).pos.x;

    run(world, 30, input({ moveX: 1 }));
    expect(player(world).vel.x).toBe(8);
    expect(player(world).pos.x).toBeGreaterThan(startX);

    run(world, 30);
    expect(player(world).vel.x).toBe(0);
  });
});

describe("jumping", () => {
  it("leaves the ground and lands again", () => {
    const world = makeWorld(ARENA);
    run(world, 5);
    expect(player(world).grounded).toBe(true);

    run(world, 1, input({ jump: true, jumpHeld: true }));
    expect(player(world).grounded).toBe(false);
    expect(player(world).vel.y).toBeLessThan(0);

    run(world, 120, input({ jumpHeld: true }));
    expect(player(world).grounded).toBe(true);
    expect(player(world).jumpsUsed).toBe(0);
  });

  it("reaches an apex near v²/2g tiles", () => {
    const world = makeWorld([
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#S.......#",
      "##########",
    ]);
    run(world, 5);
    const groundY = player(world).pos.y;

    run(world, 1, input({ jump: true, jumpHeld: true }));
    let apex = 0;
    for (let i = 0; i < 60; i++) {
      run(world, 1, input({ jumpHeld: true }));
      apex = Math.max(apex, groundY - player(world).pos.y);
    }
    // Analytic apex: 14.5² / (2·38) ≈ 2.77 tiles; discrete integration lands close.
    expect(apex).toBeGreaterThan(2.3);
    expect(apex).toBeLessThan(3.2);
  });

  it("allows a double jump but not a triple jump", () => {
    const world = makeWorld(ARENA);
    run(world, 5);

    run(world, 1, input({ jump: true, jumpHeld: true }));
    expect(player(world).jumpsUsed).toBe(1);

    run(world, 10, input({ jumpHeld: true }));
    run(world, 1, input({ jump: true, jumpHeld: true }));
    expect(player(world).jumpsUsed).toBe(2);

    run(world, 10, input({ jumpHeld: true }));
    const velBefore = player(world).vel.y;
    run(world, 1, input({ jump: true, jumpHeld: true }));
    expect(player(world).jumpsUsed).toBe(2);
    // No fresh impulse was applied; vertical velocity just integrated gravity.
    expect(player(world).vel.y).toBeGreaterThan(velBefore);
  });

  it("cuts the jump short when the button is released early", () => {
    const measureApex = (held: boolean): number => {
      const world = makeWorld(ARENA);
      run(world, 5);
      const groundY = player(world).pos.y;
      run(world, 1, input({ jump: true, jumpHeld: true }));
      let apex = 0;
      for (let i = 0; i < 60; i++) {
        run(world, 1, input({ jumpHeld: held }));
        apex = Math.max(apex, groundY - player(world).pos.y);
      }
      return apex;
    };

    const fullApex = measureApex(true);
    const cutApex = measureApex(false);
    expect(cutApex).toBeLessThan(fullApex * 0.7);
  });
});
