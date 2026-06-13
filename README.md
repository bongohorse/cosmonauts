# Cosmonauts

An open-source, browser-based 2D action-platformer MOBA. The gameplay feel chases
[Awesomenauts](https://en.wikipedia.org/wiki/Awesomenauts) (Ronimo Games, 2012);
everything else — characters, world, art — is original.

**Status: Milestones 1–5 complete; now building heroes & abilities (Milestone 6).** Press
**Tab** in the game to flip into edit mode: draw platforms (any rotation, glass,
team-colored), place spawns, target dummies, and map entities (jumpers, teleporters,
barriers, turrets, cores, droid spawners…), then Tab back and play your map instantly.
Work autosaves to the browser and exports/imports as JSON. Next up: turning generic
capsules into distinct heroes with unique abilities. Multiplayer comes after the
creation tools and single-player feel are solid.

## Play the sandbox

```bash
pnpm install
pnpm dev        # → http://localhost:5173
```

A/D move · Space/W jump (double jump) · S drop through glass · mouse aim · click shoot ·
F1 hitboxes · R reset · **Tab opens the map editor** (draw platforms, Tab again to play
them; G snaps, Ctrl+Z undoes, your map autosaves).
The "tuning" panel edits character stats live — changes apply on the next sim tick.

## How it works

- **`packages/sim`** — deterministic 60 Hz fixed-timestep simulation. Pure TypeScript,
  zero dependencies, no DOM/Pixi/Node APIs. The same code will run in the browser (for
  client-side prediction) and on the authoritative server. Velocity-based AABB collision,
  no physics engine — like the original.
- **`packages/content`** — characters and maps as zod-validated JSON. Balance changes and
  new characters are pull requests against data files, not engine code.
- **`packages/client`** — Pixi.js v8 renderer + input. Interpolates between sim states;
  never mutates them.
- **`packages/protocol`** — wire message schemas (Milestone 9).
- **`packages/server`** — authoritative game server (Milestone 9). Currently a headless
  benchmark: `pnpm sim:bench` (~6,000× realtime per match on one core).

The design docs in [`docs/`](docs/README.md) explain every decision — start with the
[architecture & roadmap](docs/ROADMAP.md), then dig into specific mechanics in the
[wiki](docs/wiki/index.md).

## Development

```bash
pnpm test         # vitest (sim + content)
pnpm typecheck    # tsc, all packages
pnpm lint         # biome
pnpm build        # client production build
```

Node ≥ 22, pnpm 11 (auto-selected via the `packageManager` field). The one architectural rule: **`sim` imports nothing from any other
package** — that property is what makes prediction, replays, and headless testing work.

## License

[MIT](LICENSE)
