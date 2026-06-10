import { SKIN } from "./constants";
import type { MapData } from "./content-types";

/** Out-of-bounds tiles count as solid so nothing leaves the world. */
export function isSolid(map: MapData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.solid[ty * map.width + tx] === true;
}

/** Does an AABB (center cx,cy / half extents hw,hh) overlap any solid tile? */
export function aabbHitsSolid(
  map: MapData,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): boolean {
  const x0 = Math.floor(cx - hw + SKIN);
  const x1 = Math.floor(cx + hw - SKIN);
  const y0 = Math.floor(cy - hh + SKIN);
  const y1 = Math.floor(cy + hh - SKIN);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(map, tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Move an AABB along one axis, clamping against solid tiles (doc 02 §8).
 * Assumes |delta| < 1 tile per call, which holds at 60 Hz for all our speeds —
 * the leading edge can enter at most the adjacent tile row/column.
 */
export function moveAxis(
  map: MapData,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  delta: number,
  axis: "x" | "y",
): { pos: number; hit: boolean } {
  const current = axis === "x" ? cx : cy;
  if (delta === 0) return { pos: current, hit: false };
  const target = current + delta;

  const nx = axis === "x" ? target : cx;
  const ny = axis === "y" ? target : cy;
  if (!aabbHitsSolid(map, nx, ny, hw, hh)) return { pos: target, hit: false };

  const half = axis === "x" ? hw : hh;
  if (delta > 0) {
    const blockedTile = Math.floor(target + half - SKIN);
    return { pos: blockedTile - half, hit: true };
  }
  const blockedTile = Math.floor(target - half + SKIN);
  return { pos: blockedTile + 1 + half, hit: true };
}

/** Ground probe: is there a solid tile a hair below the AABB's bottom edge? */
export function isOnGround(
  map: MapData,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): boolean {
  const ty = Math.floor(cy + hh + SKIN * 2);
  const x0 = Math.floor(cx - hw + SKIN);
  const x1 = Math.floor(cx + hw - SKIN);
  for (let tx = x0; tx <= x1; tx++) {
    if (isSolid(map, tx, ty)) return true;
  }
  return false;
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
