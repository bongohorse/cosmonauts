# Status Effects & Modifiers

Abilities apply timed status effects to heroes, summons, and creeps. This page is the canonical
catalogue — what each does, representative numbers, and how it stacks/clears. The pipeline that
applies them is in [Combat & the Ability System](./combat.md).

> **Conventions.** Every **duration** is stored as **integer ticks** (60 Hz; authored in
> seconds). **Magnitudes** are multipliers or flat amounts applied deterministically each tick,
> with the effect's state living on the affected entity in `GameState` (e.g.
> `{ kind, ticksLeft, magnitude }`) — never a closure or wall-clock timer. Exact values are
> tuned **per ability**; the figures below are representative ranges plus the few global
> constants we actually have.

## Crowd control (CC)

**Hard CC** — removes control entirely:

| Effect | What it does | Typical duration | Notes |
|---|---|---|---|
| **Stun** | No movement, no attack, no abilities. | 0.5–2 s | The strongest CC; interrupts casts. |
| **Snare / Root** | No movement; can still attack and cast. | 1–3 s | "Pinned in place." |
| **Knockback / knock-up** | Impulse applied to velocity; brief airborne loss of control. | impulse | Scaled by **mass** (see below). |
| **Pull / hook** | Drags the target toward a point. | impulse | e.g. Leon's tongue. |

**Soft CC** — degrades but doesn't remove control:

| Effect | What it does | Typical magnitude | Notes |
|---|---|---|---|
| **Slow** | Reduces movement speed. | −20 % to −50 % | Stacks multiplicatively (see below). |
| **Silence** | No active abilities; can still move and auto-attack. | 1–3 s | |
| **Disarm** | No auto-attack; abilities still usable. | 1–3 s | |
| **Blind** | Attacks miss and/or the screen/UI is obscured. | 1–3 s | |

## Damage-over-time (DoT)

- **Burn / Fire** — damage per second while affected. The `fireField` entity is the reference
  source: **400 dps default** (range 1–1000, tunable per source). A "400 dps" source deals
  `400 / 60` per tick.
- **Poison / Acid** — DoT that often also applies a **slow** (e.g. Gnaw's acid).

## Buffs (beneficial)

| Effect | What it does | Typical | Notes |
|---|---|---|---|
| **Haste** | Increases movement speed. | +15 % to +40 % | |
| **Shield / Barrier** | A temporary absorb pool soaked before health. | flat HP | The shared **Barrier** upgrade grants one. |
| **Heal-over-time / Regen** | Restores health over a duration. | flat / sec | The shared **Med-i'-can** upgrade is passive regen. |
| **Lifesteal** | Returns a % of damage dealt as health. | 10 %–30 % | Core sustain for brawlers/assassins. |
| **Damage amp** | Increases damage dealt (or, as a debuff, damage taken). | ± % | |
| **Invulnerability** | Immune to all damage, briefly. | < 1 s | Rare — e.g. dash i-frames. |
| **Stealth / Invisibility** | Hidden from enemy vision. | duration | Breaks on action; see [Hide Areas](../elements/hide-areas.md). |

## Special

- **Time-warp field** — a local zone that **slows enemy movement + projectiles** and/or
  **hastes allies** (Yuri's *Time Warp*). Implemented as the slow/haste primitives applied to
  everything inside an area volume.

## Global rules

- **Mass & CC resistance.** Heavier heroes are less affected by knockback/CC physics (an
  impulse is divided by mass). The shared **Baby Kuri Mammoth** upgrade further reduces incoming
  debuff potency/duration.
- **Stacking.** Same-type slows stack **multiplicatively** (two −30 % slows → ×0.7 × 0.7 ≈
  −51 %), not additively. An identical effect re-applied from the same source **refreshes** its
  duration rather than stacking. (Per-effect rules are tunable.)
- **Cleansing.** Some abilities clear debuffs outright; Baby Kuri Mammoth reduces them globally.
- **Team scaling** (applied alongside, not itself a status effect): each team level grants
  Nauts **+3 % damage / +4 % health / +3 % regen**, droids **+3.5 %**, and healthpacks/creeps
  **+4 % healing**. See [Progression](./progression.md).

## Determinism notes

- Durations decrement in ticks; magnitudes are multipliers applied each tick — fully
  deterministic and snapshot/rollback-safe because all of it lives in `GameState`.
- Knockback/pull go through the same velocity-impulse path as the rest of the physics, so they
  respect mass and collision exactly like any other movement.
