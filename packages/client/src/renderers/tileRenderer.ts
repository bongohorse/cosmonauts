import type { MapData } from "@cosmonauts/sim";
import { isSolid } from "@cosmonauts/sim";
import { Color, type Graphics } from "pixi.js";
import { COLORS, TILE_PX } from "./utils";

export class TileRenderer {
  constructor(
    private g: Graphics,
    private map: MapData,
  ) {}

  setMap(map: MapData): void {
    this.map = map;
    this.g.clear();
    this.drawTiles();
  }

  private drawTiles(): void {
    const g = this.g;
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!isSolid(this.map, x, y)) continue;
        g.rect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX).fill(COLORS.tile);
        // Light top edge where a tile borders open air — reads as ground.
        if (!isSolid(this.map, x, y - 1)) {
          g.rect(x * TILE_PX, y * TILE_PX, TILE_PX, 3).fill(COLORS.tileEdge);
        }
      }
    }
    this.drawShapes();
  }

  /** Geometry-v2 shapes: filled polygons; open chains (glass, curves) as strokes. */
  private drawShapes(): void {
    const g = this.g;
    for (const shape of this.map.shapes) {
      const flat = shape.points.flatMap(([x, y]) => [x * TILE_PX, y * TILE_PX]);
      if (flat.length < 4) continue;
      const tint =
        shape.tint !== undefined ? Color.shared.setValue(shape.tint).toNumber() : undefined;
      const glass = shape.solidity === "glass";
      // Team color convention (doc 07 §5): Team A is red, Team B is blue.
      const base =
        shape.solidity === "teamRED"
          ? 0xff4d5e
          : shape.solidity === "teamBLU"
            ? 0x4d7dff
            : glass
              ? 0x9fe8ff
              : COLORS.tile;
      const color = tint ?? base;

      if (shape.closed) {
        g.poly(flat).fill(color);
        g.poly(flat).stroke({ color: COLORS.tileEdge, width: 2 });
      } else {
        g.moveTo(flat[0] ?? 0, flat[1] ?? 0);
        for (let i = 2; i < flat.length; i += 2) {
          g.lineTo(flat[i] ?? 0, flat[i + 1] ?? 0);
        }
        g.stroke({ color, width: glass ? 5 : 8, alpha: glass ? 0.55 : 1, cap: "round" });
      }
    }
  }
}
