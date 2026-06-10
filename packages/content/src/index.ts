import {
  buildMap,
  type CharacterData,
  type ContentIndex,
  type MapData,
  TICK_RATE,
} from "@cosmonauts/sim";
import novaJson from "../characters/nova.json";
import testingGroundsJson from "../maps/testing-grounds.json";
import { toEntityData } from "./entities";
import { type CharacterDef, CharacterDefSchema, type MapDef, MapDefSchema } from "./schemas";

const characterSources: unknown[] = [novaJson];
const mapSources: unknown[] = [testingGroundsJson];

function secondsToTicks(seconds: number): number {
  return Math.max(1, Math.round(seconds * TICK_RATE));
}

function toCharacterData(def: CharacterDef): CharacterData {
  return {
    id: def.id,
    name: def.name,
    color: def.color,
    hitbox: def.hitbox,
    stats: def.stats,
    attack: {
      damage: def.attack.damage,
      cooldownTicks: secondsToTicks(def.attack.cooldown),
      projectileSpeed: def.attack.projectileSpeed,
      projectileRadius: def.attack.projectileRadius,
      lifetimeTicks: secondsToTicks(def.attack.projectileLifetime),
    },
  };
}

/**
 * Parse and validate all content. Throws (with a zod error path) on invalid
 * content — at startup, never mid-match (doc 05 §1).
 */
export function loadContent(): ContentIndex {
  const characters: Record<string, CharacterData> = {};
  for (const source of characterSources) {
    const def = CharacterDefSchema.parse(source);
    if (characters[def.id]) throw new Error(`duplicate character id "${def.id}"`);
    characters[def.id] = toCharacterData(def);
  }

  const maps: Record<string, MapData> = {};
  for (const source of mapSources) {
    const def = MapDefSchema.parse(source);
    if (maps[def.id]) throw new Error(`duplicate map id "${def.id}"`);
    maps[def.id] = buildMapFromDef(def);
  }

  return { characters, maps };
}

/** Compile a validated MapDef (e.g. an editor document) into sim MapData. */
export function buildMapFromDef(def: MapDef): MapData {
  return buildMap(
    def.id,
    def.name,
    def.tiles,
    def.shapes ?? [],
    {
      players: (def.playerSpawns ?? []).map(([x, y]) => ({ x, y })),
      dummies: (def.dummySpawns ?? []).map(([x, y]) => ({ x, y })),
    },
    (def.entities ?? []).map(toEntityData),
  );
}

/** Raw, validated map definitions — the editor loads these as documents. */
export function loadMapDefs(): MapDef[] {
  return mapSources.map((source) => MapDefSchema.parse(source));
}

export {
  defaultParams,
  ENTITY_TYPES,
  type EntityDef,
  EntityDefSchema,
  type EntityTypeSpec,
  entityTypeSpec,
  type ParamSpec,
  toEntityData,
} from "./entities";
export type { CharacterDef, MapDef } from "./schemas";
export { CharacterDefSchema, MapDefSchema } from "./schemas";
