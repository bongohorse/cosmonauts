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
});
export type MapDef = z.infer<typeof MapDefSchema>;
