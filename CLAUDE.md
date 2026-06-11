# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cosmonauts is an open-source, browser-based 2D action-platformer MOBA whose gameplay feel
recreates Awesomenauts (Ronimo Games, 2012). All IP — characters, world, art, music, maps —
is original. Geometric placeholder art is used until gameplay is proven.

Design documents live in `docs/`. **CRITICAL:** Whenever you start a new session, you must read these files to be up to date with the project architecture! Start with `docs/01-analysis.md` for the roadmap, and always read `docs/M6-RENDERER-UPGRADES.md` before touching the PixiJS renderer. They are the source of truth for architecture and are kept up to date as decisions change. M1 (docs), M2
(sandbox, auto-deployed to GitHub Pages), and M3 (geometry v2: segment collision, slopes,
curves, glass platforms, capsule movement — doc 06) are done. M4 (in-game map editor MVP: Tab toggle,
rect/polygon/spawn/dummy tools, undo, localStorage + JSON persistence —
`packages/client/src/editor/`) is also done. Next per the roadmap (doc 01 §8): M5 map
entities (doc 07; each type auto-appears in the editor palette via its schema) → M6
abilities/heroes → M7 netcode.
**Netcode is deliberately deferred** until the prototype is in good shape — don't start
it unprompted.

## Decisions (do not relitigate without the maintainer)

- **Stack:** TypeScript (strict) + Pixi.js, custom engine. No Phaser/Godot/etc.
- **Netcode target:** authoritative server + client-side prediction. The simulation is
  built transport-agnostic from day one.
- **Physics:** velocity-based, no rigid-body physics engine. Level geometry is line
  segments (any rotation; curves flatten to polylines) with capsule world-collision per
  doc 06; combat hitboxes remain AABB. Tile maps still compile to segments.
- **Planned layout:** pnpm monorepo — `packages/sim`, `content`, `protocol`, `client`,
  `server`. Hard rule: `sim` is pure TS and imports nothing from other packages, no DOM,
  no Pixi, no Node APIs (it runs identically in browser and server).

## Commands

All from the repo root (Node ≥ 22, pnpm 11 — auto-selected via `packageManager`):

- `pnpm dev` — client sandbox at http://localhost:5173
- `pnpm test` — all tests; single file: `pnpm exec vitest run packages/sim/src/movement.test.ts`
- `pnpm typecheck` — `tsc --noEmit` in every package
- `pnpm lint` / `pnpm lint:fix` — Biome check (lint + format)
- `pnpm build` — client production build
- `pnpm sim:bench` — headless sim benchmark via tsx

CI (`.github/workflows/ci.yml`) runs biome ci, typecheck, test, build, bench.

## Architecture notes

- Packages export raw TypeScript (`"exports": "./src/index.ts"`) — no build step for
  internal consumption; Vite/tsx/Vitest consume TS directly.
- `sim` is wall-clock-free and deterministic: no `Math.random` (use `rand()` from
  `math.ts` with PRNG state in `GameState.rng`), no `Date`/timers, no
  `Math.sin/cos/atan2` (not cross-engine deterministic; aim arrives pre-normalized in
  `PlayerInput`). `Math.sqrt` and arithmetic are fine. See doc 02 §5.
- `GameState` is plain JSON-safe data; durations are integer ticks (60 Hz). Content
  authors write seconds/tiles; the content loader converts (doc 05).
- The client renders interpolated between the previous and current sim state; rendering
  never mutates sim state. The tuning panel mutates the loaded `CharacterData` live —
  the sim reads it fresh each tick by design.
- Maps are ASCII tile rows (`#` solid, `.` empty, `S` spawn, `D` dummy) plus a `shapes`
  array (rect/polygon/polyline/arc with solidity/rotation/tint, doc 06) and optional
  explicit spawn lists; everything compiles to collision segments in `buildMap`.
- The in-game editor (`packages/client/src/editor/`) edits a `MapDoc` and autosaves to
  localStorage under `cosmonauts.editor.mapdoc` — on boot, an autosaved doc wins over
  the shipped map. `window.__cosmo` (state/teleport/editor/toggleMode) is the E2E hook;
  drive verification through it rather than fighting CDP input latency.
- Team color convention: Team A red, Team B blue — everywhere.
