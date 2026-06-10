# Cosmonauts — Project Guidelines

An open-source, browser-based 2D action-platformer MOBA inspired by Awesomenauts.

## Project Overview

Cosmonauts is built with a deterministic, fixed-timestep simulation core separated from its renderer. This architecture enables client-side prediction, replays, and authoritative server validation.

- **Status:** Milestone 4 complete (In-game map editor MVP). Milestone 5 (Map Entities) is in progress.
- **Tech Stack:** TypeScript (strict), Pixi.js v8, Vite, Vitest, Biome, pnpm.
- **Architecture:** Monorepo with distinct packages for simulation, content, client, and server.

## Core Packages

- **`packages/sim`**: The deterministic 60Hz simulation. **Hard Rule:** This package must be pure TypeScript and import nothing from other packages. No DOM, Pixi, or Node APIs.
- **`packages/client`**: Pixi.js renderer and user input handling. Interpolates between simulation states; never mutates them. Includes the in-game map editor.
- **`packages/content`**: Zod-validated JSON data for characters, maps, and entities.
- **`packages/protocol`**: Wire message schemas for multiplayer (Milestone 3+).
- **`packages/server`**: Headless authoritative game server (Benchmark status).

## Development Workflow

### Key Commands

- `pnpm dev`: Start the client sandbox at `http://localhost:5173`.
- `pnpm test`: Run all tests (Vitest).
- `pnpm typecheck`: Run `tsc --noEmit` across all packages.
- `pnpm lint`: Run Biome for linting and formatting.
- `pnpm build`: Create a production build of the client.
- `pnpm sim:bench`: Run the headless simulation benchmark.

### Determinism Rules (in `packages/sim`)

- **No `Math.random()`**: Use `rand()` from `math.ts` with the PRNG state in `GameState.rng`.
- **No `Date` or timers**: The simulation is driven by integer ticks (60 Hz).
- **No Non-Deterministic Math**: Avoid `Math.sin/cos/atan2` (not cross-engine deterministic). Use `dsin/dcos` from `math.ts` or pre-normalized inputs. `Math.sqrt` and basic arithmetic are permitted.
- **JSON-Safe State**: `GameState` must remain a plain JSON-safe object for easy serialization and snapshots.

### Engineering Standards

- **Surgical Edits**: Prefer minimal, precise changes to existing logic.
- **Testing**: Add or update tests in `packages/sim/src/*.test.ts` for any simulation changes.
- **Editor Integration**: New map entities (defined in `packages/content/src/entities.ts`) should automatically appear in the editor palette via their Zod schemas.
- **Sim Isolation**: Ensure `packages/sim` remains dependency-free. Check imports during any refactor.

## Documentation

Comprehensive design documents are located in `docs/`.
- `docs/01-analysis.md`: Technical analysis, decision log, and roadmap.
- `docs/02-simulation.md`: Detailed simulation and collision logic.
- `docs/06-geometry-v2.md`: Segment-based collision and capsule movement.
- `docs/07-map-entities.md`: Design for map objects and the event wiring system.
