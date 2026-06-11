import { buildMapFromDef, type EntityDef, type MapDef, MapDefSchema } from "@cosmonauts/content";
import { DUMMY_HEIGHT, type MapData, type ShapeDef } from "@cosmonauts/sim";

/**
 * The editor's document: the authoring-format map (doc 07 §2 geometry subset).
 * Tile S/D markers are extracted into the explicit spawn lists on load so they
 * become movable objects; exported JSON always uses the explicit lists.
 */
export interface MapDoc {
  id: string;
  name: string;
  tiles: string[];
  shapes: ShapeDef[];
  entities: EntityDef[];
  playerSpawns: [number, number, "RED" | "BLU"][];
  dummySpawns: [number, number][];
}

export function docFromDef(def: MapDef): MapDoc {
  const playerSpawns: [number, number, "RED" | "BLU"][] = (def.playerSpawns ?? []).map(
    ([x, y, team]) => [x, y, team],
  );
  const dummySpawns: [number, number][] = (def.dummySpawns ?? []).map(([x, y]) => [x, y]);
  const tiles = def.tiles.map((row, y) => {
    let out = "";
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "S") {
        playerSpawns.push([x + 0.5, y + 0.5, "RED"]);
        out += ".";
      } else if (ch === "D") {
        dummySpawns.push([x + 0.5, y + 1 - DUMMY_HEIGHT / 2]);
        out += ".";
      } else {
        out += ch;
      }
    }
    return out;
  });
  return {
    id: def.id,
    name: def.name,
    tiles,
    shapes: structuredClone(def.shapes ?? []),
    entities: structuredClone(def.entities ?? []),
    playerSpawns,
    dummySpawns,
  };
}

export function docToDef(doc: MapDoc): MapDef {
  return {
    id: doc.id,
    name: doc.name,
    tiles: [...doc.tiles],
    shapes: structuredClone(doc.shapes),
    entities: structuredClone(doc.entities),
    playerSpawns: structuredClone(doc.playerSpawns),
    dummySpawns: structuredClone(doc.dummySpawns),
  };
}

export function compileDoc(doc: MapDoc): MapData {
  return buildMapFromDef(docToDef(doc));
}

export function blankDoc(width = 500, height = 300, id?: string): MapDoc {
  const tiles: string[] = [];
  for (let y = 0; y < height; y++) {
    tiles.push(".".repeat(width));
  }
  return {
    id: id ?? "custom-map",
    name: "Custom Map",
    tiles,
    shapes: [
      {
        id: "ground",
        kind: "polygon",
        points: [
          [0, height - 2],
          [width, height - 2],
          [width, height],
          [0, height],
        ],
        solidity: "solid",
      },
    ],
    entities: [],
    playerSpawns: [[width / 2, height - 3, "RED"]],
    dummySpawns: [],
  };
}

export function getCustomMaps(): { id: string; name: string }[] {
  const maps: { id: string; name: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const doc = JSON.parse(raw);
          maps.push({ id: doc.id, name: doc.name });
        }
      } catch {}
    }
  }
  return maps;
}

const STORAGE_PREFIX = "cosmonauts.editor.mapdoc.";

export function saveToStorage(doc: MapDoc): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${doc.id}`, JSON.stringify(docToDef(doc)));
    localStorage.setItem("cosmonauts.editor.lastMapId", doc.id);
  } catch {
    // Storage full or unavailable — autosave is best-effort.
  }
}

export function loadFromStorage(mapId: string): MapDoc | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${mapId}`);
    if (raw === null) return null;
    return docFromDef(MapDefSchema.parse(JSON.parse(raw)));
  } catch {
    return null; // corrupt or outdated autosave — fall back to shipped content
  }
}

export function clearStorage(mapId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${mapId}`);
  } catch {
    // ignore
  }
}

/** Parse user-provided JSON (import); throws with a readable message. */
export function docFromJson(text: string): MapDoc {
  return docFromDef(MapDefSchema.parse(JSON.parse(text)));
}
