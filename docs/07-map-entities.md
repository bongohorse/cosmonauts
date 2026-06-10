# 07 — Map Entities & Wiring

**Status:** v1, 2026-06-10. The placeable-object system: everything a map creator can drop
into a level beyond raw geometry. Extends the map format (doc 05 §3) to v2.

## 1. Design rules

- **Everything placeable is data.** Each entity type is a zod schema + a sim behavior;
  maps reference types by name with parameters. The editor (doc 08) auto-generates its
  inspector UI from the same schemas — adding an entity type automatically makes it
  editable and placeable.
- **Triggers are dumb, behaviors are shared.** Most of the wishlist is a box volume plus
  one effect; they share one trigger-volume system in the sim.
- **Wiring is first-class.** Activators toggle other entities by ID. One small signal
  model, designed once, powers doors, switchable fields, appearing platforms, traps.

## 2. Map format v2

```jsonc
{
  "id": "dunes", "name": "The Dunes", "version": 2,
  "geometry": {
    "tiles": ["..."],            // optional block-out layer (compiles to segments)
    "shapes": [                   // doc 06: polygons/polylines/arcs, any rotation
      { "id": "ramp1", "kind": "polygon", "solidity": "solid", "points": [[x,y], ...] },
      { "id": "arc1", "kind": "arc", "solidity": "glass", "center": [x,y], "radius": r,
        "from": [x,y], "to": [x,y] }
    ]
  },
  "entities": [
    { "id": "jmp1", "type": "jumper", "pos": [12, 30], "params": { "impulse": [0, -22] } },
    { "id": "act1", "type": "activator", "pos": [40, 31],
      "params": { "mode": "toggle" }, "targets": ["fire1", "door3"] }
  ],
  "spawns": { "teamA": [[x,y]], "teamB": [[x,y]], "dummies": [[x,y]] }
}
```

Every entity: `id` (unique in map, wiring handle), `type`, `pos`, optional `enabled`
(default true), `params` (per-type schema), optional `targets` (wiring). Trigger volumes
add `size` (axis-aligned, doc 06 §5).

## 3. Entity catalog (initial)

### Trigger volumes — one shared system, per-type effect
| Type | Effect | Key params |
|---|---|---|
| `jumper` | sets/adds velocity impulse on touch | impulse vector, cooldown per entity |
| `gravityField` | overrides or scales gravity while inside | vector or multiplier |
| `teleporter` | moves the toucher to a target teleporter | targetId, cooldown, preserveVelocity |
| `fireField` | damage over time while inside | dps, tick interval |
| `deathTrap` | instant kill + respawn | — |
| `healField` | heal over time (base regen zone, the shop area) | hps |

### Stateful solids — colliders with rules

Glass platforms (drop-through: jump up through, stand on top, down+jump to fall through)
and team platforms are **geometry solidity types, not entities** — see doc 06 §2 and §4a.
Only colliders with runtime state live here:

| Type | Behavior | Key params |
|---|---|---|
| `door` | collider that `enabled` toggles on/off (wired to activators) | — |
| `movingPlatform` | collider following a waypoint loop (v2.1 — riders inherit velocity; needs care) | path, speed, mode |

### Actors — entities with per-tick behavior
| Type | Behavior | Key params |
|---|---|---|
| `turret` | targets nearest enemy in range, shoots projectiles, destructible | team, range, dps, health, priority |
| `bot` | walks a waypoint path, attacks on contact/range | team, statsRef, path, behavior: patrol\|lane |
| `botSpawner` | spawns bots on an interval (MOBA waves later) | botType, interval, count |
| `core` | the destructible win objective | team, health, regen, shield rules (later) |
| `scripted` | named bespoke behaviors coded in sim, parameterized in the map | behavior key + params |

The **sandworm** is the first `scripted` behavior: anchored to a zone (the sand pit
mid-map), on a cycle it telegraphs (rumble/particles), then erupts and devours — instant
kill — anything inside the zone, then submerges. Params: zone, period, telegraphTime,
eruptDuration. Exactly the Sorona-worm role: a map-defining hazard that forces movement
decisions. The `scripted` escape hatch means future bosses/hazards need sim code but no
format changes.

### Logic
| Type | Behavior | Key params |
|---|---|---|
| `activator` | flips `enabled` on its targets when touched/attacked | mode: toggle\|momentary\|once, trigger: touch\|damage, cooldown |

Signal model (all of it): every entity has `enabled`; disabled triggers don't fire,
disabled colliders don't collide, disabled actors sleep. Activators set or flip the flag
on their targets. `momentary` reverts when the activator releases. That is the whole
wiring system — small enough to be editor-friendly, expressive enough for doors, trap
arming, field switches, and timed challenges (a `timer` pseudo-activator can come later).

## 4. Sim integration

- `GameState` gains a `mapEntities` array: per-entity dynamic state only (`enabled`,
  health, cooldown timers, worm phase) — static params stay in content. Snapshot size
  stays small; determinism rules unchanged.
- Step order: players → actors → projectiles → trigger volumes → wiring effects → dummies.
- Team filtering reuses one `team` concept shared by players, turrets, bots, platforms.

## 5. Out of scope here

Hero abilities (doc 05 §4 grows in the abilities milestone), upgrade shop contents, and
moving-platform rider physics (flagged v2.1 — the only catalog entry with real physics
subtlety).
