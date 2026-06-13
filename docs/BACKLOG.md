# Cosmonauts — Backlog & Future Ideas

Work that is **not yet scheduled into a milestone**. The committed plan — vision, architecture,
and milestones M1–M10 — lives in [ROADMAP.md](./ROADMAP.md); this file is the parking lot so
nothing is lost. Two parts: near-term **Known Issues & Tech Debt**, and the post-M10 **Future
Features & Live-Service Ideas**. Grouping is thematic, not priority. **New feature ideas go here.**

---

## Known Issues & Tech Debt
- *Physics:* Ensure high-speed projectiles do not tunnel through thin walls (continuous collision detection).
- *UI:* Create polished SVG/UI layer overlays to replace primitive Pixi.js rectangles.
- *Performance:* Optimize `aabbOverlap` checks with Spatial Hashing / QuadTrees.
- *Holiday Themes:* Load cosmetic prop layers conditionally based on system dates. ([Themes Wiki](./wiki/maps/holiday-themes.md))
- *Particle Engine:* Build a custom Pixi.js emitter wrapper matching the Awesomenauts particle schema.

---

## Future Features & Live-Service Ideas (post-M10)

Ideas beyond the current M1–M10 plan — not yet scheduled or designed. Many build on milestones
already planned (noted inline).

### Online Play & Matchmaking (extends M9 Netcode)
- **Player vs Player** — the core M9 deliverable.
- **Player vs Bots**, and mixed PvP/bot lobbies.
- **Bot takeover on disconnect** — a bot seamlessly assumes a dropped player's hero (builds on M8 bots + M9 netcode).
- **Reconnect / rejoin in progress** — a dropped player rejoins and reclaims their hero from the fill-bot (the other half of bot-takeover; clean given the authoritative server).
- **Ranked matchmaking + Elo** rating, placements, and a ladder.
- **Custom matches** with full custom settings (extends the M8 `MatchConfig`).
- **Server browser** (Counter-Strike style): community-hosted lobbies / game modes that others can find and join.
- **Anti-cheat** — the authoritative server + zod-validated client inputs are the foundation (clients submit inputs, not state, so they cannot fabricate positions/health); layer on server-side anomaly/input-rate detection and replay-based review of reported matches. (The delayed live-spectate below is also an anti-stream-sniping measure.)
- **Region selection + ping-based matchmaking** — route players to nearby servers for low latency.
- **Smurf / boost protection** for ranked integrity.

### Gameplay & Modes
- **Practice / sandbox mode** — free-play with dummies, infinite flux, and cooldown resets to trial heroes/builds; doubles as a balance-testing tool.
- **Tutorial** — a scripted intro teaching core mechanics (the KB specs one).
- **Co-op vs AI** — a full team of players against bots.
- **Draft / pick-ban phase** for ranked.
- **Surrender / forfeit vote**.
- **Bot difficulty levels** (0–6 bars, per the KB) for practice and bot matches.

### Spectating & Replays
> Near-free from the architecture: the sim is deterministic and input-driven, so a match is
> just its seed + input log. Replays and spectating are a recording/playback layer, not new simulation.
- **Replay system** — record and re-watch past matches.
- **Live spectating** with an intentional **delay (e.g. 30–120 s)** to prevent stream-sniping / ghosting.
- **"Live now" widget** — a panel showing who is currently live / which matches are streamable right now, as an entry point to spectate.
- Browse and replay **past matches** from a history list.
- **Kill-cam / death recap** and **replay highlight/clip export** — both fall out of the replay layer.
- **Observer / caster tools** — player names, gold/level graphs, draft view, and a telestrator for casting.
- **Replay playback controls** — variable speed, free-cam, and jump-to-event.
- **Tournament / bracket system** for community events.

### Community Content & Tooling
- **Custom maps**: build (in-game editor exists, M4), **share**, and **map voting** in lobbies.
- **Workshop** — browse/publish community maps, heroes, and game modes (Steam Workshop or equivalent).
- **Hero editor** — author new heroes (stats + abilities + upgrades), data-driven via the content schemas.
- **Particle editor** — author the particle/VFX schema (pairs with the *Particle Engine* item above).
- **AI generators** — assisted generation of maps and heroes.
- **Mod / behavior API** — extend the planned JSON-driven behavior trees into broader community modding.
- **In-editor "playtest with bots"** button — test a map without leaving the editor.
- **Curated / featured community maps** with tags and discovery.

