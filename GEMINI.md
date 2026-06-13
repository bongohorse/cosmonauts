# GEMINI.md

This file provides guidance and strict instructions to Gemini and other AI coding assistants when working with code in this repository.

## Project Overview

Cosmonauts is an open-source, browser-based 2D action-platformer MOBA. Our goal is to build a high-performance modern browser game using cutting-edge web tools. The architecture relies on a deterministic, fixed-timestep simulation core separated from its renderer.

- **Status:** Milestones 1 through 5 are complete (deterministic sim, Pixi.js v8 renderer, segment/capsule collision, in-game map editor, and all core map entities). **Milestone 6 (Abilities & Hero Framework)** is currently in progress. The roadmap then proceeds to M7 (Shop & Economy), M8 (AI/Bots/Game-Modes), M9 (Netcode), and M10 (Roster Expansion).
- **Hard Rule:** Netcode is deliberately deferred until the local prototype is highly polished. Do not attempt to implement networking or sockets unprompted.

## Tech Stack & Modern Tooling

We embrace modern web development practices, moving away from heavy traditional game engines (like Phaser or Godot) in favor of a lean, custom tech stack:
- **Language:** TypeScript (Strict mode enabled)
- **Renderer:** Pixi.js v8 (Leveraging modern WebGL/WebGPU for performant 2D rendering)
- **Build Tool:** Vite (For instant HMR and fast bundling)
- **Testing:** Vitest (Fast, native TypeScript testing framework)
- **Linting/Formatting:** Biome (Rust-based, incredibly fast toolchain)
- **Package Manager:** pnpm v11 (For robust monorepo support)

## Architecture & Core Packages

The codebase is structured as a monorepo containing distinct packages:

- **`packages/sim`**: The 60Hz simulation. **Crucial:** Must be pure TypeScript. No DOM, Pixi, or Node APIs. It runs identically in browser and server environments.
- **`packages/client`**: Pixi.js renderer and user input handling. Interpolates between previous and current simulation states; it *never* mutates them. 
- **`packages/content`**: Zod-validated JSON data for characters, maps, and entities.
- **`packages/protocol`**: Wire message schemas (for future multiplayer integration).
- **`packages/server`**: Headless authoritative game server.

**Note:** Packages export raw TypeScript (`"exports": "./src/index.ts"`). There are no intermediate build steps; Vite, tsx, and Vitest consume the raw TS directly for maximum development speed.

## Fundamental Design Decisions (Do Not Relitigate)

1. **Physics:** Velocity-based, with no rigid-body physics engine (e.g., Matter.js or Box2D). Level geometry uses line segments with capsule-based world collision (see `docs/wiki/mechanics/physics.md`). Combat hitboxes use standard AABB.
2. **Determinism:** `packages/sim` must remain cross-engine deterministic.
   - **No `Math.random()`**: Use `rand()` from `math.ts` with PRNG state in `GameState.rng`.
   - **No `Date` or timers**: Rely exclusively on integer ticks (60Hz) to drive duration.
   - **No Non-Deterministic Math**: Avoid `Math.sin/cos/atan2`. Use pre-normalized inputs or `dsin/dcos` from `math.ts`. `Math.sqrt` and basic arithmetic are allowed.
3. **State:** `GameState` is a plain JSON-safe object. Durations and timers are stored as integer ticks.
4. **Editor:** The in-game editor (`packages/client/src/editor/`) relies on `localStorage` for map persistence. E2E tests and automated interactions should use the `window.__cosmo` hook rather than relying on CDP input latency.
5. **Team Conventions:** Team RED is Team A, Team BLU is Team B everywhere in the application.

## Development Commands

All commands are run from the repo root:
- `pnpm dev`: Start the client sandbox at `http://localhost:5173`.
- `pnpm test`: Run all tests via Vitest. To run a single test: `pnpm exec vitest run packages/sim/src/movement.test.ts`.
- `pnpm typecheck`: Run `tsc --noEmit` across all packages.
- `pnpm lint`: Run Biome checks.
- `pnpm build`: Create the production client build.
- `pnpm sim:bench`: Run the headless simulation benchmark.

## AI Engineering Standards

- **Surgical Edits**: Prefer minimal, precise changes to existing logic. Do not rewrite files unless absolutely necessary.
- **Testing**: Whenever modifying `packages/sim`, add or update corresponding tests in `packages/sim/src/*.test.ts`.
- **Editor Integration**: New map entities (defined in `packages/content/src/entities.ts`) must be equipped with Zod schemas so they automatically appear in the editor palette.
- **Consult Docs**: Design documents live in `docs/`. **CRITICAL:** Whenever you start a new session, you must read these files to be up to date with the project architecture! Start with `docs/ROADMAP.md` (architecture + milestones), consult `docs/wiki/` for specific mechanics (e.g. `docs/wiki/mechanics/physics.md` for collision), and always read `docs/M6-RENDERER-UPGRADES.md` before doing any work on the PixiJS renderer or Milestone 6 UI/graphics. (The older numbered docs `01`–`09` were consolidated into these.)

## Before You Open a Pull Request

Every check below must pass locally first — CI (`.github/workflows/ci.yml`) runs the same, and a PR that fails will not be merged. The canonical setup + validation script is [`scripts/jules-setup.sh`](scripts/jules-setup.sh).

1. `pnpm lint` — Biome **lint and formatting**. Run `pnpm lint:fix` first to auto-format; CI fails on any formatting diff (the most common avoidable failure).
2. `pnpm typecheck` — `tsc --noEmit` across all packages.
3. `pnpm test` — the full Vitest suite.
4. `pnpm build` — the production client build.

## Hard Constraints (do not violate)

- **pnpm only.** This repo pins pnpm via `package.json` `packageManager`. Never run `npm`/`yarn`/`bun`, and never commit `bun.lock`, `package-lock.json`, or `yarn.lock` — `pnpm-lock.yaml` is the only tracked lockfile. (Bun ships pre-installed in some agent images; do not use it here.)
- **One concern per PR.** Do not bundle unrelated changes — e.g. import cleanups or reformatting untouched code — into a feature or test PR. Spotted an unrelated cleanup? Open a separate small PR.
- **Never open multiple PRs that create the same file.** They collide and only one can merge. Group related work (e.g. all tests for one module) into a single PR.
- **No premature optimization.** The sim runs ~6000× realtime (`pnpm sim:bench`); do not optimize lookups or loops without a profiling-backed reason.
- **Keep refactors surgical.** Do not rewrite or restructure a working file for style alone — only when a change actually requires it.
- **Test PRs add tests only.** A test must not change runtime/source behavior. If behavior should change, that is a separate PR with its own justification and integration coverage.
- **Label accurately.** Do not file "XSS"/"security" PRs for non-issues (e.g. assigning a constant empty string to `innerHTML`, or `Math.random` for non-security editor IDs).
