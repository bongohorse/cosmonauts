# 01 — Technical Analysis: What It Takes to Build Cosmonauts

**Status:** Living document. Written 2026-06-10 as the first step of Milestone 1 (design docs).

## 1. Goal

Cosmonauts is an open-source, browser-based 2D action-platformer MOBA whose *gameplay feel*
faithfully recreates Awesomenauts (Ronimo Games, 2012). Everything else — characters, world,
names, art, music, maps — is original IP.

## 2. Decisions made (2026-06-10)

| Topic | Decision |
|---|---|
| Engine | Custom engine in TypeScript, rendering via Pixi.js. No off-the-shelf game framework. |
| Netcode | Target: **authoritative server + client-side prediction**. Final commitment deferred until a prototype exists, so the simulation is built transport-agnostic from day one. |
| IP / art | Original universe with cloned mechanics. Geometric placeholder art during prototyping; art, music, and story come last. |
| Milestone 1 | Design and architecture documents (this folder). |

Added 2026-06-10 (post-sandbox direction talk):

| Topic | Decision |
|---|---|
| Level geometry | **Segment-based collision v2** — platforms at any rotation, curves as polylines, slopes; capsule world-collision, AABB combat hitboxes stay (doc 06). |
| Map content | Data-driven placeable entity system with activator wiring (doc 07). |
| Creation tools | In-game map editor (play/edit toggle); hero editor after the ability system; JSON download/upload + localStorage persistence, no backend (doc 08). |
| Netcode timing | **Deferred** until the prototype is in good shape — creation tools and content systems come first. |
| Currency | **Flux** (final, decided 2026-06-10 — short and easy to shout; replaces "solar"): silver cube = 1, gold cube = 5; hero kills pull flux to the killer, other deaths drop it (doc 07 §4). |

The rationale for each decision is captured in the relevant sections below.

## 3. What "feels like Awesomenauts" means, concretely

"Feel" is the project's success criterion, so it needs a definition we can test against:

- **Instant input response.** Your character reacts to input on the next simulation tick,
  ~16 ms or less from keypress to visible movement — even in a networked match. This is the
  property the original's P2P architecture existed to protect, and our netcode must preserve
  it via prediction.
- **Arcade platformer movement.** Floaty-but-precise jumps, generous air control, and
  per-character movement gimmicks (double jump, flight, hover, dash). No "realistic" physics:
  the original used pure velocity + AABB collision, and so will we.
- **The flattened MOBA loop.** Side-scrolling map with lanes blocked by heavy turrets, waves
  of AI droids pushing lanes, a destructible enemy base as the win condition, neutral areas
  with platforming and pickups between the lanes.
- **In-match economy.** A single currency earned from droids/kills/pickups, spent at the base
  shop on upgrades chosen from a pre-match loadout. Upgrades are stat modifiers layered onto
  baseline character settings — this data model is core to the original's design flexibility
  and we replicate it (see §4.2).
- **3v3 with drop-in feel**, 60 fps rendering, and first-class support for both
  keyboard/mouse and gamepad (Gamepad API).
- **Short time-to-action.** Browser games live or die on this: click a link, pick a
  character, play. No install, minimal loading.

A separate game design doc (04) will pin down exact movement parameters, the MVP map layout,
and the MVP character roster.

## 4. Component breakdown

Everything we must build, with the browser-specific approach and a difficulty rating.

### 4.1 Deterministic simulation core — *hard, and the foundation for everything*

A fixed-timestep simulation (likely 60 Hz; final rate decided in doc 02) that knows nothing
about rendering, the DOM, or Pixi. It is a pure function: `(state, inputs) -> state`.

- **Entity model:** every game object (naut, droid, projectile, turret, pickup) is an entity
  with an AABB, a velocity vector, and data-driven stats. No rigid-body physics engine —
  matching the original, collision is velocity-based AABB sweeps against level geometry
  (tiles or line segments) and against other entities. This is simple, fast, and cheap to
  keep deterministic.
- **Why a separate package:** the same simulation code runs in the browser (for prediction)
  and on the server (as authority). This single architectural rule is what makes the netcode
  tractable — see §6.
- **Determinism scope:** with an authoritative server, perfect cross-machine determinism is
  a nice-to-have, not a requirement (the server is always right; clients just predict and
  correct). We still avoid the known JS hazards in sim code — `Math.sin/cos/pow` results can
  differ between engines, so the sim uses lookup tables or polyfilled math, and never
  iterates over unordered structures. This keeps the door open for P2P/lockstep modes later.

### 4.2 Data-driven content system — *medium, high leverage*

The original's "Settings" system, rebuilt natively: characters, abilities, upgrades, droids,
and turrets are all defined in validated JSON (zod schemas), not code.

- An **upgrade** is a set of stat modifiers applied to a character's baseline settings.
- A **status effect** (slow, DoT, shield) is a *temporary* modifier injection with a
  duration — exactly the original's trick.
