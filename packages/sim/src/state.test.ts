import { describe, expect, it } from "vitest";
import { cloneState } from "./state";
import { ARENA, makeWorld } from "./test-helpers";

describe("cloneState", () => {
  it("creates a deep copy of the state", () => {
    const { state } = makeWorld(ARENA);

    // Give it some non-default nested state to ensure deep cloning works properly
    state.tick = 42;
    state.players[0]!.pos.x = 100;
    state.players[0]!.vel.y = -5;
    state.players[0]!.upgrades.speed = 1;

    const cloned = cloneState(state);

    // Structure should be identical
    expect(cloned).toEqual(state);

    // But references should be different
    expect(cloned).not.toBe(state);
    expect(cloned.players[0]).not.toBe(state.players[0]);
    expect(cloned.players[0]!.pos).not.toBe(state.players[0]!.pos);
    expect(cloned.players[0]!.upgrades).not.toBe(state.players[0]!.upgrades);

    // Mutating the clone should not affect the original
    cloned.tick = 99;
    cloned.players[0]!.pos.x = 999;
    cloned.players[0]!.upgrades.speed = 5;
    cloned.projectiles.push({
      id: 1,
      team: "RED",
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 0,
      damage: 0,
      ticksLeft: 0,
    });

    expect(state.tick).toBe(42);
    expect(state.players[0]!.pos.x).toBe(100);
    expect(state.players[0]!.upgrades.speed).toBe(1);
    expect(state.projectiles.length).toBe(0);
  });
});
