# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cosmonauts is an open-source, browser-based 2D action-platformer MOBA whose gameplay feel
recreates Awesomenauts (Ronimo Games, 2012). All IP — characters, world, art, music, maps —
is original. Geometric placeholder art is used until gameplay is proven.

Design documents live in `docs/` (start with `docs/01-analysis.md`); they are the source
of truth for architecture and are kept up to date as decisions change. Milestone 1 (docs)
and Milestone 2 (local game-feel sandbox) are done; Milestone 3 is netcode (doc 03).

## Decisions (do not relitigate without the maintainer)

- **Stack:** TypeScript (strict) + Pixi.js, custom engine. No Phaser/Godot/etc.
- **Netcode target:** authoritative server + client-side prediction. The simulation is
  built transport-agnostic from day one.
- **Physics:** velocity-based AABB only, like the original. No rigid-body physics engine.
- **Planned layout:** pnpm monorepo — `packages/sim`, `content`, `protocol`, `client`,
  `server`. Hard rule: `sim` is pure TS and imports nothing from other packages, no DOM,
  no Pixi, no Node APIs (it runs identically in browser and server).

## Commands

All from the repo root (Node ≥ 22, pnpm 10):

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
- Maps are ASCII tile rows in JSON (`#` solid, `.` empty, `S` player spawn, `D` dummy).
