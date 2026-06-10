import type { MapData } from "./content-types";

// Level collision is segment-based as of geometry v2 (doc 06, capsule.ts).
// What remains here: tile-grid lookup (renderer, tools) and the AABB overlap
// test used by combat (doc 02 §8 layer 2 — unchanged by v2).

/** Out-of-bounds tiles count as solid. */
export function isSolid(map: MapData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.solid[ty * map.width + tx] === true;
}

export function aabbOverlap(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}
