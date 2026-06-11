import { DUMMY_HEALTH } from "./constants";
import type { ContentIndex, MapData } from "./content-types";
import type { Vec2 } from "./math";

// structuredClone is a host API (browsers, Node 17+, workers) rather than an
// ECMAScript built-in, so lib "ES2023" has no type for it. The sim targets all
// of those hosts and none exclusively, hence this declaration instead of
// pulling in DOM or Node lib types.
declare function structuredClone<T>(value: T): T;

export type Team = "RED" | "BLU";

export interface PlayerState {
  id: number;
  characterId: string;
  team: Team;
  pos: Vec2; // capsule/hitbox center, tile units
  vel: Vec2; // tiles/s
  facing: 1 | -1;
  grounded: boolean;
  groundNX: number; // contact normal while grounded (0,0 airborne)
  groundNY: number;
  groundShapeId: string; // shape under our feet ("" airborne)
  groundGlass: boolean; // standing on a glass platform
  dropShapeId: string; // glass collider being dropped through ("" none)
  dropTicks: number; // remaining ignore ticks for dropShapeId
  jumpsUsed: number;
  jumpCutApplied: boolean;
  attackCooldown: number; // ticks remaining
  health: number;
  flux: number;
  upgrades: {
    speed: number;
    cooldown: number;
    damage: number;
    jump: number;
  };
}

export interface ProjectileState {
  id: number;
  ownerId?: number; // optional, for assigning flux
  team: Team;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  damage: number;
  ticksLeft: number;
}

export interface LivePickupState {
  id: number;
  kind: "flux" | "health";
  pos: Vec2;
  vel: Vec2;
  amount: number;
  homingPlayerId?: number;
  ticksLeft: number;
}

/**
 * Per-entity dynamic state (doc 07 §5), index-aligned with `map.entities`.
 * Static params stay in content; only what changes at runtime lives here.
 */
export interface MapEntityState {
  id: string;
  enabled: boolean;
  cooldown: number; // ticks until this entity may trigger again
  active?: boolean;
  triggered?: boolean;
  timerElapsed?: number;
  health?: number;
  dead?: boolean;
  visionRED?: boolean; // True if RED team has vision of this hideZone
  visionBLU?: boolean; // True if BLU team has vision of this hideZone
}

export interface DummyState {
  id: number;
  pos: Vec2;
  health: number;
  maxHealth: number;
  respawnTicks: number;
}

export interface DroidState {
  id: number;
  type: string;
  team: Team;
  pos: Vec2;
  vel: Vec2;
  health: number;
  maxHealth: number;
  facing: 1 | -1;
  grounded: boolean;
  groundShapeId: string;
  attackCooldown: number;
}

export interface CreepState {
  id: number;
  pos: Vec2;
  vel: Vec2;
  health: number;
  maxHealth: number;
  facing: 1 | -1;
  grounded: boolean;
  groundShapeId: string;
  fleeTicks: number; // Ticks remaining in flee mode
  origin: Vec2; // Where the creep den is, to bound their pacing
  denId: string; // ID of the creepDen that spawned this creep
}

/** Plain JSON-compatible data, by design (doc 02 §1). No classes, no Maps. */
export interface GameState {
  tick: number;
  rng: number;
  nextEntityId: number;
  mapId: string;
  players: PlayerState[];
  projectiles: ProjectileState[];
  dummies: DummyState[];
  mapEntities: MapEntityState[]; // index-aligned with map.entities
  pickups: LivePickupState[];
  droids: DroidState[];
  creeps: CreepState[];
  gameOver?: { winner: Team; ticksLeft: number };
}

export interface SpawnSpec {
  playerId: number;
  characterId: string;
  team?: Team; // default "RED"
}

/** Where the i-th player spawns: feet on the bottom edge of the spawn tile. */
export function playerSpawnPos(map: MapData, team: Team, index: number, hitboxH: number): Vec2 {
  const teamSpawns = map.playerSpawns.filter((s) => s.team === team);
  const spawns = teamSpawns.length > 0 ? teamSpawns : map.playerSpawns;
  const spawn = spawns[index % spawns.length];
  if (spawn === undefined) throw new Error(`map "${map.id}" has no player spawns`);
  return { x: spawn.x, y: spawn.y + 0.5 - hitboxH / 2 };
}

export function createState(map: MapData, spawns: SpawnSpec[], content: ContentIndex): GameState {
  const state: GameState = {
    tick: 0,
    rng: 1,
    nextEntityId: 1,
    mapId: map.id,
    players: [],
    projectiles: [],
    dummies: [],
    mapEntities: map.entities.map((e) => {
      let health: number | undefined;
      if (e.type === "turret" || e.type === "core") {
        health = typeof e.params.health === "number" ? e.params.health : 1000;
      }
      return {
        id: e.id,
        enabled: e.enabled,
        cooldown: 0,
        health,
        dead: false,
      };
    }),
    pickups: [],
    droids: [],
    creeps: [],
  };

  for (let i = 0; i < spawns.length; i++) {
    const spec = spawns[i];
    if (spec === undefined) continue;
    const char = content.characters[spec.characterId];
    if (char === undefined) throw new Error(`unknown character "${spec.characterId}"`);
    state.players.push({
      id: spec.playerId,
      characterId: spec.characterId,
      team: spec.team ?? "RED",
      pos: playerSpawnPos(map, spec.team ?? "RED", i, char.hitbox.h),
      vel: { x: 0, y: 0 },
      facing: 1,
      grounded: false,
      groundNX: 0,
      groundNY: 0,
      groundShapeId: "",
      groundGlass: false,
      dropShapeId: "",
      dropTicks: 0,
      jumpsUsed: 0,
      jumpCutApplied: false,
      attackCooldown: 0,
      health: char.stats.maxHealth,
      flux: 0,
      upgrades: {
        speed: 0,
        cooldown: 0,
        damage: 0,
        jump: 0,
      },
    });
  }

  for (const spawn of map.dummySpawns) {
    state.dummies.push({
      id: state.nextEntityId++,
      pos: { x: spawn.x, y: spawn.y },
      health: DUMMY_HEALTH,
      maxHealth: DUMMY_HEALTH,
      respawnTicks: 0,
    });
  }

  return state;
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}
