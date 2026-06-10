# 06 — Geometry & Collision v2: Segments, Slopes, Curves

**Status:** v1, 2026-06-10. Decision: level geometry moves from axis-aligned tiles to
**arbitrary line segments** (platforms at any angle, curves as polylines). Supersedes
doc 02 §8 for level collision; everything else in doc 02 (tick model, determinism rules,
state shape, entity-vs-entity combat AABBs) stands unchanged.

## 1. Why

The map vision (doc 07, editor in doc 08) calls for platforms at all degrees of rotation
and curved surfaces. Faking it (rotated visuals on rectangular collision) lies to the
player in a precision platformer; fixed slope angles cap creativity. This is the cheapest
moment the project will ever have for a collision rewrite: one character, one map, zero
community content to break.

## 2. Level geometry model

- A map's collision is a list of **colliders**. Each collider is a polyline or closed
  polygon: an ordered list of vertices producing edge segments.
- Collider properties (apply to all its edges): `solidity` — `solid`, `glass`
  (pass-through platform, §4a), or `team` (solid for one team only). Breakable-on-damage
  colliders may arrive later as a fourth type; not in v2.
- **Curves are an authoring concept, not a sim concept.** The editor stores arcs/Bézier
  sections in the map file; the content loader flattens them to polylines with a fixed,
  deterministic algorithm (pure arithmetic, fixed max-error). The sim only ever sees
  straight segments.
- **Tiles remain supported** for fast block-outs: the loader compiles tile rectangles to
  perimeter segments (interior shared edges removed). The Testing Grounds map keeps
  working unmodified.
- Performance: segments are indexed into a spatial hash grid at load. Entity counts and
  map sizes make this comfortably cheap (analysis §5).

## 3. Character collision

Two shapes per character, on purpose:

- **World collision: a capsule** (vertical segment + radius, sized to the character's
  hitbox). Capsules slide smoothly over segment joints and slope crests; boxes catch on
  every vertex. This is the industry-standard answer for slope platformers.
- **Combat hitbox: the rectangle, unchanged** (doc 02). Damage, projectiles, and triggers
  keep testing AABBs — hitboxes stay readable and Awesomenauts-honest.

Movement becomes **collide-and-slide**: integrate velocity, sweep the capsule against
nearby segments, stop at the earliest contact, slide the remaining motion along the
contact tangent, repeat (max 3 iterations).

## 4. Slope rules (the feel contract)

Contacts classify by surface normal. With `up = (0,-1)`:

- **Ground** if `normal.y <= -GROUND_NORMAL_Y` where `GROUND_NORMAL_Y = 0.64` (≈ surfaces
  up to ~50° from horizontal are walkable). Constant stored as a precomputed cosine — no
  trig at runtime (doc 02 §5 holds: all math here is `+ - * / sqrt`).
- Walking on ground moves **along the surface tangent at `moveSpeed`** (constant
  along-surface speed: climbing a ramp is not slower per meter of surface). Tunable later
  if feel says otherwise.
- **Ground snapping:** while grounded and not jumping, snap to ground within
  `SNAP_DISTANCE = 0.25` tiles each tick — walking over a slope crest follows the surface
  instead of launching airborne. Jumping disables the snap for that tick.
- **Too steep** (normal between ground and wall): can't stand; slide downhill along the
  tangent under gravity.
- Walls and ceilings behave as today: velocity component into the surface cancels.
- Jump direction is always world-up (`vel.y = -jumpVelocity`), not surface-normal — keeps
  jump arcs predictable on ramps. Revisit only if playtesting demands it.
- `grounded`/`jumpsUsed`/jump-cut logic is untouched; `grounded` now also stores the
  ground normal for tangent math.

## 4a. Glass platforms (drop-through)

The user-facing name for pass-through platforms, Mario/Awesomenauts-style. Decided
2026-06-10 (corrected: glass ≠ breakable):

- **From below or the side:** no collision — heroes jump up *through* the platform and
  land on top.
- **Standing on it:** it's ground; all slope rules of §4 apply.
- **Down + jump while standing on glass: drop through.** This press does **not** consume
  a jump or trigger a double jump — it's a drop, not a jump. The player ignores that
  specific collider for `DROP_IGNORE_TICKS` (~0.25 s) or until fully clear of it.
- Landing only registers when approaching the front face from above while moving
  downward (`vel.y >= 0`) — rising heroes never catch on glass.
- **Projectiles ignore glass entirely** (both directions); only `solid` geometry blocks
  shots. Keeps platform fights readable.
- `solid` platforms have none of these behaviors — no pass-through, no drop.

Input consequence: `PlayerInput` gains `down: boolean` (S / down-arrow / stick-down) in
this milestone; the drop intent is `down && jump` while grounded on glass.

## 5. Projectiles and triggers

- Projectiles sweep as circles against segments (swept circle-segment test, arithmetic +
  sqrt only). Kills tunneling for fast shots as a bonus.
- Trigger volumes (doc 07) stay axis-aligned boxes tested against combat hitboxes —
  rotation of *triggers* is not supported in v2 (rarely needed; keeps the editor and sim
  simple). Revisit on demand.

## 6. Map format consequences

Map JSON gains a `geometry` section beside (or instead of) `tiles`; full format in
doc 07 §2. `tiles`-only maps remain valid forever — they compile to segments.

## 7. Migration & testing plan

1. Implement segment math + capsule collide-and-slide in `sim` behind the same
   `step` API; `buildMap` compiles tiles → segments. All current sim tests must pass with
   at most numeric-tolerance edits (flat ground on segments must feel identical to flat
   ground on tiles — this is the regression gate for "the jump feel you already approved").
2. New test suites: slope walk/climb/slide, crest snapping, valley joints, capsule vs
   vertex edge cases, glass platforms (jump up through, land, down+jump drop, no jump
   consumed by the drop), swept projectiles.
3. Property test: N random maps × random scripted inputs → the capsule never ends a tick
   intersecting geometry; determinism double-run stays bit-identical.
4. A new hand-written test map with ramps at several angles, a curved bowl, and glass
   platforms, used for feel-tuning in the sandbox before any editor work starts.
