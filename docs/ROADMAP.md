# Cosmonauts Architecture & Roadmap

This document serves as the single source of truth for the overarching architecture, design philosophy, and development milestones of **Cosmonauts**. For highly specific game mechanics (stats, map layouts, heroes), consult the [Cosmonauts Wiki](./wiki/index.md).

---

## Part 1: Project Vision & Core Principles

**Goal:** Cosmonauts is an open-source, browser-based 2D action-platformer MOBA. Its primary success criterion is faithfully recreating the "gameplay feel" of *Awesomenauts* (arcade platformer movement, zero-input-lag, team-based progression). Everything else—characters, art, maps, music—is original IP.

### The Four Pillars
1. **Pure & Deterministic Simulation:** `step(state, inputs)` advances the world exactly one tick. Same state + same inputs = same result.
2. **Data-Driven Content:** Characters, abilities, maps, and bots are defined in JSON (validated by Zod), not code. This allows for an open-source "live editor" workflow.
3. **Wall-Clock Free:** The simulation never reads real time. Time is strictly the 60Hz tick counter.
4. **Transport-Agnostic Netcode:** The simulation is built from day one to support rollback and client-side prediction, keeping it separate from rendering or networking logic.

---

## Part 2: Technical Architecture

### 1. Simulation Core (`packages/sim`)
- Runs on a **fixed-timestep 60Hz** loop.
- Exists as a completely independent package. No DOM, no Pixi, no Node APIs.
- State is strictly JSON-serializable (`structuredClone` compatible) to allow for instant snapshotting and rollback.
- Math operations strictly avoid `Math.sin/cos/random` and `Date` to maintain cross-engine determinism.

### 2. Rendering (`packages/client`)
- Driven by **Pixi.js v8**.
- The renderer *never* mutates simulation state. It interpolates between the two latest state snapshots, completely decoupling the visual frame rate from the 60Hz sim tick rate.

### 3. Netcode & Multiplayer (`packages/server` & `packages/protocol`)
- **Authoritative Server + Client Prediction:** The server runs the definitive simulation. Clients run the exact same code locally to predict movement (eliminating input lag).
- When a client receives a server snapshot, it rewinds its local state to match the server, then instantly replays any unacknowledged inputs.

### 4. Geometry & Collision
- **World Collision:** Built on segment-based geometry (rotated platforms, slopes, polylines) evaluated against player Capsules.
- **Combat Collision:** Hitboxes and hurtboxes rely on fast, reliable AABB (Axis-Aligned Bounding Box) overlaps.
- **One-Way Platforms:** Glass platforms allow players to jump up through them, or drop down by pressing `Jump + Down`.

### 5. Content & Editors (`packages/content`)
- **In-Game Map Editor:** Toggled instantly with the `Tab` key. Features manipulation handles, mirror-mode (symmetry building), snapping, and JSON export/import directly to `localStorage`.
- **Map Entities:** Data-driven objects (Jumpers, Turrets, Team Barriers, Hide Zones) auto-populate the editor palette via their Zod schemas.

### 6. AI & Bots
- A bot is fundamentally a function: `(GameState) → PlayerInput`. Bots cannot cheat; they emit the exact same inputs as a human keyboard.
- To save performance, the AI engine evaluates Behavior Trees at exactly **10Hz** (every 6th simulation frame).
- Behavior Trees will eventually be JSON-driven, allowing the community to submit custom AI logic via Pull Requests.

---

## Part 3: Development Milestones

*(Links point to the [Wiki](./wiki/index.md) where exact mechanics and features are actualized).*

### ✅ Milestone 1-5: The Foundation (COMPLETED)
**Goal:** Establish the deterministic engine, basic rendering, map editor, and core map entities.

- [x] **Deterministic Simulation Core:** Fixed-timestep 60Hz velocity-based physics. ([Physics Wiki](./wiki/mechanics/physics.md))
- [x] **Renderer (`client/`)**: Pixi.js v8 rendering with state interpolation.
- [x] **Map Editor**: In-game editor supporting geometry and saving to `localStorage`.
- [x] **Structures & Entities**: Base Cores, Turrets, Team Barriers, Jump Pads, Hide Zones. ([Elements Wiki](./wiki/elements/index.md))
- [x] **Minions & Creeps**: Lane Droids and Neutral Jungle Creeps.
- [x] **Economy Basics**: Flux cubes dropping on death, map Healthpacks.

### 🟡 Milestone 6: Abilities & Hero Framework (CURRENT)
**Goal:** Transition from generic collision capsules into specific, unique Cosmonauts with customized abilities and roles.