- Abilities are parameterized templates (projectile, melee arc, dash, deployable, AoE) so
  designers compose new characters from data without engine changes.

This is what lets contributors create and balance content via pull requests to JSON files —
the open-source equivalent of Ronimo's live in-game editors.

### 4.3 Rendering — *medium*

Pixi.js (v8, WebGL with WebGPU where available) renders interpolated snapshots of the sim.

- The renderer never mutates sim state; it reads two consecutive sim states and interpolates
  between them, decoupling render rate from sim tick rate.
- **Prototype phase:** Pixi `Graphics` primitives — colored rectangles and circles. Free,
  instant, and forces us to prove the feel without art.
- **Later:** a sprite-animation player driven by atlas + JSON animation data, with per-frame
  events (hitbox on/off, sound cues, particle emits) — our replacement for Ronimo's
  After Effects → Animation Editor pipeline, likely fed from Aseprite or TexturePacker.

### 4.4 Input — *easy*

Keyboard/mouse and Gamepad API, sampled once per sim tick into a compact, serializable input
struct (movement axis, aim vector, buttons). The input struct *is* the network payload for
the local player, so it's designed for the wire from the start.

### 4.5 Networking — *hard; the project's biggest risk and biggest differentiator*

Target architecture (see decision table): **authoritative server + client-side prediction.**

- A headless Node/Bun server runs the identical sim package as the source of truth.
- Each client **predicts its own character** by running the shared sim locally on its own
  inputs immediately — preserving the zero-input-lag feel.
- The server streams state snapshots; on receipt, the client rewinds to the server state and
  **replays its unacknowledged inputs** (reconciliation). Mispredictions show up as small
  corrections, not input lag.
- **Remote entities** (other players, droids, projectiles not ours) are rendered ~100 ms in
  the past via snapshot interpolation — the standard Source-engine-style approach.
- **Transport:** WebSocket first (works everywhere, simplest to ship). The browser has no raw
  UDP, and TCP head-of-line blocking is the cost. Upgrade path: WebRTC DataChannel in
  unreliable/unordered mode to the server (geckos.io-style), or WebTransport as Safari
  support matures. The transport sits behind an interface so this is swappable.
- **Why not faithful P2P:** browsers throttle background tabs (an alt-tabbed peer stalls a
  distributed sim; under an authoritative server they merely drift and resync), NAT failures
  require TURN relays anyway, and open-source + P2P authority means trivially easy cheating.
  The original's own "sliding bug" history shows the desync class of problems we'd inherit.
- **Cost lesson from the original:** Galactron's operating cost contributed to the game's
  death. Mitigation: the entire backend stays small enough to run as one Docker container
  that anyone can host; "official" servers are a deployment choice, not a special codebase.

An honest difficulty assessment of prediction/reconciliation is in §6.

### 4.6 AI — *medium, mostly deferred*

- **Droids:** waypoint-following finite state machine (walk lane → attack nearest target).
- **Turrets:** target priority + range checks. Trivial.
- **Practice bots:** behavior trees, post-MVP. Needed eventually for bot-backfill and
  practice mode, which the original used heavily for onboarding.

### 4.7 Audio — *easy, deferred*

WebAudio behind a thin interface; sound cues fire from animation/sim events. Placeholder
bleeps during prototyping, consistent with the art strategy.

### 4.8 Backend services — *medium, deliberately minimal*

Lobby creation/joining, matchmaking, and (if WebRTC transport is adopted) signaling. One
small service. Accounts, progression, and ranked matchmaking are explicitly out of scope
until the game is fun; the Galactron post-mortem says don't build this big.

### 4.9 Tooling & developer experience — *easy wins, do early*

The browser is our version of Ronimo's live editors, almost for free:

- Vite dev server with HMR — content JSON edits hot-reload into a running match.
- In-game debug overlay: hitboxes, velocities, sim tick info, network stats (RTT, snapshot
  age, misprediction count).
- A tuning panel (sliders bound to character settings) for live game-feel iteration —
  the single most important tool for hitting the "feels like Awesomenauts" bar.

## 5. Browser-specific constraints

| Constraint | Impact | Mitigation |
|---|---|---|
| No raw UDP | WebSocket = TCP head-of-line blocking under packet loss | Small payloads; transport interface with WebRTC DataChannel / WebTransport upgrade path |
| Background-tab throttling | `requestAnimationFrame` stops, timers clamp to ≥1 s when tab is hidden | Authoritative server keeps the match alive; client fast-forwards on return. (This alone nearly rules out faithful P2P.) |
| GC pauses | Frame hitches during matches | Object pooling and flat/typed-array layouts in sim hot paths; avoid per-tick allocation |
| Float math portability | `Math.sin` etc. vary across JS engines | Deterministic math layer in the sim package (§4.1) |
| Asset weight | Slow first load kills browser games | Placeholder-art phase costs ~nothing; later: atlas compression, lazy-load per map/character |
| Performance generally | — | Not a real risk: 6 players + ~dozens of droids/projectiles is tiny by modern JS/WebGL standards |

