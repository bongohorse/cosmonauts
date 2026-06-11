import { z } from "zod";
import { EntityDefSchema } from "./entities";

// Authoring units are human-friendly: seconds and tiles (doc 05 §1).
// The loader converts durations to ticks before the sim ever sees them.

export const UpgradeDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  flavor: z.string().optional(),
  image: z.string().optional(),
});

export const AbilityDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  image: z.string().optional(),
  stats: z.record(z.string(), z.string()).optional(),
  upgrades: z.array(UpgradeDefSchema).optional(),
});

export const CharacterDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lore: z.string().optional(),
  role: z.string().optional(),
  archetype: z.enum(["shooter", "assassin", "support"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  hitbox: z.object({ w: z.number().positive(), h: z.number().positive() }).optional(),
  stats: z.object({
    maxHealth: z.number().positive(),
    moveSpeed: z.number().positive(),
    groundAccel: z.number().positive(),
    airAccel: z.number().positive(),
    gravity: z.number().positive(),
    jumpVelocity: z.number().positive(),
    maxJumps: z.number().int().min(1),
    jumpCutFactor: z.number().min(0).max(1),
    maxFallSpeed: z.number().positive(),
  }),
  attack: z
    .object({
      damage: z.number().positive(),
      cooldown: z.number().positive(), // seconds
      projectileSpeed: z.number().positive(),
      projectileRadius: z.number().positive(),
      projectileLifetime: z.number().positive(), // seconds
    })
    .optional(),
  abilities: z.array(AbilityDefSchema).optional(),
});
export type CharacterDef = z.infer<typeof CharacterDefSchema>;

const PointSchema = z.tuple([z.number(), z.number()]);
const PlayerSpawnSchema = z.tuple([z.number(), z.number(), z.enum(["RED", "BLU"])]);
const SoliditySchema = z.enum(["solid", "glass", "teamRED", "teamBLU", "none"]);
const shapeBase = {
  id: z.string().min(1),
  solidity: SoliditySchema,
  tint: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
};

// Geometry v2 (doc 06): shapes compile to collision segments in the sim.
export const ShapeDefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rect"),
    ...shapeBase,
    pos: PointSchema, // center
    size: z.tuple([z.number().positive(), z.number().positive()]),
    rotation: z.number().optional(), // degrees
  }),
  z.object({ kind: z.literal("polygon"), ...shapeBase, points: z.array(PointSchema).min(3) }),
  z.object({ kind: z.literal("polyline"), ...shapeBase, points: z.array(PointSchema).min(2) }),
  z.object({
    kind: z.literal("arc"),
    ...shapeBase,
    center: PointSchema,
    radius: z.number().positive(),
    startDeg: z.number(),
    endDeg: z.number(),
    steps: z.number().int().min(2).optional(),
  }),
]);

export const MapDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  // Legend: '#' solid, '.' empty, 'S' player spawn, 'D' dummy spawn.
  tiles: z
    .array(z.string().regex(/^[#.SD]+$/))
    .min(2)
    .refine((rows) => rows.every((row) => row.length === rows[0]?.length), {
      message: "all tile rows must have the same length",
    }),
  shapes: z.array(ShapeDefSchema).optional(),
  // Placed entities (doc 07 §2). Ids must be unique — they are wiring handles.
  entities: z
    .array(EntityDefSchema)
    .optional()
    .refine((es) => es === undefined || new Set(es.map((e) => e.id)).size === es.length, {
      message: "entity ids must be unique",
    }),
  // Editor-authored spawn lists; merge with any tile markers (sim buildMap).
  playerSpawns: z.array(PlayerSpawnSchema).optional(),
  dummySpawns: z.array(PointSchema).optional(),
});
export type MapDef = z.infer<typeof MapDefSchema>;
