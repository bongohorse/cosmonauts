# 08 — Creation Tools: Map Editor & Hero Editor

**Status:** v2, 2026-06-10 (expanded: manipulation handles, mirror mode, align tools,
tinting, search/quick-bar, validation). Decisions: **in-game edit mode** (not a
standalone app); persistence via **JSON download/upload + localStorage autosave** (no
backend). The goal in one sentence: anyone can make a map.

## 1. Map editor — in-game edit mode

One key (Tab) flips the running sandbox between **play** and **edit** on the same map in
the same browser tab. Place a platform, Tab, jump on it two seconds later — the Ronimo
live-editing philosophy, which our sim/render split makes nearly free.

### Selection & manipulation
- Everything selected shows **anchor handles**: 8 resize handles on the bounding
  rectangle (drag a corner/edge to resize) plus a **rotation handle** above it. Same
  interaction for geometry and entities — one manipulation model to learn.
- Grid snap and **angle snap (15° steps)** on by default, toggleable — "easy to use"
  means snapping does the precision work. Jumpers rotate the same way; their launch
  arrow is the rotation handle (default 45°/up).
- **Align tools:** center on map axis, align selected (left/right/top/bottom/center),
  distribute evenly.
- **Tint:** color picker on most entities and geometry (the `tint` param, doc 07 §1) for
  theming without new content.

### Mirror mode (the balance tool)
- Every map has a **center point/axis**. With mirroring toggled on, placing, moving, or
  deleting anything applies the mirrored operation on the other side — with **team
  swap**: a red-team barrier placed on the left creates the blue-team barrier on the
  right; a cosmium cube near red spawn creates its twin near blue spawn.
- Mirroring is a **tool, not a constraint**: toggle it off and build fully asymmetric
  maps. Most competitive maps will keep it on — symmetry is balance you don't have to
  guess at. Mirrored pairs stay linked (edit one, the twin follows) until explicitly
  unlinked.

### Palette, search, quick bar
- **Entity palette** auto-generated from the zod schemas (doc 07) — palette entries,
  inspector forms, validation messages all derive from the same schemas the loader uses.
  New entity type in content = full editor support for free. The single
  highest-leverage implementation choice in the editor.
- **Search box** over all entity types + a **quick bar** of the most common ones
  (platform, glass platform, jumper, turret, spawner, cosmium cube…), customizable.
- **Wiring tool:** select an activator/turret, click targets; links render as curves.
  `onDestroyed` event wires use the same gesture from the source entity.
- **Path tool:** draw droid lane paths and moving-platform routes as clickable waypoint
  chains (used by `droidSpawner`, `movingPlatform`, flying droid routes).

### Layers
- **Collision/gameplay layer** (everything above) and a **decoration layer**: visual-only
  shapes with z-order and parallax factor, never collided. Layers lock individually so
  decorating can't move gameplay objects.

### Safety & save
- **Undo/redo** as a command stack from day one.
- **Map check on save:** both teams have spawns, at least one core per team in MOBA
  maps, kill zone coverage under open pits, droid paths reach the enemy base, no entity
  with broken wiring targets. Warnings, not hard blocks — prototypes are allowed to be
  weird.
- **Autosave to localStorage** (debounced, keyed by map id) + **Export/Import JSON** —
  the map format IS the save format. `meta` (author, description, team size) is edited
  here.

### Staging
1. **Editor MVP:** geometry tools with handles, snap, ~8 placeable types, inspector,
   undo, save/load, mirror mode.
2. **Editor v2:** wiring + path tools, full actor set, align/distribute, decoration
   layer, map check, quick-bar customization, prefab grouping (save a selection — e.g.
   "turret + barrier + button" — as a reusable stamp).

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

- Custom content is **local-only** until a sharing mechanism exists; swapping JSON files
  by hand is fine for this phase.
- Hand-rolled DOM/HTML UI for panels (like the tuning panel) rather than a UI framework,
  until the editor's complexity proves a need.
- The editor edits **maps**, not game balance; hero JSON shipped with the game changes
  via PRs so CI validates it.
