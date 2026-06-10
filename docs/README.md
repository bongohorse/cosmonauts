# Cosmonauts — Design Documents

## Current status (2026-06-10)

**Done:** M1 docs · M2 game-feel sandbox · M3 geometry v2 (segments, slopes, curves,
glass, capsule movement) · M4 in-game map editor MVP (Tab toggle, rect/polygon/spawn/
dummy tools, undo, autosave, JSON export/import). Live build:
<https://bongohorse.github.io/cosmonauts/> — auto-deploys on every push to `main`.

**Next session: M5 — map entities (doc 07), wave 1.** The agreed slicing:

1. **Wave 1:** entity framework (schemas in content, `mapEntities` state in sim, shared
   trigger-volume system, `enabled` flag) + the fun five: jumper (rotatable direction),
   killZone, fireField, healField, teleporter (+forceField). Each type's zod schema
   drives the editor palette/inspector automatically — that integration is part of wave 1.
2. **Wave 2:** wiring — activator, timer, `onDestroyed` events, door, teamBarrier.
3. **Wave 3:** flux + pickups (silver=1/gold=5, hero kills pull drops to the killer).
4. **Wave 4:** first actors — spawn entity, base (regen), turret, placeable dummy.
   Droids/creeps at the tail (they want the M5 path tool).

Deferred decisions and conventions all live in doc 01 §2 (decision log) and §8.1
(future-systems backlog). Netcode (M7) stays parked until the prototype is in good shape.

---

Milestone 1 of the project was this documentation set. Read in order.

| # | Document | Status |
|---|---|---|
| 01 | [Technical Analysis](01-analysis.md) — what it takes, decisions, components, risks, roadmap | ✅ Written |
| 02 | [Simulation Core Design](02-simulation.md) — tick model, state shape, AABB collision, determinism rules, API | ✅ Written |
| 03 | [Netcode Design](03-netcode.md) — protocol, prediction/reconciliation, transport interface, server runtime | ✅ Written |
| 04 | [MVP Game Design](04-game-design.md) — reference methodology, Nova's parameters, roster plan, MOBA loop scope | ✅ Written |
| 05 | [Content Schemas](05-content-schemas.md) — zod schemas for characters, maps, upgrades, status effects | ✅ Written |
| 06 | [Geometry & Collision v2](06-geometry-v2.md) — segment-based levels: rotation at any angle, curves, slopes, glass (drop-through) platforms, capsule movement | ✅ Written |
| 07 | [Map Entities, Wiring & Economy](07-map-entities.md) — placeable objects (jumpers, fields, barriers, turrets, droids, creeps, sandworm…), the activator/event signal model, flux currency & pickups | ✅ Written |
| 08 | [Creation Tools](08-creation-tools.md) — in-game map editor, hero editor, JSON + localStorage persistence | ✅ Written |
| 09 | [Bots: AI Heroes](09-bots.md) — bots as `(state) → PlayerInput`, community-programmable behavior trees, CI bot leagues | ✅ Written |

Decisions already made are recorded in [01-analysis.md §2](01-analysis.md#2-decisions-made-2026-06-10).
