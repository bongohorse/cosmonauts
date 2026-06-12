import type { ContentIndex, GameState, MapData } from "@cosmonauts/sim";
import type { Graphics } from "pixi.js";
import { COLORS, drawArrow, TILE_PX } from "./utils";

export class DebugRenderer {
  showHitboxes = false;
  showPaths = false;

  constructor(
    private g: Graphics,
    private map: MapData,
    private content: ContentIndex,
  ) {}

  setMap(map: MapData): void {
    this.map = map;
  }

  render(prev: GameState, curr: GameState, alpha: number): void {
    const g = this.g;
    g.clear();

    const lerp = (a: number, b: number) => a + (b - a) * alpha;

    if (this.showHitboxes) {
      const prevPlayers = new Map(prev.players.map((p) => [p.id, p]));
      for (const p of curr.players) {
        const char = this.content.characters[p.characterId];
        if (char === undefined) continue;
        const before = prevPlayers.get(p.id) ?? p;
        const x = lerp(before.pos.x, p.pos.x) * TILE_PX;
        const y = lerp(before.pos.y, p.pos.y) * TILE_PX;
        const hw = (char.hitbox.w / 2) * TILE_PX;
        const hh = (char.hitbox.h / 2) * TILE_PX;

        g.rect(x - hw, y - hh, hw * 2, hh * 2).stroke({
          color: COLORS.hitbox,
          width: 1,
          pixelLine: true,
        });
      }
    }

    if (this.showPaths) {
      const prevDroids = new Map(prev.droids?.map((p) => [p.id, p]) ?? []);

      // Draw all path node links
      for (const data of this.map.entities) {
        if (data.type === "droidSpawner" || data.type === "pathNode") {
          const startX = data.pos.x * TILE_PX;
          const startY = data.pos.y * TILE_PX;

          const drawLinkTo = (targetId: unknown, color: number) => {
            if (typeof targetId === "string" && targetId !== "") {
              const target = this.map.entities.find((e) => e.id === targetId);
              if (target) {
                const tx = target.pos.x * TILE_PX;
                const ty = target.pos.y * TILE_PX;
                const dx = tx - startX;
                const dy = ty - startY;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                  drawArrow(g, startX, startY, dx / dist, dy / dist, dist, color, 3);
                }
              }
            }
          };

          if (data.type === "droidSpawner") {
            drawLinkTo(data.params.pathId, 0xffff00);
          } else {
            drawLinkTo(data.params.nextId, 0x00ffff);
            drawLinkTo(data.params.branchId, 0xff00ff);
          }
        }
      }

      // Draw lines from droids to their current path target
      if (curr.droids) {
        for (const d of curr.droids) {
          if (d.pathTargetId) {
            const target = this.map.entities.find((e) => e.id === d.pathTargetId);
            if (target) {
              const before = prevDroids.get(d.id) ?? d;
              const dx = lerp(before.pos.x, d.pos.x) * TILE_PX;
              const dy = lerp(before.pos.y, d.pos.y) * TILE_PX;
              const tx = target.pos.x * TILE_PX;
              const ty = target.pos.y * TILE_PX;

              const color = d.team === "RED" ? 0xff4d5e : 0x4d7dff;
              g.moveTo(dx, dy).lineTo(tx, ty).stroke({ color, width: 2, alpha: 0.5 });
            }
          }
        }
      }
    }
  }
}
