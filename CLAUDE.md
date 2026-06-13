# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cosmonauts is an open-source, browser-based 2D action-platformer MOBA whose gameplay feel
recreates Awesomenauts (Ronimo Games, 2012). All IP — characters, world, art, music, maps —
is original. Geometric placeholder art is used until gameplay is proven.

**Docs are the source of truth and are kept current. Read them at the start of every session:**

- `docs/ROADMAP.md` — the single hub for architecture, the four design pillars, and
  milestones M1–M10. Start here.
- `docs/wiki/` — specific mechanics: `heroes/`, `elements/`, `maps/`, `mechanics/`
  (physics, combat, ai-bots, progression, roles, status-effects). The Roadmap says *what
  and when*; the Wiki says *how* (exact numbers, tick rates, ability behavior).
- `docs/M6-RENDERER-UPGRADES.md` — **always read before touching the PixiJS renderer.**
- `docs/KNOWLEDGE_BASE.md` — the raw *Awesomenauts* reference baseline (exact original
  numbers/names we calibrate against). Keeps original terms ("Solar", original character
  names) by design; the wiki is the canonical Cosmonauts adaptation ("Flux", "Boss Creep").

(Older numbered docs `01`–`09` no longer exist — they were consolidated into the above.)

**Status:** M1–M5 are done — deterministic sim core, Pixi.js v8 renderer, segment/slope/
glass collision with capsule movement, in-game map editor, and all core map entities
(jumpers, turrets, cores, droid spawners, creeps, barriers, etc.). The project is **now in
M6: Abilities & Hero Framework** — turning generic capsules into specific heroes with
unique abilities (starting from the Sheriff Lonestar / Froggy G archetypes). Then M7 shop
& economy → M8 AI/bots/game-modes → **M9 netcode** → M10 roster expansion.
**Netcode is deliberately deferred** until the prototype is polished — don't start it
unprompted.

## Decisions (do not relitigate without the maintainer)

- **Stack:** TypeScript (strict) + Pixi.js v8, custom engine. No Phaser/Godot/Matter/Box2D.
- **Netcode target:** authoritative server + client-side prediction. The simulation is
  built transport-agnostic from day one.
- **Physics:** velocity-based, no rigid-body physics engine. Level geometry is line
  segments (any rotation; curves flatten to polylines) with capsule world-collision;
  combat hitboxes/hurtboxes remain AABB. Tile maps still compile to segments.
- **Bots:** a bot is just `(GameState) → PlayerInput` — it cannot cheat, it emits the same
  inputs as a human. Behavior trees evaluate at 10 Hz (every 6th sim tick).
- **Layout:** pnpm monorepo — `packages/sim`, `content`, `protocol`, `client`, `server`.
  Hard rule: `sim` is pure TS and imports nothing from other packages, no DOM, no Pixi, no
  Node APIs (it runs identically in browser and server).

## Commands

All from the repo root (Node ≥ 22, pnpm 11 — auto-selected via `packageManager`):

- `pnpm dev` — client sandbox at http://localhost:5173
- `pnpm test` — all tests; single file: `pnpm exec vitest run packages/sim/src/movement.test.ts`
- `pnpm typecheck` — `tsc --noEmit` in every package
- `pnpm lint` / `pnpm lint:fix` — Biome check (lint + format)
- `pnpm build` — client production build
- `pnpm sim:bench` — headless sim benchmark (`tsx`, runs in `@cosmonauts/server`)

CI (`.github/workflows/ci.yml`) runs biome ci, typecheck, test, build, bench.

**PR gate:** `main` is protected by a ruleset — direct push is rejected; branch, open a PR
(`gh pr create`), and merge once `ci` is green (squash only). Run `pnpm lint:fix` before
committing to avoid the common Biome format-diff failure. The full pre-PR checklist +
constraints for other agents (Jules/Gemini) live in `AGENTS.md`/`GEMINI.md`;
`scripts/jules-setup.sh` is the canonical env setup that mirrors CI.

## Architecture notes

- Packages export raw TypeScript (`"exports": "./src/index.ts"`) — no build step for
  internal consumption; Vite/tsx/Vitest consume TS directly.
- `sim` is wall-clock-free and deterministic: no `Math.random` (use `rand()` from
  `math.ts` with PRNG state in `GameState.rng`), no `Date`/timers, no
  `Math.sin/cos/atan2` (not cross-engine deterministic; use `dsin`/`dcos` from `math.ts`,
  and aim arrives pre-normalized in `PlayerInput`). `Math.sqrt` and arithmetic are fine.
- `GameState` is plain JSON-safe data (`structuredClone`-able for snapshot/rollback);
  durations are integer ticks (60 Hz). Content authors write seconds/tiles; the content
  loader (`packages/content/src/index.ts`) converts before the sim sees anything.
- The client renders interpolated between the previous and current sim state; rendering
  never mutates sim state. The tuning panel mutates the loaded `CharacterData` live —
  the sim reads it fresh each tick by design.
- **Map entity registry** is the key pattern for M5+: each placeable type is one
  `EntityTypeSpec` in `packages/content/src/entities.ts` (`ENTITY_TYPES`). That single
  spec generates BOTH the zod validation schema AND the editor palette/inspector UI; the
  matching runtime behavior lives in `stepMapEntities` (`packages/sim/src/entities.ts`).
  Adding a new entity = add a spec there + handle its `case` in the sim. Characters,
  abilities/upgrades, and maps are likewise zod-validated JSON (`content/src/schemas.ts`).
- Maps are ASCII tile rows (`#` solid, `.` empty, `S` spawn, `D` dummy) plus a `shapes`
  array (rect/polygon/polyline/arc with solidity/rotation/tint), an `entities` array, and
  optional explicit spawn lists; everything compiles to collision segments in `buildMap`.
- The in-game editor (`packages/client/src/editor/`) edits a `MapDoc` and autosaves to
  localStorage under `cosmonauts.editor.mapdoc` — on boot, an autosaved doc wins over the
  shipped map. Tools: select / rect / polygon / spawn / dummy / entity / brush, plus a
  mirror mode for symmetric building and undo. `window.__cosmo`
  (`{ state, teleport, mode, editor, toggleMode }`) is the E2E hook — drive verification
  through it rather than fighting CDP input latency.
- Team color convention: Team A red, Team B blue — everywhere.

## Sibling AI-assistant configs

`AGENTS.md` (Jules) and `GEMINI.md` mirror this guidance for other assistants. When you
change a shared fact here (status, decisions, commands), keep those in sync.