### Community & Web Presence
- **Feature-request board with voting** — public idea submission + upvotes to surface community priorities (e.g. Nolt, like Rust's [rust.nolt.io](https://rust.nolt.io/)). Until this exists, this list is the capture point.
- **Public web changelog** — a richer, illustrated public-facing changelog (cf. Rust's [facepunch.com/changes](https://rust.facepunch.com/changes/)), complementing the in-game changelog and the repo `CHANGELOG.md`.
- **Public player wiki** — a community-facing game wiki on a free host like **wiki.gg** ([terraria.wiki.gg](https://terraria.wiki.gg/)) rather than Fandom (cf. [wiki.facepunch.com/rust](https://wiki.facepunch.com/rust/)). Distinct from the internal `docs/wiki/` (the design source-of-truth).

### Client UX & Platform
- **Player / hero selection screen**.
- **Settings menu**: keybinds, **FPS cap**, **graphics quality (low–high)**, audio.
- **UI layer** — polished HUD/menus (replacing the primitive Pixi rectangles; see the *UI* item above).
- **Mobile support** — touch controls and a responsive layout.
- **In-game changelog** — a "what's new" / patch-notes panel surfaced in-client.
- **Minimap** — the KB relies on it (structure HP, hidden-unit reveal, health-pack dots); core MOBA UI.
- **Post-match scoreboard** with detailed per-player stats and a **damage breakdown**.
- **Camera options** — zoom, lock-to-hero, free-cam, edge-pan.
- **Main-menu news feed** — surface the web changelog / events in-client.
- **Loadout presets + shareable build codes** — the shop already has 3-of-6 upgrade loadouts and recommended builds (KB); add presets and shareable codes.

### Accessibility & Localization
- **Colorblind / accessibility modes** — important here specifically: the game is red-vs-blue team-coded, so colorblind support is closer to essential than optional.
- **Localization / i18n** — community-contributed translations fit the open-source model.
- **In-client hero/ability codex + tooltips** — learn kits without leaving the game (reuses the wiki content).
- **Reduced-motion / reduced-flashing (photosensitivity-safe) mode** — a responsibility item for a particle/VFX-heavy game.
- **Controller / gamepad support**; **UI scaling**.
- **Subtitles / captions** for the announcer and key audio cues.

### Social
- **Chat**: global, all-chat, and team-chat channels.
- **Chat filter / moderation**.
- **Pings / quick-chat / emote wheel** — non-text comms; great for cross-language play and reduces chat toxicity.
- **Friends list + party / invite system** (the KB references parties).
- **Player reporting + review queue** — pairs with anti-cheat and chat moderation.
- **Honor / commendation system** — positive-behavior reinforcement (proven anti-toxicity).
- **Player mute / block**.

### Accounts, Identity & Progression
- **Steam login / auth** (and/or other providers) for persistence, ranking, and ownership of custom content.
- **Achievements** — unlockable achievements and player profile stats.
- **Match history + per-hero stats dashboard** and **leaderboards** (global / per-hero) — pair with the replay system and Elo.
- **Ranked seasons** with resets and cosmetic rewards.
- **Cosmetic-only unlocks / skins / announcer packs** — explicitly non-pay-to-win, fed by the workshop.
- **Account data export** (privacy / GDPR).

### Platform & Infrastructure
- **Cross-platform play** — web / desktop / mobile run the same deterministic sim, so cross-play is nearly free.
- **Self-hostable dedicated-server binary** — pairs with the server browser; open-source-friendly (community-hosted servers).
- **Cloud-synced settings & custom maps** — tied to the account / Steam login.
- **Balance telemetry** — aggregate match data to tune heroes data-drivenly (closes the loop on the data-driven content design).
- **Server status page** — public uptime / incident status.

### Audio & Feel
- **Announcer** — first blood, "base under attack", drill at 1/3 HP, etc. (the KB lists the hooks); big for the Awesomenauts feel.

### Live Ops & Balancing
- **Test realm / PTR** — try balance changes before they go live (fits the data-driven content model + open source).
- **Seasonal events / limited-time modes** — ties the Holiday Themes item above.

### Sustainability
- **Donations / Patreon** ("support the project"); a cosmetic-only store *if* ever monetized — never pay-to-win.
