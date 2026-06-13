import { TICK_RATE } from "@cosmonauts/sim";
import { describe, expect, it } from "vitest";
import { type EntityDef, toEntityData } from "./entities";

describe("toEntityData", () => {
  it("converts basic entity properties correctly", () => {
    const def: EntityDef = {
      id: "ent-1",
      type: "jumper",
      pos: [10, 20],
      size: [4, 4],
      enabled: false,
      tint: "#ff0000",
      targets: ["target-1"],
      onDestroyed: ["event-1"],
      params: { strength: 30 },
    };

    const data = toEntityData(def);
    expect(data.id).toBe("ent-1");
    expect(data.type).toBe("jumper");
    expect(data.pos).toEqual({ x: 10, y: 20 });
    expect(data.size).toEqual({ w: 4, h: 4 });
    expect(data.enabled).toBe(false);
    expect(data.tint).toBe("#ff0000");
    expect(data.targets).toEqual(["target-1"]);
    expect(data.onDestroyed).toEqual(["event-1"]);
    // jumper's strength should be 30, direction defaults to 90
    expect(data.params.strength).toBe(30);
    expect(data.params.direction).toBe(90);
  });

  it("fills default parameters and default size when not provided", () => {
    const def: EntityDef = {
      id: "ent-2",
      type: "jumper",
      pos: [0, 0],
    };

    const data = toEntityData(def);
    // default size for jumper is [2, 1]
    expect(data.size).toEqual({ w: 2, h: 1 });
    expect(data.enabled).toBe(true); // defaults to true
    expect(data.tint).toBeUndefined(); // no tint if not provided

    // Default params for jumper: direction 90, strength 22, cooldown 0.5s -> 30 ticks
    expect(data.params.direction).toBe(90);
    expect(data.params.strength).toBe(22);
    expect(data.params.cooldownTicks).toBe(Math.round(0.5 * TICK_RATE));
  });

  it("converts duration parameters to ticks", () => {
    const def: EntityDef = {
      id: "ent-3",
      type: "teleporter",
      pos: [5, 5],
      params: {
        cooldown: 1.5, // 1.5 seconds
      },
    };

    const data = toEntityData(def);
    // should have cooldownTicks and no cooldown
    expect(data.params.cooldownTicks).toBe(Math.round(1.5 * TICK_RATE));
    expect(data.params.cooldown).toBeUndefined();

    // Check entityId default is empty string
    expect(data.params.targetId).toBe("");
  });

  it("throws an error for an unknown entity type", () => {
    const def = {
      id: "ent-4",
      type: "unknown-type",
      pos: [0, 0],
    } as unknown as EntityDef;

    expect(() => toEntityData(def)).toThrowError('unknown entity type "unknown-type"');
  });
});
