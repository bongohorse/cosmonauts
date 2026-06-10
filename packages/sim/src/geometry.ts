import { DEG_TO_RAD, dcos, dsin } from "./math";

// Level geometry v2 (doc 06): the sim collides against line segments only.
// Tiles, rects, polygons, and arcs are authoring concepts compiled to segments.

export type Solidity = "solid" | "glass" | "teamA" | "teamB";

/** Authoring shapes (stored in map JSON, doc 07 §2). Angles in degrees. */
export type ShapeDef =
  | {
      id: string;
      kind: "rect";
      solidity: Solidity;
      pos: [number, number]; // center
      size: [number, number];
      rotation?: number;
      tint?: string;
    }
  | { id: string; kind: "polygon"; solidity: Solidity; points: [number, number][]; tint?: string }
  | { id: string; kind: "polyline"; solidity: Solidity; points: [number, number][]; tint?: string }
  | {
      id: string;
      kind: "arc";
      solidity: Solidity;
      center: [number, number];
      radius: number;
      startDeg: number;
      endDeg: number;
      steps?: number;
      tint?: string;
    };

/** One collision edge. Normal is the front face (unit length). */
export interface SegmentData {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  nx: number;
  ny: number;
  solidity: Solidity;
  shapeId: string; // wiring handle + glass drop-through ignore key
}

/** Render-ready shape outline (the renderer never reads ShapeDef directly). */
export interface ShapeData {
  id: string;
  solidity: Solidity;
  tint?: string;
  points: [number, number][];
  closed: boolean;
}

function pushEdge(
  out: SegmentData[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  solidity: Solidity,
  shapeId: string,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return;
  // In y-down coordinates, (dy, -dx) is the left of travel — the front face
  // for clockwise-on-screen polygons and for polylines authored left-to-right.
  out.push({ ax, ay, bx, by, nx: dy / len, ny: -dx / len, solidity, shapeId });
}

/** Shoelace sum; positive = clockwise on screen (y-down), our front-face winding. */
function signedArea(points: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a === undefined || b === undefined) continue;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum;
}

function emitChain(
  out: SegmentData[],
  points: [number, number][],
  closed: boolean,
  solidity: Solidity,
  shapeId: string,
): void {
  const last = closed ? points.length : points.length - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a === undefined || b === undefined) continue;
    pushEdge(out, a[0], a[1], b[0], b[1], solidity, shapeId);
  }
}

export function compileShape(def: ShapeDef, out: SegmentData[], shapes: ShapeData[]): void {
  let points: [number, number][];
  let closed: boolean;

  switch (def.kind) {
    case "rect": {
      const [cx, cy] = def.pos;
      const hw = def.size[0] / 2;
      const hh = def.size[1] / 2;
      const r = (def.rotation ?? 0) * DEG_TO_RAD;
      const c = dcos(r);
      const s = dsin(r);
      const corner = (x: number, y: number): [number, number] => [
        cx + x * c - y * s,
        cy + x * s + y * c,
      ];
      // TL, TR, BR, BL — clockwise on screen.
      points = [corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)];
      closed = true;
      break;
    }
    case "polygon": {
      points = signedArea(def.points) >= 0 ? def.points : [...def.points].reverse();
      closed = true;
      break;
    }
    case "polyline": {
      points = def.points;
      closed = false;
      break;
    }
    case "arc": {
      const sweep = def.endDeg - def.startDeg;
      const steps = def.steps ?? Math.max(2, Math.ceil(Math.abs(sweep) / 15));
      points = [];
      for (let i = 0; i <= steps; i++) {
        const a = (def.startDeg + (sweep * i) / steps) * DEG_TO_RAD;
        points.push([def.center[0] + def.radius * dcos(a), def.center[1] + def.radius * dsin(a)]);
      }
      closed = false;
      break;
    }
  }

  emitChain(out, points, closed, def.solidity, def.id);
  shapes.push({ id: def.id, solidity: def.solidity, tint: def.tint, points, closed });
}

/**
 * Compile a solid-tile grid to perimeter segments (faces between solid and
 * empty cells), with collinear runs merged. Front faces point into the empty
 * side. Also emits the map border as inward-facing solid segments.
 */
export function compileTiles(
  width: number,
  height: number,
  solid: boolean[],
  out: SegmentData[],
): void {
  const at = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true; // OOB solid
    return solid[y * width + x] === true;
  };

  // Horizontal faces: scan each row boundary for runs.
  for (let y = 0; y <= height; y++) {
    let runStart = -1;
    let runDir = 0; // -1: face up (solid below), +1: face down (solid above)
    for (let x = 0; x <= width; x++) {
      const above = at(x, y - 1);
      const below = at(x, y);
      let dir = 0;
      if (below && !above) dir = -1;
      else if (above && !below) dir = 1;
      if (dir !== runDir || x === width) {
        if (runDir !== 0 && runStart >= 0) {
          // Top faces run left→right (normal up); bottom faces right→left (normal down).
          if (runDir === -1) pushEdge(out, runStart, y, x, y, "solid", "tiles");
          else pushEdge(out, x, y, runStart, y, "solid", "tiles");
        }
        runStart = x;
        runDir = dir;
      }
    }
  }

  // Vertical faces: scan each column boundary.
  for (let x = 0; x <= width; x++) {
    let runStart = -1;
    let runDir = 0; // -1: face left (solid right), +1: face right (solid left)
    for (let y = 0; y <= height; y++) {
      const left = at(x - 1, y);
      const right = at(x, y);
      let dir = 0;
      if (right && !left) dir = -1;
      else if (left && !right) dir = 1;
      if (dir !== runDir || y === height) {
        if (runDir !== 0 && runStart >= 0) {
          // Left faces run bottom→top (normal left); right faces top→bottom (normal right).
          if (runDir === -1) pushEdge(out, x, y, x, runStart, "solid", "tiles");
          else pushEdge(out, x, runStart, x, y, "solid", "tiles");
        }
        runStart = y;
        runDir = dir;
      }
    }
  }
}

/**
 * Closest points between segments P1Q1 and P2Q2 (Ericson, Real-Time Collision
 * Detection §5.1.9). Arithmetic + sqrt only. Returns squared distance and the
 * closest point on each segment.
 */
export function closestSegSeg(
  p1x: number,
  p1y: number,
  q1x: number,
  q1y: number,
  p2x: number,
  p2y: number,
  q2x: number,
  q2y: number,
): { dist2: number; c1x: number; c1y: number; c2x: number; c2y: number } {
  const d1x = q1x - p1x;
  const d1y = q1y - p1y;
  const d2x = q2x - p2x;
  const d2y = q2y - p2y;
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  const EPS = 1e-12;

  let s: number;
  let t: number;
  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= EPS) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  const c1x = p1x + d1x * s;
  const c1y = p1y + d1y * s;
  const c2x = p2x + d2x * t;
  const c2y = p2y + d2y * t;
  const dx = c1x - c2x;
  const dy = c1y - c2y;
  return { dist2: dx * dx + dy * dy, c1x, c1y, c2x, c2y };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