- [x] **Hero Registry:** Create a robust system in `packages/content/` to define Hero stats. (Populated!)
- [ ] **Ability System Core:** Implement a generic action/ability pipeline (Cooldowns, Charges, Cast delays). ([Combat Wiki](./wiki/mechanics/combat.md))
- [ ] **Status Effects Engine:** Support Buffs and Debuffs (Snare, Slow, Stun, Silence, Shield, Lifesteal). ([Status Effects Wiki](./wiki/mechanics/status-effects.md))
- [ ] **First Playable Heroes:** Sheriff Lonestar & Froggy G archetypes.
- [ ] **Combat Polish:** Floating damage numbers, hitstop/screenshake hooks.

### 🔵 Milestone 7: The Zork Mega Shop & Economy
**Goal:** Allow players to spend their gathered Flux on upgrades, and implement the global scaling system.

- [ ] **Team Experience System:** Global team leveling, XP Curve, and Rubberbanding multiplier logic (+/- 4% XP). ([Progression Wiki](./wiki/mechanics/progression.md))
- [ ] **Flux Economy Engine:** Passive generation, death penalties, and exact bounty distribution.
- [ ] **Zork's Mega Shop UI:** In-game interface, Upgrade UI, Undo feature. ([Shop Wiki](./wiki/elements/shop.md))
- [ ] **State Application:** Apply purchased upgrades to the simulation state dynamically.

### 🟠 Milestone 8: AI, Bots & Game Modes
**Goal:** Introduce offline play, custom settings, and highly capable bot opponents.

- [ ] **Bot AI Engine:** 10Hz behavior tree execution. ([AI Wiki](./wiki/mechanics/ai-bots.md))
- [ ] **Pathing Graph System:** Editor tools to place `AINode`, `PathEdge`, and `NamedArea` for bot navigation.
- [ ] **Custom Matches:** Build the `MatchConfig` interface for editing game rules (disabling turrets, tweaking physics). ([Game Modes Wiki](./wiki/mechanics/game-modes.md))

### 🟣 Milestone 9: Netcode & Multiplayer Prototype
**Goal:** Move from local prototype to a true multiplayer environment.

- [ ] **Headless Server (`server/`):** Run the simulation loop authoritatively.
- [ ] **Wire Protocol (`protocol/`):** Define Zod schemas for client inputs and server state snapshots.
- [ ] **Rollback / Client Prediction:** Implement GGPO-style input rollback on the client.
- [ ] **Lobby System:** Basic matchmaking/room joining.

### 🟢 Milestone 10: Roster & Content Expansion
**Goal:** Flesh out the game with more heroes, maps, and dynamic hazards.

- [ ] **Expand Roster:** Implement the remaining 32 iconic archetypes. ([Heroes Wiki](./wiki/heroes/index.md))
- [ ] **Map Hazards:** Sandworm Pit, Anti-Gravity zones, Solar Boss epic creeps.
- [ ] **New Maps:** Design and publish all 6 official maps using the in-game editor. ([Maps Wiki](./wiki/maps/index.md))
- [ ] **Sound & Music:** Integrate character voice lines, attack SFX, and dynamic background music.

---

### Known Issues & Polish Needed (Backlog)
- *Physics:* Ensure high-speed projectiles do not tunnel through thin walls (continuous collision detection).
- *UI:* Create polished SVG/UI layer overlays to replace primitive Pixi.js rectangles.
- *Performance:* Optimize `aabbOverlap` checks with Spatial Hashing / QuadTrees.
- *Holiday Themes:* Load cosmetic prop layers conditionally based on system dates. ([Themes Wiki](./wiki/maps/holiday-themes.md))
- *Particle Engine:* Build a custom Pixi.js emitter wrapper matching the Awesomenauts particle schema.

---

## Part 4 — Future Features & Live-Service Backlog (post-M10)

A parking lot for ideas beyond the current M1–M10 plan — not yet scheduled or designed, but
recorded so nothing is lost. Grouping is thematic, not priority. Many build on milestones
already planned (noted inline). **New future-feature ideas go here.**

### Online Play & Matchmaking (extends M9 Netcode)
- **Player vs Player** — the core M9 deliverable.
- **Player vs Bots**, and mixed PvP/bot lobbies.
- **Bot takeover on disconnect** — a bot seamlessly assumes a dropped player's hero (builds on M8 bots + M9 netcode).
- **Reconnect / rejoin in progress** — a dropped player rejoins and reclaims their hero from the fill-bot (the other half of bot-takeover; clean given the authoritative server).
- **Ranked matchmaking + Elo** rating, placements, and a ladder.
- **Custom matches** with full custom settings (extends the M8 `MatchConfig`).
- **Server browser** (Counter-Strike style): community-hosted lobbies / game modes that others can find and join.
- **Anti-cheat** — the authoritative server + zod-validated client inputs are the foundation (clients submit inputs, not state, so they cannot fabricate positions/health); layer on server-side anomaly/input-rate detection and replay-based review of reported matches. (The delayed live-spectate below is also an anti-stream-sniping measure.)

