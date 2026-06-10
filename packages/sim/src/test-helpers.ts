import type { CharacterData, ContentIndex, MapData } from "./content-types";
import type { ShapeDef } from "./geometry";
import { NEUTRAL_INPUT, type PlayerInput } from "./input";
import { buildMap } from "./map";
import { createState, type GameState } from "./state";
import { type InputMap, step } from "./step";

export function makeCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    id: "test",
    name: "Test Naut",
    color: "#ffffff",
    hitbox: { w: 0.8, h: 1.6 },
    stats: {
      maxHealth: 100,
      moveSpeed: 8,
      groundAccel: 60,
      airAccel: 35,
      gravity: 38,
      jumpVelocity: 14.5,
      maxJumps: 2,
      jumpCutFactor: 0.45,
      maxFallSpeed: 16,
    },
    attack: {
      damage: 10,
      cooldownTicks: 15,
      projectileSpeed: 22,
      projectileRadius: 0.25,
      lifetimeTicks: 54,
    },
    ...overrides,
  };
}

export interface World {
  state: GameState;
  content: ContentIndex;
  map: MapData;
}

export function makeWorld(rows: string[], shapes: ShapeDef[] = []): World {
  const map = buildMap("test-map", "Test Map", rows, shapes);
  const character = makeCharacter();
  const content: ContentIndex = {
    characters: { [character.id]: character },
    maps: { [map.id]: map },
  };
  const state = createState(map, [{ playerId: 1, characterId: character.id }], content);
  return { state, content, map };
}

export function input(partial: Partial<PlayerInput> = {}): InputMap {
  return { 1: { ...NEUTRAL_INPUT, ...partial } };
}

export function run(world: World, ticks: number, inputs: InputMap = {}): void {
  for (let i = 0; i < ticks; i++) step(world.state, inputs, world.content);
}

export function player(world: World) {
  const p = world.state.players[0];
  if (p === undefined) throw new Error("world has no player");
  return p;
}

export const ARENA = [
  "##########",
  "#........#",
  "#........#",
  "#........#",
  "#........#",
  "#S.......#",
  "##########",
];
