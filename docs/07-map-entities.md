# 07 — Map Entities, Wiring & Economy

**Status:** v2, 2026-06-10 (expanded after maintainer direction talk: barriers, droid
types, creeps, pickups/currency, kill zones). The placeable-object system: everything a
map creator can drop into a level beyond raw geometry.

## 1. Design rules

- **Everything placeable is data.** Each entity type is a zod schema + a sim behavior;
  maps reference types by name with parameters. The editor (doc 08) auto-generates its
  inspector UI from the same schemas.
- **Triggers are dumb, behaviors are shared.** Most placeables are a box volume plus one
  effect; they share one trigger-volume system in the sim.
- **Wiring is first-class.** Two signal sources flip the `enabled` flag on target
  entities: **activators** (touched/damaged buttons) and **entity events**
  (`onDestroyed` of a turret, glass collider, core…). One boolean, one mechanism —
  doors, switchable fields, droid releases, and barrier downgrades all use it.
- **Cosmetics are parameters.** Most entities and geometry accept an optional
  `tint`/color override so designers can theme maps without new content types.

## 2. Map format v2

```jsonc
{
  "id": "dunes", "name": "The Dunes", "version": 2,
  "meta": { "author": "...", "description": "...", "teamSize": 3, "mirrored": true },
  "geometry": {
    "tiles": ["..."],            // optional block-out layer (compiles to segments)
    "shapes": [                   // doc 06: polygons/polylines/arcs, any rotation
      { "id": "ramp1", "kind": "polygon", "solidity": "solid", "points": [[x,y], ...] },
      { "id": "plat2", "kind": "rect", "solidity": "glass", "pos": [x,y], "size": [w,h],
        "rotation": 15, "tint": "#88ddff" }
    ]
  },
  "entities": [
    { "id": "jmp1", "type": "jumper", "pos": [12, 30],
      "params": { "direction": 45, "strength": 22 } },
    { "id": "btn1", "type": "activator", "pos": [40, 31],
      "params": { "mode": "once" }, "targets": ["container1"] },
    { "id": "tur1", "type": "turret", "pos": [60, 28],
      "params": { "team": "B" }, "onDestroyed": ["barrier1"] },
    { "id": "spawnA", "type": "spawn", "pos": [4, 30], "params": { "team": "A" } }
  ]
}
```

Every entity: `id` (unique, the wiring handle), `type`, `pos`, optional `enabled`
(default true), optional `tint`, `params` (per-type schema), optional `targets`
(activator wiring) and `onDestroyed` (event wiring). Trigger volumes add `size`
(axis-aligned boxes, doc 06 §5 — but *parameters* like a jumper's launch direction
rotate freely).

## 3. Entity catalog

### Trigger volumes — one shared system, per-type effect
| Type | Effect | Key params |
|---|---|---|
| `jumper` | launch impulse on touch; **direction fully rotatable**, default 45° or straight up | direction (degrees), strength, cooldown |
| `forceField` | constant force while inside: gravity override, anti-gravity, wind, conveyor | vector or gravity multiplier |
| `teleporter` | moves the toucher to a target teleporter | targetId, cooldown, preserveVelocity |
| `fireField` | damage over time while inside | dps, tick interval |
| `killZone` | instant kill + respawn; also the bottom-of-map catcher for fall-off maps | — |
| `healField` | heal over time while inside | hps |
| `hideZone` | heroes inside are hidden from the enemy team until they act | — |

### Solids — colliders with rules

Glass platforms (jump up through, stand on top, down+jump to drop) and plain team
platforms are **geometry solidity types** (doc 06 §2, §4a). Stateful colliders live here:

| Type | Behavior | Key params |
|---|---|---|
| `teamBarrier` | own team passes through (glass-like); enemy team fully blocked. Placeable horizontally or vertically (any rotation). When disabled — typically wired to a turret's `onDestroyed` — it **downgrades**: `glass` (everyone passes) or `gone` | team, downgradeTo: glass\|gone |
| `door` | collider toggled on/off by wiring | — |
| `movingPlatform` | collider following a waypoint loop (v2.1 — riders inherit velocity; needs care) | path, speed, mode |

