import { DT, GLASS_EPS, GROUND_NORMAL_Y, GROUND_SNAP, SKIN } from "./constants";
import type { CharacterData, MapData } from "./content-types";
import { closestSegSeg, type SegmentData } from "./geometry";
import type { PlayerState } from "./state";

// Capsule collide-and-slide vs level segments (doc 06 §3-§4a).
// The capsule is derived from the character hitbox: radius = w/2, with a
// vertical core segment so total height = h. Bottom/top/side extents match the
// old AABB exactly, so flat-ground feel and flush positions are preserved.

interface Contact {
  nx: number;
  ny: number;
  seg: SegmentData;
}

function segmentCollidable(
  seg: SegmentData,
  p: PlayerState,
  prevBottom: number,
  velY: number,
): boolean {
  switch (seg.solidity) {
    case "solid":
      return true;
    case "teamA":
      return p.team === "A";
    case "teamB":
      return p.team === "B";
    case "glass": {
      if (p.dropTicks > 0 && p.dropShapeId === seg.shapeId) return false;
      if (velY < 0) return false; // rising — pass through from below
      if (seg.ny > -0.1) return false; // only up-facing fronts are landable
      const faceTop = Math.min(seg.ay, seg.by);
      return prevBottom <= faceTop + GLASS_EPS; // approached from above
    }
  }
}

/**
 * Push the capsule out of any penetrated segments (deepest-first, up to 4
 * iterations) and cancel velocity into each contact surface.
 */
function depenetrate(
  map: MapData,
  p: PlayerState,
  a: number,
  r: number,
  prevBottom: number,
  contacts: Contact[],
): void {
  const r2 = r * r;
  for (let iter = 0; iter < 4; iter++) {
    let best: Contact | null = null;
    let bestDepth = SKIN * 0.5;
    for (const seg of map.segments) {
      if (!segmentCollidable(seg, p, prevBottom, p.vel.y)) continue;
      const cs = closestSegSeg(
        p.pos.x,
        p.pos.y - a,
        p.pos.x,
        p.pos.y + a,
        seg.ax,
        seg.ay,
        seg.bx,
        seg.by,
      );
      if (cs.dist2 >= r2) continue;
      const dist = Math.sqrt(cs.dist2);
      const depth = r - dist;
      if (depth <= bestDepth) continue;
      let nx: number;
      let ny: number;
      if (dist > 1e-9) {
        nx = (cs.c1x - cs.c2x) / dist;
        ny = (cs.c1y - cs.c2y) / dist;
      } else {
        nx = seg.nx;
        ny = seg.ny;
      }
      bestDepth = depth;
      best = { nx, ny, seg };
    }
    if (best === null) break;

    p.pos.x += best.nx * (bestDepth + SKIN);
    p.pos.y += best.ny * (bestDepth + SKIN);
    const vn = p.vel.x * best.nx + p.vel.y * best.ny;
    if (vn < 0) {
      p.vel.x -= vn * best.nx;
      p.vel.y -= vn * best.ny;
    }
    contacts.push(best);
  }
}

function classifyGround(contacts: Contact[]): Contact | null {
  let ground: Contact | null = null;
  for (const c of contacts) {
    if (c.ny <= -GROUND_NORMAL_Y && (ground === null || c.ny < ground.ny)) ground = c;
  }
  return ground;
}

/** Deepest walkable-normal contact at the current position (no resolution). */
function deepestGroundContact(
  map: MapData,
  p: PlayerState,
  a: number,
  r: number,
  prevBottom: number,
): (Contact & { depth: number }) | null {
  const r2 = r * r;
  let best: (Contact & { depth: number }) | null = null;
  for (const seg of map.segments) {
    if (!segmentCollidable(seg, p, prevBottom, p.vel.y)) continue;
    const cs = closestSegSeg(
      p.pos.x,
      p.pos.y - a,
      p.pos.x,
      p.pos.y + a,
      seg.ax,
      seg.ay,
      seg.bx,
      seg.by,
    );
    if (cs.dist2 >= r2) continue;
    const dist = Math.sqrt(cs.dist2);
    let nx: number;
    let ny: number;
    if (dist > 1e-9) {
      nx = (cs.c1x - cs.c2x) / dist;
      ny = (cs.c1y - cs.c2y) / dist;
    } else {
      nx = seg.nx;
      ny = seg.ny;
    }
    if (ny > -GROUND_NORMAL_Y) continue;
    const depth = r - dist;
    if (best === null || depth > best.depth) best = { nx, ny, seg, depth };
  }
  return best;
}

/**
 * Integrate one tick of player motion against the segment world: move,
 * depenetrate, classify ground, and snap to ground over crests/slope joints.
 * Mutates pos/vel and the grounded fields of `p`.
 */
export function movePlayer(
  map: MapData,
  p: PlayerState,
  char: CharacterData,
  jumpedThisTick: boolean,
): void {
  const r = char.hitbox.w / 2;
  const a = Math.max(0, char.hitbox.h / 2 - r);
  const prevBottom = p.pos.y + a + r;
  const wasGrounded = p.grounded;

  p.pos.x += p.vel.x * DT;
  p.pos.y += p.vel.y * DT;

  const contacts: Contact[] = [];
  depenetrate(map, p, a, r, prevBottom, contacts);
  let ground = classifyGround(contacts);

  // Ground snap: walking over a crest or down a slope joint shouldn't go
  // airborne — probe down and keep the result only if it finds ground.
  // The resolution is strictly vertical: pushing out along a slope normal
  // would creep the capsule sideways every tick while standing still.
  if (ground === null && wasGrounded && !jumpedThisTick) {
    const saveY = p.pos.y;
    p.pos.y += GROUND_SNAP;
    const snap = deepestGroundContact(map, p, a, r, prevBottom);
    if (snap !== null) {
      p.pos.y -= (snap.depth + SKIN) / -snap.ny; // vertical lift to rest on the face
      ground = snap;
    } else {
      p.pos.y = saveY;
    }
  }

  if (ground !== null) {
    p.grounded = true;
    p.groundNX = ground.nx;
    p.groundNY = ground.ny;
    p.groundShapeId = ground.seg.shapeId;
    p.groundGlass = ground.seg.solidity === "glass";
    p.jumpsUsed = 0;
  } else {
    p.grounded = false;
    p.groundNX = 0;
    p.groundNY = 0;
    p.groundShapeId = "";
    p.groundGlass = false;
  }
}
