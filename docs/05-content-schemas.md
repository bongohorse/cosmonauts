# 05 — Content Schemas

**Status:** v1, 2026-06-10. The contract for `packages/content`. Schemas are zod (v4) —
they validate at load time and derive the TypeScript types used by `sim`.

## 1. Principles

- **Data, not code.** Characters, maps, droids, upgrades are JSON files. A balance change
  or a new character is a pull request touching no engine code.
- **Validate at the boundary.** Content is parsed once via zod at load; the sim receives
  already-validated plain data and never re-checks.
- **Seconds in files, ticks in sim.** Authors write human units (seconds, tiles); the
  loader converts durations to ticks (doc 02 §2).
- **Forward-compatible by sections.** Schemas grow by adding optional sections (e.g.
  `abilities`, `upgrades`), never by repurposing fields.

## 2. Character schema (M2 scope)

```ts
const CharacterDef = z.object({
  id: z.string(),                  // "nova"
  name: z.string(),
  archetype: z.enum(["shooter", "assassin", "support"]),
  color: z.string(),               // placeholder-art era: rectangle color
  hitbox: z.object({ w: z.number(), h: z.number() }),        // tiles
  stats: z.object({
    maxHealth: z.number(),
    moveSpeed: z.number(),         // tiles/s
    groundAccel: z.number(),       // tiles/s²
    airAccel: z.number(),
    gravity: z.number(),
    jumpVelocity: z.number(),
    maxJumps: z.number().int().min(1),
    jumpCutFactor: z.number().min(0).max(1),
    maxFallSpeed: z.number(),
  }),
  attack: z.object({
    damage: z.number(),
    cooldown: z.number(),          // seconds → ticks at load
    projectileSpeed: z.number(),
    projectileRadius: z.number(),
    projectileLifetime: z.number(),// seconds → ticks at load
  }),
});
```

M4 adds `abilities: AbilityDef[]` (parameterized templates: projectile, melee arc, dash,
deployable, aoe) and `upgrades: UpgradeDef[]` — see §4.

## 3. Map schema (M2 scope)

ASCII tile rows: readable in diffs, editable in any text editor, trivially parsed. A
visual editor can come later and emit the same format.

```ts
const MapDef = z.object({
  id: z.string(),
  name: z.string(),
  tiles: z.array(z.string()),      // row strings, all equal length
  // legend: # = solid, . = empty, S = player spawn, D = dummy spawn
  shapes: z.array(ShapeDefSchema).optional(),   // geometry v2 (doc 06): rect/polygon/polyline/arc
  playerSpawns: z.array(Point).optional(),      // editor-authored; merge with tile markers
  dummySpawns: z.array(Point).optional(),
});
```

Tile `S`/`D` markers and the explicit spawn lists merge at load; the editor extracts
markers into movable spawn objects and always exports the explicit lists. The entities
milestone extends the format with an `entities` section beside `tiles`/`shapes`
(doc 07 §2) — every placeable is structured data with parameters and wiring.

## 4. Upgrade & status-effect model (M4, designed now)

The original's core trick (analysis §4.2), as a schema:

```ts
const StatModifier = z.object({
  stat: z.string(),                       // path into stats, e.g. "moveSpeed"
  op: z.enum(["add", "mul"]),
  value: z.number(),
});

const UpgradeDef = z.object({
  id: z.string(), name: z.string(), cost: z.number(),
  row: z.string(),                        // shop row = which ability it modifies
  modifiers: z.array(StatModifier),
});

const StatusEffectDef = z.object({
  id: z.string(),
  duration: z.number(),                   // seconds
  modifiers: z.array(StatModifier),       // e.g. slow = mul moveSpeed 0.6
  tickDamage: z.number().optional(),      // DoT
});
```

Effective stats are computed per tick: baseline → apply all `add` → apply all `mul`.
A status effect is the same machinery with a timer — exactly the original's design.

## 5. Package layout

```
packages/content/
├── src/schemas.ts        # zod schemas + inferred TS types
├── src/index.ts          # loadContent(): parse, convert units, freeze, export ContentIndex
├── characters/nova.json
└── maps/testing-grounds.json
```

`ContentIndex` (typed lookup: `characters[id]`, `maps[id]`) is the object handed to
`sim`'s `step`/`createState`. Invalid content fails loudly at startup with zod's error
path — never at runtime mid-match.