### Gameplay & Modes
- **Practice / sandbox mode** — free-play with dummies, infinite flux, and cooldown resets to trial heroes/builds; doubles as a balance-testing tool.
- **Tutorial** — a scripted intro teaching core mechanics (the KB specs one).
- **Co-op vs AI** — a full team of players against bots.
- **Draft / pick-ban phase** for ranked.
- **Surrender / forfeit vote**.

### Spectating & Replays
> Near-free from the architecture: the sim is deterministic and input-driven, so a match is
> just its seed + input log. Replays and spectating are a recording/playback layer, not new simulation.
- **Replay system** — record and re-watch past matches.
- **Live spectating** with an intentional **delay (e.g. 30–120 s)** to prevent stream-sniping / ghosting.
- **"Live now" widget** — a panel showing who is currently live / which matches are streamable right now, as an entry point to spectate.
- Browse and replay **past matches** from a history list.
- **Kill-cam / death recap** and **replay highlight/clip export** — both fall out of the replay layer.

### Community Content & Tooling
- **Custom maps**: build (in-game editor exists, M4), **share**, and **map voting** in lobbies.
- **Workshop** — browse/publish community maps, heroes, and game modes (Steam Workshop or equivalent).
- **Hero editor** — author new heroes (stats + abilities + upgrades), data-driven via the content schemas.
- **Particle editor** — author the particle/VFX schema (pairs with the *Particle Engine* backlog item above).
- **AI generators** — assisted generation of maps and heroes.
- **Mod / behavior API** — extend the planned JSON-driven behavior trees into broader community modding.

### Community & Web Presence
- **Feature-request board with voting** — public idea submission + upvotes to surface community priorities (e.g. Nolt, like Rust's [rust.nolt.io](https://rust.nolt.io/)). Until this exists, this Part 4 list is the capture point.
- **Public web changelog** — a richer, illustrated public-facing changelog (cf. Rust's [facepunch.com/changes](https://rust.facepunch.com/changes/)), complementing the in-game changelog and the repo `CHANGELOG.md`.
- **Public player wiki** — a community-facing game wiki on a free host like **wiki.gg** ([terraria.wiki.gg](https://terraria.wiki.gg/)) rather than Fandom (cf. [wiki.facepunch.com/rust](https://wiki.facepunch.com/rust/)). Distinct from the internal `docs/wiki/` (the design source-of-truth).

### Client UX & Platform
- **Player / hero selection screen**.
- **Settings menu**: keybinds, **FPS cap**, **graphics quality (low–high)**, audio.
- **UI layer** — polished HUD/menus (replacing the primitive Pixi rectangles; see the *UI* backlog item above).
- **Mobile support** — touch controls and a responsive layout.
- **In-game changelog** — a "what's new" / patch-notes panel surfaced in-client.

### Accessibility & Localization
- **Colorblind / accessibility modes** — important here specifically: the game is red-vs-blue team-coded, so colorblind support is closer to essential than optional.
- **Localization / i18n** — community-contributed translations fit the open-source model.
- **In-client hero/ability codex + tooltips** — learn kits without leaving the game (reuses the wiki content).

### Social
- **Chat**: global, all-chat, and team-chat channels.
- **Chat filter / moderation**.
- **Pings / quick-chat / emote wheel** — non-text comms; great for cross-language play and reduces chat toxicity.
- **Friends list + party / invite system** (the KB references parties).
- **Player reporting + review queue** — pairs with anti-cheat and chat moderation.

### Accounts, Identity & Progression
- **Steam login / auth** (and/or other providers) for persistence, ranking, and ownership of custom content.
- **Achievements** — unlockable achievements and player profile stats.
- **Match history + per-hero stats dashboard** and **leaderboards** (global / per-hero) — pair with the replay system and Elo.
- **Ranked seasons** with resets and cosmetic rewards.
- **Cosmetic-only unlocks / skins / announcer packs** — explicitly non-pay-to-win, fed by the workshop.

### Platform & Infrastructure
- **Cross-platform play** — web / desktop / mobile run the same deterministic sim, so cross-play is nearly free.
- **Self-hostable dedicated-server binary** — pairs with the server browser; open-source-friendly (community-hosted servers).
- **Cloud-synced settings & custom maps** — tied to the account / Steam login.
- **Balance telemetry** — aggregate match data to tune heroes data-drivenly (closes the loop on the data-driven content design).

### Audio & Feel
- **Announcer** — first blood, "base under attack", drill at 1/3 HP, etc. (the KB lists the hooks); big for the Awesomenauts feel.