A classic composition: a glass platform at the base entrance *wrapped in* a `teamBarrier`
— defenders drop in and out freely, attackers are walled off until they take the outer
turret, then the barrier downgrades to glass and the base is open. Composition over
special cases: it's two placeables and one wire.

### Actors — entities with per-tick behavior
| Type | Behavior | Key params |
|---|---|---|
| `spawn` | team spawn point — **its own entity** (decided 2026-06-10), placeable anywhere, several allowed per team | team |
| `base` | regeneration zone + **shop** (buy ability upgrades: movement shoes, fire rate…). One per team; usually contains a spawn, but doesn't have to | team, hps |
| `turret` | targets enemies in range, shoots, destructible; fires `onDestroyed` wiring | team, range, dps, health, priority |
| `dummy` | static practice target with health + respawn (already in the sim; exposed to the editor for training maps) | health, respawnTime |
| `droidSpawner` | spawns droid waves per lane | droidType, interval, count, path |
| `droidContainer` | holds droids (e.g. the flying-droid barrel); wired activator button releases them | droidType, count |
| `creepDen` *(spawner for neutrals)* | spawns neutral creeps that respawn on a timer | creepType, respawnTime |
| `core` | the destructible win objective; fires `onDestroyed` (= game end) | team, health, regen |
| `scripted` | named bespoke behaviors coded in sim, parameterized in the map | behavior key + params |

**Droid types (three, per design):**
1. `small` — the standard wave unit; spawns **in pairs of 2 per lane** on an interval.
2. `super` — heavy rocket-launcher droid; **granted to the team that destroys an enemy
   turret** (joins that lane's next wave). The snowball reward for objective play.
3. `flying` — released from a `droidContainer` via its activation button; flies a path.

**Creeps are neutral droids** (no team): jungle dwellers that drop **health pickups**
when killed. The **boss creep** is the big neutral objective: killing it heals the killer
for 3000 HP and pays 20 currency to the killing team. The **sandworm** stays a `scripted`
map hazard (zone-anchored, telegraphs, devours — doc 07 v1).

### Logic
| Type | Behavior | Key params |
|---|---|---|
| `activator` | button/plate/lever: flips `enabled` on its targets when touched or damaged | mode: toggle\|momentary\|once, trigger: touch\|damage, cooldown |
| `timer` | fires its targets on a fixed cycle (periodic traps, scheduled releases) | period, onDuration, startDelay |
| `cameraBounds` | resizable rect limiting where the camera may look (distinct from where players may go); one per map | — |

## 4. Pickups & economy

The currency is **Flux** (final name, decided 2026-06-10; replaces Awesomenauts'
"solar"). Two denominations, both physical cubes in the world:

- **Silver flux cube = 1**, **golden flux cube = 5**.
- **Drop rules:** when droids, creeps, or heroes die to a **non-hero** cause (turret,
  trap, kill zone, worm), their flux drops on the ground as pickups. When the killer
  is a **hero**, the flux **flies to that hero** automatically.
- **Placeable cubes:** designers drop cubes directly in maps; optional `respawnTime`
  makes ambient flux that regenerates (jungle income routes).
- **Health pickups:** same pickup system, restores HP; dropped by creeps, also placeable.
- Mirrored placement keeps economy symmetric (doc 08 §1, mirror mode).

| Type | Effect | Key params |
|---|---|---|
| `fluxCube` | +1 (silver) or +5 (gold) on pickup | denomination, respawnTime? |
| `healthPickup` | +HP on pickup | amount, respawnTime? |

## 5. Sim integration

- `GameState` gains `mapEntities` (per-entity dynamic state: `enabled`, health, timers,
  phase) and `pickups` (live flux/health drops, homing state). Static params stay in
  content; snapshots stay small; determinism rules unchanged.
- Step order: players → actors → droids/creeps → projectiles → trigger volumes → pickups
  (incl. homing) → wiring/events → respawn timers.
- One shared `team` concept across players, turrets, droids, barriers, bases.

## 6. Out of scope here

Shop contents/upgrade trees (abilities milestone, doc 05 §4), moving-platform rider
physics (v2.1), minimap generation (editor era).

Terminology, fixed 2026-06-10: **droids** are map/lane creep units (above). **Bots** are
AI-controlled *heroes* filling player slots — doc 09. **Creeps** are neutral droids.
