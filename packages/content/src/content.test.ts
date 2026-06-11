import { createState, NEUTRAL_INPUT, step } from "@cosmonauts/sim";
import { describe, expect, it } from "vitest";
import { buildMapFromDef, loadContent } from "./index";
import type { MapDef } from "./schemas";

describe("content loading", () => {
  it("loads and validates all shipped content", () => {
    const content = loadContent();
    expect(Object.keys(content.characters)).toContain("nova");
    expect(Object.keys(content.maps)).toContain("testing-grounds");
  });

  it("converts authoring seconds to sim ticks", () => {
    const nova = loadContent().characters.nova;
    expect(nova?.attack.cooldownTicks).toBe(15); // 0.25 s at 60 Hz
    expect(nova?.attack.lifetimeTicks).toBe(54); // 0.9 s at 60 Hz
  });

  it("parses the testing grounds map markers", () => {
    const map = loadContent().maps["testing-grounds"];
    expect(map?.width).toBe(60);
    expect(map?.height).toBe(18);
    expect(map?.playerSpawns).toHaveLength(2);
    expect(map?.dummySpawns).toHaveLength(0);
  });

  it("compiles shapes into collision segments", () => {
    const mockDef: MapDef = {
      id: "mock-shapes",
      name: "Mock Shapes",
      tiles: ["####", "#..#", "####"],
      playerSpawns: [[1, 1, "RED"]],
      shapes: [
        { id: "ramp", kind: "polygon", solidity: "solid", points: [[1, 1], [2, 1], [2, 2]] },
        { id: "glass", kind: "polyline", solidity: "glass", points: [[1, 2], [2, 2]] },
      ],
    };
    const map = buildMapFromDef(mockDef);
    expect(map?.shapes).toHaveLength(2);
    expect(map?.shapes.map((s) => s.solidity)).toContain("glass");
    expect(map?.segments.length).toBeGreaterThan(4);
  });

  it("smoke test: 600 neutral ticks of real content settle the player on the ground", () => {
    const content = loadContent();
    const map = content.maps["testing-grounds"];
    expect(map).toBeDefined();
    if (map === undefined) return;

    const state = createState(map, [{ playerId: 1, characterId: "nova" }], content);
    for (let i = 0; i < 600; i++) {
      step(state, { 1: NEUTRAL_INPUT }, content);
    }
    expect(state.tick).toBe(600);
    expect(state.players[0]?.grounded).toBe(true);
    expect(state.players[0]?.health).toBe(100);
  });
});
