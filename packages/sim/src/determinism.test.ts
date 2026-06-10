import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT, type PlayerInput } from "./input";
import { cloneState } from "./state";
import { step } from "./step";
import { makeWorld } from "./test-helpers";

// Scripted pseudo-input derived purely from the tick index — no randomness.
function scriptedInput(t: number): PlayerInput {
  return {
    ...NEUTRAL_INPUT,
    moveX: (((t >> 4) % 3) - 1) as -1 | 0 | 1,
    jump: t % 37 === 0,
    jumpHeld: t % 37 < 20,
    shoot: t % 5 === 0,
    aimX: (t % 7) - 3,
    aimY: (t % 11) - 5,
  };
}

const WORLD = [
  "################",
  "#..............#",
  "#......D.......#",
  "#..............#",
  "#...####.......#",
  "#..............#",
  "#S.........D...#",
  "################",
];

describe("determinism", () => {
  it("identical inputs from identical states produce identical results (1000 ticks)", () => {
    const world = makeWorld(WORLD);
    const stateA = world.state;
    const stateB = cloneState(stateA);

    for (let t = 0; t < 1000; t++) {
      const inputs = { 1: scriptedInput(t) };
      step(stateA, inputs, world.content);
      step(stateB, inputs, world.content);
    }

    expect(stateA).toEqual(stateB);
    expect(stateA.tick).toBe(1000);
  });

  it("game state survives a JSON round-trip unchanged", () => {
    const world = makeWorld(WORLD);
    for (let t = 0; t < 200; t++) {
      step(world.state, { 1: scriptedInput(t) }, world.content);
    }
    expect(JSON.parse(JSON.stringify(world.state))).toEqual(world.state);
  });

  it("a resumed clone diverges from nothing: clone mid-run, both halves stay equal", () => {
    const world = makeWorld(WORLD);
    for (let t = 0; t < 500; t++) {
      step(world.state, { 1: scriptedInput(t) }, world.content);
    }

    const resumed = cloneState(world.state);
    for (let t = 500; t < 800; t++) {
      const inputs = { 1: scriptedInput(t) };
      step(world.state, inputs, world.content);
      step(resumed, inputs, world.content);
    }
    expect(resumed).toEqual(world.state);
  });
});
