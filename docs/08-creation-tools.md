# 08 — Creation Tools: Map Editor & Hero Editor

**Status:** v1, 2026-06-10. Decisions: **in-game edit mode** (not a standalone app);
persistence via **JSON download/upload + localStorage autosave** (no backend). The goal in
one sentence: anyone can make a map.

## 1. Map editor — in-game edit mode

One key (Tab) flips the running sandbox between **play** and **edit** on the same map in
the same browser tab. Place a platform, Tab, jump on it two seconds later — the Ronimo
live-editing philosophy, which our sim/render split makes nearly free (edit mode pauses
the sim and mutates the loaded MapData/entity list; play mode re-derives collision and
runs).

### Editing model
- **Geometry tools:** rectangle (drag, then rotate via handle), polygon/polyline (click
  vertices), arc/curve (3-point), eraser. Grid snap and angle snap (15° steps) on by
  default, toggleable — "easy to use" means snapping does the precision work.
- **Entity palette:** every type from doc 07, **auto-generated from the zod schemas** —
  palette entries, inspector forms, parameter validation, and error messages all derive
  from the same schemas the loader uses. New entity type in content = new editor support
  for free. This is the single highest-leverage implementation choice in the editor.
- **Wiring tool:** select an activator, click targets; links render as curves in edit mode.
- **Inspector:** click anything → form of its params (schema-driven), plus id/enabled.
- **Undo/redo** as a command stack from day one (retrofitting undo is misery).
- **Playtest loop:** Tab back into play spawns you at a droppable "test spawn" marker;
  Esc returns to edit with everything as it was.

### Persistence (decided)
- **Autosave to localStorage** (debounced, keyed by map id) — work survives reloads.
- **Export/Import JSON** — the map format IS the save format; files are shareable,
  diffable, and forum-postable. Validation on import shows zod errors inline.
- Out of scope for now: share-links, galleries, backends. The format is designed so these
  bolt on later without migration.

### Staging
1. **Editor MVP** (its own milestone): geometry tools + ~6 trigger/solid types + inspector
   + undo + save/load. Proves "anyone can make a map."
2. **Editor v2:** wiring tool, actors (turret/bot/core), test-spawn marker, polish driven
   by watching someone non-technical build a map.

## 2. Hero editor

Same philosophy, later milestone (after the ability system exists — you can't edit what
isn't defined):

- Form-driven editing of `CharacterDef` (schema-derived, like the map inspector): stats,
  hitbox, color → instant respawn-and-feel in the sandbox. The existing tuning panel is
  the embryo of this.
- **Ability composer:** pick a template per slot (projectile / melee arc / dash /
  deployable / AoE / buff-heal — doc 05 §4 taxonomy), fill its parameters, test live.
- Same persistence: localStorage + JSON export/import.

## 3. Honest constraints

- Custom content is **local-only** until a sharing mechanism exists; two players can swap
  JSON files by hand and that's fine for this phase.
- Hand-rolled DOM/HTML UI for panels (like the tuning panel) rather than a UI framework,
  until the editor's complexity proves a need — keep the client dependency-light.
- The editor edits **maps**, not game balance; hero JSON shipped with the game changes via
  PRs so CI validates it.