## 6. How hard is client-side prediction, really?

(Asked during decision-making; answered honestly.)

The algorithm is well-trodden — Gabriel Gambetta's "Fast-Paced Multiplayer" series and the
Valve/Source networking docs describe exactly this design, and it's the industry standard.
The actual prediction/reconciliation glue is small: keep a ring buffer of your recent inputs,
and on each server snapshot, reset to it and re-run the shared sim over the unacked inputs.
On the order of a few hundred lines.

**The difficulty is not the netcode — it's the discipline the sim must already have:**
fixed timestep, fully serializable state, input-driven, zero rendering or wall-clock
dependencies. Retrofitting that onto a sim that grew organically is a rewrite; building it
in from day one is nearly free. That is why the "decide after a prototype" choice still
fixes the architecture *now*: the sim core is written as if prediction exists from the first
line of code.

Realistic estimate: with the sim built to spec, the first networked milestone (two predicted
players moving and shooting via a server) is **a few weeks of focused work**, not months.
The long tail (lag compensation for melee, tuning interpolation delay, edge cases around
knockback on a predicted character) is iterative polish after that.

## 7. Proposed repository architecture

pnpm-workspaces monorepo, so the sim is genuinely shared between client and server:

```
cosmonauts/
├── packages/
│   ├── sim/        # Deterministic game core. Pure TS — no DOM, no Pixi, no Node APIs.
│   ├── content/    # Character/upgrade/map/droid definitions (JSON) + zod schemas.
│   ├── protocol/   # Wire message schemas + serialization, shared by client & server.
│   ├── client/     # Pixi rendering, input, prediction, UI. Depends on sim/content/protocol.
│   └── server/     # Authoritative game server + lobby. Depends on sim/content/protocol.
├── tools/          # Debug overlay, tuning panel, future content editors.
└── docs/           # These documents.
```

Toolchain: TypeScript strict, Vite (client dev/build), Vitest (sim gets the heaviest test
coverage — it's pure functions, so it's the most testable code in the project), Biome
(linting + formatting in one fast tool). The dependency rule that must never break:
**`sim` imports nothing from any other package.**

## 8. Roadmap

Revised 2026-06-10 after sandbox playtesting: creation tools and content systems moved
ahead of netcode (maintainer decision — multiplayer starts once the prototype is in good
shape).

| Milestone | Deliverable | Proves |
|---|---|---|
| **M1 — Design docs** ✅ | Docs 01–08 | Shared understanding; contributors can orient |
| **M2 — Game-feel sandbox** ✅ | One test map, one placeholder character, live tuning panel; auto-deployed to GitHub Pages | The feel — the project's core promise |
| **M3 — Geometry v2** | Segment collision: rotated platforms, curves, slopes, capsule movement; glass (drop-through) + team platforms; tiles still compile in; ramp/curve test map (doc 06) | Creative-freedom geometry without losing the approved feel |
| **M4 — Map entities** | Trigger volumes (jumper, force field, teleport, fire, kill zone, heal), activator + event wiring, team barriers, flux/health pickups, droid types, first actors (doc 07) | Maps can be *designed*, not just drawn |
| **M5 — Map editor** | In-game edit mode: geometry tools, schema-driven entity palette + inspector, undo, JSON + localStorage saves (doc 08) | Anyone can make a map |
| **M6 — Abilities & heroes** | Ability template system, 2–3 distinct heroes, hero editor (docs 05 §4, 08 §2) | Combat depth; the content pipeline generalizes |
| **M7 — Netcode** | Authoritative server, two browsers playing together with prediction + interpolation; network debug overlay (doc 03) | The biggest technical risk |
| **M8 — MOBA vertical slice** | Lanes with droid waves, turrets, destructible core, solar + shop + upgrades, 3v3 with bot backfill (doc 09) | The complete MOBA loop is fun |
| **M9 — Content breadth** | More heroes/maps via the pipeline; balance iteration; contributor guide | The content system scales |
| **M10 — Identity & service** | Art direction replaces placeholders; lobby/matchmaking hardening; community server hosting (Docker) | A game people can actually play and share |

## 9. Open questions (to resolve in docs 02–05)

- Sim tick rate: 60 Hz (simplest, matches render) vs 30 Hz + interpolation (halves bandwidth
  and server CPU). → doc 02.
- Reference capture: how do we measure the original's movement values (jump height, air
  control, gravity, attack timings) to clone the feel? Frame-by-frame video analysis of
  existing footage is the likely answer. → doc 04.
- MVP roster: suggest 3 archetypes — a ranged shooter, a melee assassin, a support — to
  force the ability system to generalize. → doc 04.
- Snapshot encoding: JSON first vs binary (bitecs-style/flatbuffers) from the start. → doc 03.
- Server runtime: Node vs Bun vs Deno for the game server. → doc 03.
