# 04 — MVP Game Design

**Status:** v1, 2026-06-10. Defines what we build and tune in Milestones 2 and 4. All
numbers are tuning starting points, expected to change in the sandbox — that's what the
live tuning panel is for.

## 1. Reference methodology — cloning the feel honestly

We cannot copy values out of Awesomenauts (no source access) and we don't need to. Process:

1. Implement parameterized movement (doc 02 §7) with plausible first values (below).
2. Frame-step gameplay footage of the original (60 fps captures are abundant) to measure:
   jump apex height in tiles, time-to-apex, full-hop air time, horizontal tiles/second,
   time from keypress to max run speed. Tiles are measurable because the original's level
   art has a visible block grid.
3. Tune in the sandbox until side-by-side capture comparison feels right. Feel reviewers >
   spreadsheets for the last 10%.

This keeps us legally clean (observed behavior, original implementation) and gives
contributors an objective protocol for "is it right yet?".

## 2. First character: **Nova** (ranged shooter archetype)

The Lonestar-class testbed: the most neutral kit, exercises every M2 system.

| Parameter | Value | Notes |
|---|---|---|
| Hitbox | 0.8 × 1.6 tiles | |
| Max health | 100 | dummy-target era; rebalanced in M4 |
| Move speed | 8.0 tiles/s | |
| Ground accel | 60 tiles/s² | near-instant (~0.13 s to top speed), arcade feel |
| Air accel | 35 tiles/s² | strong air control, platformer-MOBA staple |
| Gravity | 38 tiles/s² | |
| Jump velocity | 14.5 tiles/s | apex ≈ 2.8 tiles, time-to-apex ≈ 0.38 s |
| Max jumps | 2 | double jump |
| Jump cut factor | 0.45 | release early → shorter hop |
| Max fall speed | 16 tiles/s | |
| **Blaster:** damage | 10 | |
| cooldown | 0.25 s | 4 shots/s |
| projectile speed | 22 tiles/s | |
| projectile radius | 0.25 tiles | |
| projectile lifetime | 0.9 s | ≈ 20-tile effective range |

## 3. MVP roster plan (M4+)

Three archetypes to force the ability system to generalize — one per movement gimmick:

1. **Nova** — ranged shooter, double jump (above).
2. **Claw** (working name) — melee assassin: dash, melee arc hits, burst mobility.
3. **Loft** (working name) — support: hover/flight movement, a deployable, a heal.

Character identity (art, story, final names) is intentionally deferred per the IP decision.

## 4. Maps

### 4.1 M2: "Testing Grounds"
A sandbox, not a battlefield: flat run-up area, stairs of platforms for jump tuning, a
1-tile-gap corridor for hitbox honesty, two walls for wall-collision feel, three target
dummies (one airborne). Defined in JSON like any map (doc 05) — the map format ships in M2.

### 4.2 M4: first real map
Original layout (not a clone of Ribbit IV et al.), but following the original's grammar:
two horizontal lanes joined by vertical neutral space, two turrets per lane, base
behind the lanes, droid spawners on a timer, a hideout area off the lanes. Detailed design
deferred to its own doc when M4 starts.

## 5. MOBA loop (M4 definition, recorded now for scope)

- **Win:** destroy the enemy base core.
- **Turrets:** high damage, target droids first; block lane progress until escorted droids
  tank them.
- **Droids:** spawn in waves per lane, walk waypoints, melee attackers.
- **Solar:** single currency from droid kills, player kills, ambient pickups.
- **Shop:** at home base; buy from a per-match loadout of upgrades (stat modifiers — doc 02
  §7 / doc 05). Pre-match loadout selection itself is post-M4.
- **Respawn:** timed, scaling with match length; drop-pod re-entry.

## 6. Out of scope until the loop is fun

Accounts, progression, ranked matchmaking, cosmetics, spectating, replays, mobile controls,
sound design, final art. Listed so nobody opens issues asking — the answer is "after M4."
