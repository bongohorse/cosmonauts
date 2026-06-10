import { DUMMY_HEIGHT } from "./constants";
import type { MapData } from "./content-types";
import {
  compileShape,
  compileTiles,
  type SegmentData,
  type ShapeData,
  type ShapeDef,
} from "./geometry";

export interface ExplicitSpawns {
  players?: { x: number; y: number }[];
  dummies?: { x: number; y: number }[];
}

/**
 * Build a MapData from ASCII tile rows plus optional shapes (docs 05 §3, 06, 07 §2).
 * Tile legend: '#' solid, '.' empty, 'S' player spawn, 'D' dummy spawn.
 * Explicit spawn lists (editor-authored) merge with tile markers.
 * Tiles and shapes both compile to the segment list the sim collides against.
 */
export function buildMap(
  id: string,
  name: string,
  rows: string[],
  shapeDefs: ShapeDef[] = [],
  spawns: ExplicitSpawns = {},
): MapData {
  const height = rows.length;
  const firstRow = rows[0];
  if (firstRow === undefined) throw new Error(`map "${id}": no rows`);
  const width = firstRow.length;

  const solid: boolean[] = new Array(width * height).fill(false);
  const playerSpawns: MapData["playerSpawns"] = [];
  const dummySpawns: MapData["dummySpawns"] = [];

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (row === undefined || row.length !== width) {
      throw new Error(`map "${id}": row ${y} has length ${row?.length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      switch (row[x]) {
        case "#":
          solid[y * width + x] = true;
          break;
        case ".":
          break;
        case "S":
          playerSpawns.push({ x: x + 0.5, y: y + 0.5 });
          break;
        case "D":
          // Dummy bottom sits on the bottom edge of its marker tile.
          dummySpawns.push({ x: x + 0.5, y: y + 1 - DUMMY_HEIGHT / 2 });
          break;
        default:
          throw new Error(`map "${id}": unknown tile "${row[x]}" at ${x},${y}`);
      }
    }
  }

  for (const s of spawns.players ?? []) playerSpawns.push({ x: s.x, y: s.y });
  for (const s of spawns.dummies ?? []) dummySpawns.push({ x: s.x, y: s.y });
  if (playerSpawns.length === 0) throw new Error(`map "${id}": needs at least one player spawn`);

  const segments: SegmentData[] = [];
  const shapes: ShapeData[] = [];
  compileTiles(width, height, solid, segments);
  for (const def of shapeDefs) compileShape(def, segments, shapes);

  return { id, name, width, height, solid, segments, shapes, playerSpawns, dummySpawns };
}
