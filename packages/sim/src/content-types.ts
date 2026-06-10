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

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  solid: boolean[]; // row-major, width * height — tile layer (renderer + compile source)
  segments: SegmentData[]; // the actual collision world (doc 06)
  shapes: ShapeData[]; // render-ready shape outlines
  playerSpawns: Vec2[];
  dummySpawns: Vec2[];
}

export interface ContentIndex {
  characters: Record<string, CharacterData>;
  maps: Record<string, MapData>;
}
