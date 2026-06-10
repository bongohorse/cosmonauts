import { describe, expect, it } from "vitest";
import { DUMMY_HEALTH } from "./constants";
import { input, makeWorld, player, run } from "./test-helpers";

const RANGE = ["############", "#..........#", "#S....D....#", "############"];

describe("shooting", () => {
  it("spawns one projectile and gates on cooldown", () => {
    const world = makeWorld(RANGE);
    run(world, 5);

    run(world, 1, input({ shoot: true }));
    expect(world.state.projectiles).toHaveLength(1);
    expect(player(world).attackCooldown).toBe(15);

    // Holding fire inside the cooldown window adds nothing.
    run(world, 10, input({ shoot: true }));
    expect(world.state.projectiles.length).toBeLessThanOrEqual(1);
  });

  it("projectile flies to the dummy and damages it", () => {
    const world = makeWorld(RANGE);
    run(world, 5);
    const dummy = world.state.dummies[0];
    expect(dummy).toBeDefined();

    run(world, 1, input({ shoot: true, aimX: 1, aimY: 0 }));
    run(world, 30);
    expect(dummy?.health).toBe(DUMMY_HEALTH - 10);
    expect(world.state.projectiles).toHaveLength(0);
  });

  it("kills the dummy, which respawns after the delay", () => {
    const world = makeWorld(RANGE);
    run(world, 5);
    const dummy = world.state.dummies[0];

    let deadAt = -1;
    for (let t = 0; t < 300; t++) {
      run(world, 1, input({ shoot: true, aimX: 1, aimY: 0 }));
      if (dummy !== undefined && dummy.health <= 0) {
        deadAt = t;
        break;
      }
    }
    expect(deadAt).toBeGreaterThanOrEqual(0);

    run(world, 121);
    expect(dummy?.health).toBe(DUMMY_HEALTH);
  });

  it("projectile dies on a wall well before its lifetime ends", () => {
    const world = makeWorld(["######", "#....#", "#S...#", "######"]);
    run(world, 5);
    run(world, 1, input({ shoot: true, aimX: 1, aimY: 0 }));
    expect(world.state.projectiles).toHaveLength(1);
    run(world, 20);
    expect(world.state.projectiles).toHaveLength(0);
  });
});
