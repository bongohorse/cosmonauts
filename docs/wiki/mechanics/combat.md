# Combat & the Ability System

Combat is the interplay of basic attacks, active abilities, and crowd control. This page
documents the **ability core system** — the data-driven pipeline the sim uses to execute
every hero action — and the abilities shared across the roster. Status effects that abilities
apply are catalogued in [Status Effects](./status-effects.md).

> **Status — this is the Milestone 6 design.** Today `AbilityDefSchema`
> (`packages/content/src/schemas.ts`) is **display-only** (name / description / upgrades for the
> wiki); only the basic `attack` is actually executable in the sim. The executable model below
> is what M6 builds. Per the content rules, abilities are authored in **seconds/tiles** and the
> content loader converts them to **integer ticks** before the sim sees them.

## Hero kit structure

Every hero shares the same slot layout (mirrors the source material; all 34 designed heroes
follow it):

- **Auto-attack** — the basic attack (e.g. Lonestar's *Blaster*). Gated only by attack speed,
  costs nothing.
- **Two active abilities** — the unique skills (e.g. *Dynamite Throw*, *Summon Hyper Bull*).
- **Jump / movement skill** — the 4th slot; every hero has one (double-jump, dash, hover,
  flight…).
- Each ability carries **~6 shop upgrades** that tune it (more damage, lower cooldown, added
  effects). See *Shared upgrades* below.

## The ability pipeline (per tick)

`step()` resolves abilities deterministically each 60 Hz tick:

1. **Input** — `PlayerInput` carries the button(s) pressed plus a **pre-normalized aim vector**
   (so the sim never calls `atan2`).
2. **Gate** — the ability fires only if it is off cooldown (or has a charge available), the
   caster is not stunned/silenced, and any resource cost is met.
3. **Cast delay** *(optional)* — a wind-up of N ticks before the effect resolves; interruptible
   by hard CC when the ability is flagged interruptible.
4. **Activate** — the effect resolves (see *Effect primitives*).
5. **Channel / active window** *(optional)* — some abilities persist for a duration (beams,
   deploy/siege modes, auras), ticking each frame.
6. **Cooldown** — `cooldownTicks` begins decrementing. **Charges:** an ability may store *K*
   charges, each refilling on its own cooldown.

## Effect primitives

Abilities are composed from a small set of deterministic building blocks, so the sim stays
generic and data-driven rather than hard-coding each hero:

- **Projectile** — spawned into `GameState.projectiles` with velocity from the aim vector,
  plus `radius`, `damage`, `lifetimeTicks`. *(Already implemented for auto-attacks.)*
- **Hitbox (melee / AoE)** — an instantaneous or lingering AABB / circle overlap vs hurtboxes.
- **Self-movement** — dash / teleport / leap: writes the caster's velocity or position.
- **Summon** — spawns an entity (turret, drone, bull) reusing the map-entity system.
- **Heal / Shield** — restores health or adds an absorb pool.
- **Knockback / pull** — applies an impulse to a target's velocity (scaled by **mass**).
- **Apply status** — attaches a timed [status effect](./status-effects.md) to a target.

## Auto-attacks

The basic attack is the one piece already executable in the sim (`AttackData`): `damage`,
`cooldownTicks`, `projectileSpeed`, `projectileRadius`, `lifetimeTicks`. Fire rate is the
cooldown; melee attacks use a short-lived hitbox instead of a projectile.

## Shared abilities & upgrades

What recurs across the roster — the ability core treats these as the common baseline (counts
verified against the 34 hero design pages):

- **Auto-attack** — all 34 heroes.
- **Jump / movement skill** — all 34 heroes (the 4th slot).
- **Universal "utility" upgrades** (sit on the jump/utility slot, present on nearly the whole
  roster):
  - **Power Pills Turbo** — increases max health. *(34/34)*
  - **Med-i'-can** — passive health regeneration. *(33/34)*
  - **Baby Kuri Mammoth** — reduces the effect of all debuffs / CC. *(34/34)*
  - **Piggy Bank** — grants **+100 Flux** instantly (utility slot). *(34/34)*
  - **Barrier** — a damage-absorbing shield. *(~12 heroes)*
  - **Movement-speed boots** — a per-hero-named move-speed utility (common, names vary).

### Recurring ability archetypes

Not identical abilities, but the patterns the effect primitives are designed to cover so new
heroes **compose** rather than special-case:

- **Dash / blink** (Froggy G *Splash Dash*, Leon) · **projectile** (most shooters) ·
  **melee combo** (Skølldir *Bash*) · **summon** (Lonestar *Bull*, Voltar drones, Gnaw
  weedlings) · **AoE nuke** (Clunk *Explode*, Derpl nuke) · **heal aura** (Voltar, Yuri) ·
  **trap / snare** (Derpl, Yuri mines) · **deploy / siege mode** (Derpl).

## Determinism & data rules (important)

The ability system must obey the sim's [physics determinism rules](./physics.md):

- **Durations are integer ticks** (authored in seconds, converted by the content loader). No
  `Date`, no wall-clock.
- **Any randomness** (spread, crit) uses `rand()` with state in `GameState.rng` — never
  `Math.random`.
- **Angles** use `dsin`/`dcos` or the pre-normalized aim vector — never `Math.sin/cos/atan2`.
- **All ability state lives in `GameState`** (JSON-safe) so it snapshots and rolls back for
  netcode. No closures, no module-scope timers.
- Combat overlaps are **AABB / circle** — cheap and deterministic.
- **Floating damage numbers** and hitstop/screenshake are **render-only** hooks in the client;
  they must never feed back into the sim.
