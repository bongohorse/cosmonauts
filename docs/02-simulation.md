# 02 — Simulation Core Design

**Status:** v1, 2026-06-10. The contract for `packages/sim`.

## 1. Principles

1. **Pure and deterministic.** `step(state, inputs)` advances the world exactly one tick.
   Same state + same inputs = same result, on any machine, browser or server.
2. **No foreign imports.** `sim` depends on nothing: no DOM, no Pixi, no Node APIs, no other
   workspace package. Content definitions are passed *in* as plain data.
3. **Serializable state.** `GameState` is plain JSON-compatible data (no classes, no Maps,
   no functions). Cloning is `structuredClone`; snapshots are trivially encodable.
4. **Wall-clock free.** The sim never reads time. Time is the tick counter, period.

These four rules are what make client-side prediction, server authority, replays, and
headless testing all fall out for free.

## 2. Time model

- **Fixed timestep: 60 Hz** (`DT = 1/60`). Chosen over 30 Hz because the original's feel is
  twitchy; bandwidth is managed by sending snapshots at a lower rate (doc 03), not by
  slowing the sim.
- The driver (client or server) accumulates real elapsed time and calls `step` zero or more
  times per render frame; the renderer interpolates between the two latest states.
- Ticks are integers starting at 0. All durations in content data are expressed in seconds
  and converted to ticks at load time (rounded, minimum 1).

## 3. Units and coordinates

- World unit = **1 tile**. Positions and velocities are floats in tile units (units/second
  for velocity).
- +X is right, **+Y is down** (matches screen space; one fewer flip to reason about).
- Entity positions are the **center** of their AABB.

## 4. State shape

```ts
interface GameState {
  tick: number;
  rng: number;                    // PRNG state (mulberry32), part of the state
  nextEntityId: number;
  players: PlayerState[];         // the nauts
  projectiles: ProjectileState[];
  dummies: DummyState[];          // practice targets (M2); droids/turrets join later
}

interface PlayerState {
  id: number;
  characterId: string;            // key into content definitions
  pos: Vec2; vel: Vec2;
  facing: 1 | -1;
  grounded: boolean;
  jumpsUsed: number;
  attackCooldown: number;         // ticks remaining
  health: number;
  // status-effect modifier stack joins here in M4
}
```

Arrays, not maps — iteration order is part of determinism. Entities are found by linear
scan (entity counts are tiny, see analysis §5).

## 5. Determinism rules (enforced by convention + lint + tests)

| Rule | Why |
|---|---|
| No `Math.random()` — use the in-state mulberry32 PRNG | reproducibility |
| No `Date`, `performance.now`, timers | wall-clock free |
| No `Math.sin/cos/tan/atan2/exp/log` in sim code | not correctly-rounded per IEEE 754; results differ across JS engines |
| `Math.sqrt`, `+ - * /`, `Math.abs/min/max/floor` are allowed | correctly rounded / exact per spec |
| No iteration over object keys for game logic | order hazards |

Aim directions arrive *as input* (already-normalized vectors computed client-side), so the
sim itself needs no trig. If we ever need it, it gets a table-based deterministic math module.

With an authoritative server, a determinism slip degrades prediction quality (more
corrections) rather than breaking the game — but we hold the line anyway to keep lockstep
and replay options open.

## 6. Input

```ts
interface PlayerInput {
  moveX: -1 | 0 | 1;
  jump: boolean;       // pressed this tick (edge)
  jumpHeld: boolean;   // level
  shoot: boolean;      // level (auto-fire gated by cooldown)
  aimX: number; aimY: number;  // normalized, from mouse or right stick
}
```

`step(state: GameState, inputs: Record<playerId, PlayerInput>, content: ContentIndex)`.
A missing input means "repeat neutral" — disconnected/laggy players stand still rather than
stalling the sim. The input struct is the exact unit that goes over the wire (doc 03).

## 7. Movement model (per-character parameters from content)

Arcade kinematics, no physics engine:

- Horizontal: target velocity = `moveX * moveSpeed`; approach it at `groundAccel` or
  `airAccel` (units/s²). Separate accel values are the main air-control lever.
- Gravity adds `gravity` units/s² up to `maxFallSpeed`.
- Jump: sets `vel.y = -jumpVelocity`. `maxJumps` allows double jump (jump 2 available
  mid-air). Releasing jump while rising multiplies `vel.y` by `jumpCutFactor` — variable
  jump height.
- Facing follows `aimX` sign (Awesomenauts aims independently of movement).

All parameters live in character content (doc 05), tunable live in the sandbox.

## 8. Collision

> **2026-06-10:** Level collision (layer 1) is superseded by [doc 06](06-geometry-v2.md) —
> segment-based geometry with slopes/curves and capsule world-collision. Layer 2
> (entity-vs-entity AABB combat) and everything else in this doc stand unchanged.

Two layers, both AABB:

1. **vs. level geometry** (solid tile grid): per-axis move-and-resolve. Move X, clamp
   against overlapping solid tiles, zero `vel.x` on hit; then the same for Y; landing sets
   `grounded` and resets `jumpsUsed`. Per-axis resolution at 60 Hz with our speed ranges
   cannot tunnel (speeds stay well under tile-size-per-tick); a swept test is a later
   hardening step, noted not needed for MVP.
   One-way platforms (pass from below, stand on top) are an M2 stretch goal.
2. **vs. entities**: projectile↔player/dummy overlap tests for damage. Player↔player has
   **no collision** in the original-feel sense we start with (nauts pass through each
   other; the original's "sliding bug" saga is a warning about player-player collision —
   we add the soft-pushback variant only if feel demands it).

## 9. Combat (M2 scope)

- Shooting spawns a projectile at the player center traveling along the aim vector at
  `projectileSpeed`, gated by `cooldown` ticks, expiring after `lifetime` ticks or on hit.
- Damage is applied on overlap; dummies track health and respawn after a delay (sandbox
  feedback loop). Knockback, melee arcs, abilities: M4, driven by content schema growth.

## 10. API surface (initial)

```ts
createState(map: MapDef, players: SpawnSpec[]): GameState
step(state, inputs, content): void          // mutates; advances exactly one tick
cloneState(state): GameState                // structuredClone wrapper
// prediction (doc 03) = cloneState + replay step() over buffered inputs
```

`step` mutates for speed; callers own cloning at the points that need history (prediction
buffer, interpolation pair, server snapshots).

## 11. Testing strategy

The sim is the most-tested package in the repo (it's pure functions):

- Unit: collision resolution cases (land, ceiling bonk, wall slide, corner), jump state
  machine (double jump, jump cut, ground reset), projectile hit/expiry.
- **Determinism test:** run N=1000 ticks of scripted inputs twice from a cloned start
  state; assert deep-equal final states. Runs in CI forever.
- **Golden replay test (later):** recorded input streams + expected end-state hashes catch
  unintended sim changes.
