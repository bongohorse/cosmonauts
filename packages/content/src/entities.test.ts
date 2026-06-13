import { TICK_RATE } from "@cosmonauts/sim";
import { describe, expect, it } from "vitest";
import { type EntityDef, toEntityData } from "./entities";

describe("toEntityData", () => {
  it("maps position/size and fills param defaults", () => {
    const out = toEntityData({ id: "j1", type: "jumper", pos: [3, 4] } as EntityDef);
    expect(out.pos).toEqual({ x: 3, y: 4 });
    expect(out.size).toEqual({ w: 2, h: 1 }); // jumper defaultSize
    expect(out.enabled).toBe(true);
    expect(out.params.direction).toBe(90);
    expect(out.params.strength).toBe(22);
  });

  it("converts duration params from authored seconds to ticks", () => {
    const jumper = toEntityData({ id: "j1", type: "jumper", pos: [0, 0] } as EntityDef);
    expect(jumper.params.cooldownTicks).toBe(Math.round(0.5 * TICK_RATE));
    expect(jumper.params.cooldown).toBeUndefined();

    const tele = toEntityData({
      id: "t1",
      type: "teleporter",
      pos: [0, 0],
      params: { cooldown: 1.5 },
    } as EntityDef);
    expect(tele.params.cooldownTicks).toBe(Math.round(1.5 * TICK_RATE));
    expect(tele.params.targetId).toBe(""); // entityId default
    expect(tele.params.preserveVelocity).toBe(false);
  });

  it("honors explicit size, enabled, tint, targets and onDestroyed", () => {
    const out = toEntityData({
      id: "j2",
      type: "jumper",
      pos: [1, 1],
      size: [5, 6],
      enabled: false,
      tint: "#123456",
      targets: ["a"],
      onDestroyed: ["b"],
      params: { strength: 40 },
    } as EntityDef);
    expect(out.size).toEqual({ w: 5, h: 6 });
    expect(out.enabled).toBe(false);
    expect(out.tint).toBe("#123456");
    expect(out.params.strength).toBe(40);
    expect(out.targets).toEqual(["a"]);
    expect(out.onDestroyed).toEqual(["b"]);
  });

  it("throws on an unknown entity type", () => {
    expect(() =>
      toEntityData({ id: "x", type: "nope", pos: [0, 0] } as unknown as EntityDef),
    ).toThrowError('unknown entity type "nope"');
  });
});
