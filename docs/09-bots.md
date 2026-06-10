# 09 — Bots: AI Heroes

**Status:** v1, 2026-06-10. Vision capture — implementation is post-creation-tools (first
dumb bots arrive with the MOBA slice for backfill; programmability later).

## 1. What a bot is

A **bot** is an AI-controlled *hero* occupying a player slot — a non-human player. Not to
be confused with **droids** (dumb lane creeps, doc 07). Bots pick a character, have a
team, fight, shop, and die exactly like a human.

## 2. The one architectural rule (costs nothing now, enables everything later)

**A bot is a function `(GameState view) → PlayerInput`, evaluated per tick.** Bots drive
heroes through the exact same `PlayerInput` struct as a keyboard. The sim never knows the
difference. Consequences, all free:

- Bots cannot cheat — they have no API surface beyond what a human's fingers have.
- Bots work identically offline (practice mode), as server-side backfill (the
  authoritative server runs them like any client's inputs), and in headless matches.
- The existing `scripted-input` determinism tests are already primitive bots; the
  interface exists today.

## 3. Community-programmable bots (the Awesomenauts inheritance)

Ronimo's behavior-tree AI editor produced a real community of custom-AI authors;
Cosmonauts adopts the same spirit with our data-driven approach:

- **Bot = behavior tree in JSON**, zod-validated like all content. Nodes: selectors,
  sequences, conditions (distance/health/cooldown/los queries against the sim view),
  and actions that set fields of the output `PlayerInput`. Deterministic (PRNG from
  GameState), sandbox-safe by construction — it's data, not code, so a malicious bot
  file simply can't do anything but play.
- Authored by hand at first; an **AI editor** joins the creation-tools family (doc 08)
  later, with the same persistence model (JSON download/upload + localStorage).
- Submitted like any content: a PR adding a JSON file. CI validates the schema and can
  go further — at 377k ticks/s headless, CI can *play* a submitted bot against reference
  bots and report win rates. Community bot leagues are computationally trivial for us.

A raw-code escape hatch (JS/WASM bots) is explicitly deferred: determinism, sandboxing,
and server trust make it a different project. Behavior trees first; revisit only if the
community outgrows them.

## 4. Staging

1. **Dumb bots** (MOBA-slice era): hand-written behavior tree — walk toward lane, attack
   nearest enemy in range, retreat under 30% health. Good enough for 3v3 backfill.
2. **Bot infrastructure**: bot slots in lobby/match setup, difficulty via artificial
   reaction delay and aim error (deterministically derived), practice mode.
3. **Programmability**: behavior-tree schema stabilized + documented, example bots,
   PR submission path with CI validation.
4. **AI editor + community league** (aspirational): visual tree editor; scheduled CI
   tournaments ranking community bots.
