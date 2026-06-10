# Cosmonauts — Design Documents

Milestone 1 of the project is this documentation set. Read in order.

| # | Document | Status |
|---|---|---|
| 01 | [Technical Analysis](01-analysis.md) — what it takes, decisions, components, risks, roadmap | ✅ Written |
| 02 | [Simulation Core Design](02-simulation.md) — tick model, state shape, AABB collision, determinism rules, API | ✅ Written |
| 03 | [Netcode Design](03-netcode.md) — protocol, prediction/reconciliation, transport interface, server runtime | ✅ Written |
| 04 | [MVP Game Design](04-game-design.md) — reference methodology, Nova's parameters, roster plan, MOBA loop scope | ✅ Written |
| 05 | [Content Schemas](05-content-schemas.md) — zod schemas for characters, maps, upgrades, status effects | ✅ Written |
| 06 | [Geometry & Collision v2](06-geometry-v2.md) — segment-based levels: rotation at any angle, curves, slopes, glass (drop-through) platforms, capsule movement | ✅ Written |
| 07 | [Map Entities & Wiring](07-map-entities.md) — placeable objects (jumpers, fields, teleporters, turrets, sandworm…) and the activator signal model | ✅ Written |
| 08 | [Creation Tools](08-creation-tools.md) — in-game map editor, hero editor, JSON + localStorage persistence | ✅ Written |
| 09 | [Bots: AI Heroes](09-bots.md) — bots as `(state) → PlayerInput`, community-programmable behavior trees, CI bot leagues | ✅ Written |

Decisions already made are recorded in [01-analysis.md §2](01-analysis.md#2-decisions-made-2026-06-10).
