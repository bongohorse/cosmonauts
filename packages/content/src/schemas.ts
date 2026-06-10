import { z } from "zod";

// Authoring units are human-friendly: seconds and tiles (doc 05 §1).
// The loader converts durations to ticks before the sim ever sees them.

export const CharacterDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  archetype: z.enum(["shooter", "assassin", "support"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hitbox: z.object({ w: z.number().positive(), h: z.number().positive() }),
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
  attack: z.object({
    damage: z.number().positive(),
    cooldown: z.number().positive(), // seconds
    projectileSpeed: z.number().positive(),
    projectileRadius: z.number().positive(),
    projectileLifetime: z.number().positive(), // seconds
  }),
});
export type CharacterDef = z.infer<typeof CharacterDefSchema>;

const PointSchema = z.tuple([z.number(), z.number()]);
const SoliditySchema = z.enum(["solid", "glass", "teamA", "teamB"]);
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
  // Editor-authored spawn lists; merge with any tile markers (sim buildMap).
  playerSpawns: z.array(PointSchema).optional(),
  dummySpawns: z.array(PointSchema).optional(),
});
export type MapDef = z.infer<typeof MapDefSchema>;
