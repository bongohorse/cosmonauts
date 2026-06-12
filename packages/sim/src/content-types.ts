import type { SegmentData, ShapeData } from "./geometry";
import type { Vec2 } from "./math";

// The sim owns the data contract; the content package validates JSON into these
// shapes. Durations are in ticks here — the content loader converts from seconds.

export interface CharacterStats {
  maxHealth: number;
  moveSpeed: number; // tiles/s
  groundAccel: number; // tiles/s²
  airAccel: number;
  gravity: number;
  jumpVelocity: number;
  maxJumps: number;
  jumpCutFactor: number; // 0..1, applied to upward velocity on early jump release
  maxFallSpeed: number;
}

export interface AttackData {
  damage: number;
  cooldownTicks: number;
  projectileSpeed: number;
  projectileRadius: number;
  lifetimeTicks: number;
}

export interface CharacterData {
  id: string;
  name: string;
  color: string; // placeholder-art era: rectangle color
  hitbox: { w: number; h: number };
  stats: CharacterStats;
  attack: AttackData;
}

/**
 * A placed map entity, static side (doc 07): trigger volumes and friends.
 * Per-type params arrive validated and defaults-filled from the content
 * loader, with durations already converted to ticks. The sim reads params by
 * key and ignores entity types it has no behavior for.
 */
export interface MapEntityData {
  id: string; // unique — the wiring handle
  type: string;
  pos: Vec2; // box center
  size: { w: number; h: number }; // axis-aligned trigger box (doc 07 §2)
  enabled: boolean; // initial value; runtime flag lives in GameState.mapEntities
  tint?: string;
  params: Record<string, number | string | boolean>;
  targets?: string[];
  onDestroyed?: string[];
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  solid: boolean[]; // row-major, width * height — tile layer (renderer + compile source)
  segments: SegmentData[]; // the actual collision world (doc 06)
  shapes: ShapeData[]; // render-ready shape outlines
  entities: MapEntityData[]; // placed entities (doc 07)
  entityIdToIndex: Record<string, number>; // fast lookup map from entity ID to index in `entities` array
  playerSpawns: { x: number; y: number; team: "RED" | "BLU" }[];
  dummySpawns: Vec2[];
}

export interface ContentIndex {
  characters: Record<string, CharacterData>;
  maps: Record<string, MapData>;
}
