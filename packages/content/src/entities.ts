import { type MapEntityData, TICK_RATE } from "@cosmonauts/sim";
import { z } from "zod";

// The entity-type registry (doc 07 §1): each placeable type is described as
// data — one spec generates BOTH the zod validation schema and the editor's
// palette/inspector UI. Adding a type here is all it takes for it to appear
// in the editor; the matching behavior lives in sim/entities.ts.

export type ParamSpec =
  | { kind: "number"; label: string; default: number; min?: number; max?: number; step?: number }
  | { kind: "angle"; label: string; default: number } // degrees, y-up, 90 = straight up
  | { kind: "duration"; label: string; default: number } // authored seconds → sim ticks
  | { kind: "boolean"; label: string; default: boolean }
  | { kind: "entityId"; label: string; sameType?: boolean } // reference to another entity
  | { kind: "select"; label: string; default: string; options: string[] };

export interface EntityTypeSpec {
  type: string;
  label: string;
  color: string; // editor/render placeholder color
  defaultSize: [number, number];
  params: Record<string, ParamSpec>;
}

export const ENTITY_TYPES: EntityTypeSpec[] = [
  {
    type: "jumper",
    label: "Jumper",
    color: "#ffd166",
    defaultSize: [2, 1],
    params: {
      direction: { kind: "angle", label: "direction °", default: 90 },
      strength: { kind: "number", label: "strength", default: 22, min: 1, max: 60 },
      cooldown: { kind: "duration", label: "cooldown s", default: 0.5 },
    },
  },
  {
    type: "forceField",
    label: "Force Field",
    color: "#b18cff",
    defaultSize: [3, 3],
    params: {
      forceX: { kind: "number", label: "force x", default: 0, min: -120, max: 120 },
      forceY: { kind: "number", label: "force y", default: -50, min: -120, max: 120 },
    },
  },
  {
    type: "teleporter",
    label: "Teleporter",
    color: "#4dd0e1",
    defaultSize: [1.5, 2],
    params: {
      targetId: { kind: "entityId", label: "target", sameType: true },
      cooldown: { kind: "duration", label: "cooldown s", default: 1 },
      preserveVelocity: { kind: "boolean", label: "keep velocity", default: false },
    },
  },
  {
    type: "fireField",
    label: "Fire Field",
    color: "#ff7043",
    defaultSize: [3, 2],
    params: {
      dps: { kind: "number", label: "damage/s", default: 30, min: 1, max: 500 },
    },
  },
  {
    type: "healField",
    label: "Heal Field",
    color: "#66ff8c",
    defaultSize: [3, 2],
    params: {
      hps: { kind: "number", label: "heal/s", default: 20, min: 1, max: 500 },
    },
  },
  {
    type: "killZone",
    label: "Kill Zone",
    color: "#ff2bd6",
    defaultSize: [4, 1],
    params: {},
  },
  {
    type: "activator",
    label: "Activator",
    color: "#4caf50",
    defaultSize: [1.5, 0.5],
    params: {
      mode: {
        kind: "select",
        label: "mode",
        default: "toggle",
        options: ["toggle", "momentary", "once"],
      },
      trigger: { kind: "select", label: "trigger", default: "touch", options: ["touch", "damage"] },
      cooldown: { kind: "duration", label: "cooldown s", default: 0.5 },
    },
  },
  {
    type: "timer",
    label: "Timer",
    color: "#9e9e9e",
    defaultSize: [1, 1],
    params: {
      period: { kind: "duration", label: "period s", default: 2.0 },
      onDuration: { kind: "duration", label: "on duration s", default: 1.0 },
      startDelay: { kind: "duration", label: "start delay s", default: 0.0 },
    },
  },
  {
    type: "door",
    label: "Door",
    color: "#ffb74d",
    defaultSize: [1, 3],
    params: {
      rotation: { kind: "angle", label: "rotation °", default: 0 },
    },
  },
  {
    type: "teamBarrier",
    label: "Team Barrier",
    color: "#26a69a",
    defaultSize: [1, 3],
    params: {
      team: { kind: "select", label: "team", default: "RED", options: ["RED", "BLU"] },
      downgradeTo: {
        kind: "select",
        label: "downgrade to",
        default: "gone",
        options: ["glass", "gone"],
      },
      rotation: { kind: "angle", label: "rotation °", default: 0 },
    },
  },
];

export function entityTypeSpec(type: string): EntityTypeSpec | undefined {
  return ENTITY_TYPES.find((s) => s.type === type);
}

const PointSchema = z.tuple([z.number(), z.number()]);
const SizeSchema = z.tuple([z.number().positive(), z.number().positive()]);
const TintSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

function paramZod(spec: ParamSpec): z.ZodTypeAny {
  switch (spec.kind) {
    case "number": {
      let n = z.number();
      if (spec.min !== undefined) n = n.min(spec.min);
      if (spec.max !== undefined) n = n.max(spec.max);
      return n;
    }
    case "angle":
      return z.number();
    case "duration":
      return z.number().nonnegative();
    case "boolean":
      return z.boolean();
    case "entityId":
      return z.string();
    case "select":
      return z.enum(spec.options as [string, ...string[]]);
  }
}

function variantSchema(spec: EntityTypeSpec) {
  const paramShape: Record<string, z.ZodTypeAny> = {};
  for (const [key, p] of Object.entries(spec.params)) paramShape[key] = paramZod(p).optional();
  return z.object({
    id: z.string().min(1),
    type: z.literal(spec.type),
    pos: PointSchema,
    size: SizeSchema.optional(),
    enabled: z.boolean().optional(),
    tint: TintSchema.optional(),
    params: z.object(paramShape).strict().optional(),
    targets: z.array(z.string()).optional(),
    onDestroyed: z.array(z.string()).optional(),
  });
}

const variants = ENTITY_TYPES.map(variantSchema);
export const EntityDefSchema = z.discriminatedUnion(
  "type",
  variants as [(typeof variants)[0], ...typeof variants],
);
export type EntityDef = z.infer<typeof EntityDefSchema>;

/** Fresh defaults-filled params for a type — used by the editor on placement. */
export function defaultParams(spec: EntityTypeSpec): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  for (const [key, p] of Object.entries(spec.params)) {
    out[key] = p.kind === "entityId" ? "" : p.default;
  }
  return out;
}

/**
 * Validated def → sim data: fill param defaults and convert authored seconds
 * to integer ticks (the sim never sees seconds, doc 05 §1). Duration params
 * are renamed `<key>Ticks` so the unit is explicit on the sim side.
 */
export function toEntityData(def: EntityDef): MapEntityData {
  const spec = entityTypeSpec(def.type);
  if (spec === undefined) throw new Error(`unknown entity type "${def.type}"`);
  const params: Record<string, number | string | boolean> = {};
  const given = (def.params ?? {}) as Record<string, number | string | boolean | undefined>;
  for (const [key, p] of Object.entries(spec.params)) {
    const value = given[key] ?? (p.kind === "entityId" ? "" : p.default);
    if (p.kind === "duration" && typeof value === "number") {
      params[`${key}Ticks`] = Math.max(0, Math.round(value * TICK_RATE));
    } else {
      params[key] = value;
    }
  }
  const [w, h] = def.size ?? spec.defaultSize;
  return {
    id: def.id,
    type: def.type,
    pos: { x: def.pos[0], y: def.pos[1] },
    size: { w, h },
    enabled: def.enabled ?? true,
    ...(def.tint !== undefined ? { tint: def.tint } : {}),
    params,
    targets: def.targets,
    onDestroyed: def.onDestroyed,
  };
}
