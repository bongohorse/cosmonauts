import type { ContentIndex, GameState, MapData, Vec2 } from "@cosmonauts/sim";
import { DUMMY_HEIGHT, DUMMY_WIDTH, isSolid } from "@cosmonauts/sim";
import { type Application, Container, Graphics } from "pixi.js";

export const TILE_PX = 40;

const COLORS = {
  tile: 0x2c3354,
  tileEdge: 0x3d4570,
  dummy: 0xff5d73,
  dummyDead: 0x4a4f6e,
  projectile: 0xffd166,
  healthBack: 0x222741,
  health: 0x66ff8c,
  hitbox: 0xff2bd6, // must clash with every entity color — it outlines them
};

/**
 * Draws interpolated sim states with Pixi placeholder primitives (doc 04 §2 era:
 * the rectangle IS the hitbox). Never mutates sim state.
 */
export class Renderer {
  private world = new Container();
  private tileLayer = new Graphics();
  private entityLayer = new Graphics();
  private debugLayer = new Graphics();
  /** Editor overlay: drawn above everything, cleared by its owner. */
  readonly editorLayer = new Graphics();
  showHitboxes = false;
  /** When set (edit mode), replaces the follow-camera. Scale applies to the world. */
  cameraOverride: { x: number; y: number; scale: number } | null = null;

  constructor(
    private app: Application,
    private map: MapData,
    private content: ContentIndex,
  ) {
    this.world.addChild(this.tileLayer, this.entityLayer, this.debugLayer, this.editorLayer);
    app.stage.addChild(this.world);
    this.drawTiles();
  }

  get canvasElement(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /** Swap the static geometry (tiles + shapes) — used on every editor doc change. */
  setMap(map: MapData): void {
    this.map = map;
    this.tileLayer.clear();
    this.drawTiles();
  }

  clearEntities(): void {
    this.entityLayer.clear();
    this.debugLayer.clear();
  }

  private drawTiles(): void {
    const g = this.tileLayer;
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
    this.drawShapes(g);
  }

  /** Geometry-v2 shapes: filled polygons; open chains (glass, curves) as strokes. */
  private drawShapes(g: Graphics): void {
    for (const shape of this.map.shapes) {
      const flat = shape.points.flatMap(([x, y]) => [x * TILE_PX, y * TILE_PX]);
      if (flat.length < 4) continue;
      const tint = shape.tint !== undefined ? Number.parseInt(shape.tint.slice(1), 16) : undefined;
      const glass = shape.solidity === "glass";
      const color = tint ?? (glass ? 0x9fe8ff : COLORS.tile);

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

  render(prev: GameState, curr: GameState, alpha: number): void {
    const g = this.entityLayer;
    g.clear();
    this.debugLayer.clear();

    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const prevPlayers = new Map(prev.players.map((p) => [p.id, p]));
    const prevProjectiles = new Map(prev.projectiles.map((p) => [p.id, p]));

    for (const d of curr.dummies) {
      const hw = (DUMMY_WIDTH / 2) * TILE_PX;
      const hh = (DUMMY_HEIGHT / 2) * TILE_PX;
      const cx = d.pos.x * TILE_PX;
      const cy = d.pos.y * TILE_PX;
      const alive = d.health > 0;
      g.rect(cx - hw, cy - hh, hw * 2, hh * 2).fill(alive ? COLORS.dummy : COLORS.dummyDead);
      if (alive) {
        this.drawHealthBar(cx, cy - hh - 8, DUMMY_WIDTH * TILE_PX, d.health / d.maxHealth);
      }
    }

    for (const p of curr.players) {
      const char = this.content.characters[p.characterId];
      if (char === undefined) continue;
      const before = prevPlayers.get(p.id) ?? p;
      const x = lerp(before.pos.x, p.pos.x) * TILE_PX;
      const y = lerp(before.pos.y, p.pos.y) * TILE_PX;
      const hw = (char.hitbox.w / 2) * TILE_PX;
      const hh = (char.hitbox.h / 2) * TILE_PX;
      const color = Number.parseInt(char.color.slice(1), 16);
      g.rect(x - hw, y - hh, hw * 2, hh * 2).fill(color);
      // An "eye" marks facing — the placeholder's only anatomy.
      g.circle(x + p.facing * hw * 0.45, y - hh * 0.45, 3.5).fill(0x10142a);

      if (this.showHitboxes) {
        this.debugLayer
          .rect(x - hw, y - hh, hw * 2, hh * 2)
          .stroke({ color: COLORS.hitbox, width: 1 });
      }
    }

    for (const pr of curr.projectiles) {
      const before = prevProjectiles.get(pr.id) ?? pr;
      const x = lerp(before.pos.x, pr.pos.x) * TILE_PX;
      const y = lerp(before.pos.y, pr.pos.y) * TILE_PX;
      g.circle(x, y, pr.radius * TILE_PX).fill(COLORS.projectile);
    }

    this.updateCamera(curr, prev, alpha);
  }

  private drawHealthBar(cx: number, y: number, width: number, fraction: number): void {
    const g = this.entityLayer;
    g.rect(cx - width / 2, y, width, 4).fill(COLORS.healthBack);
    g.rect(cx - width / 2, y, width * Math.max(0, fraction), 4).fill(COLORS.health);
  }

  private updateCamera(curr: GameState, prev: GameState, alpha: number): void {
    if (this.applyCameraOverride()) return;
    const player = curr.players[0];
    if (player === undefined) return;
    const before = prev.players.find((p) => p.id === player.id) ?? player;
    const px = (before.pos.x + (player.pos.x - before.pos.x) * alpha) * TILE_PX;
    const py = (before.pos.y + (player.pos.y - before.pos.y) * alpha) * TILE_PX;

    const screenW = this.app.renderer.width;
    const screenH = this.app.renderer.height;
    const mapW = this.map.width * TILE_PX;
    const mapH = this.map.height * TILE_PX;

    const clampAxis = (target: number, screen: number, world: number): number => {
      if (world <= screen) return (screen - world) / 2; // map smaller than screen: center it
      return Math.min(0, Math.max(screen - world, screen / 2 - target));
    };
    this.world.x = clampAxis(px, screenW, mapW);
    this.world.y = clampAxis(py, screenH, mapH);
    this.world.scale.set(1);
  }

  /** Applies the override transform if set; returns whether it was applied. */
  applyCameraOverride(): boolean {
    if (this.cameraOverride === null) return false;
    this.world.x = this.cameraOverride.x;
    this.world.y = this.cameraOverride.y;
    this.world.scale.set(this.cameraOverride.scale);
    return true;
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    const scale = this.world.scale.x * TILE_PX;
    return { x: (sx - this.world.x) / scale, y: (sy - this.world.y) / scale };
  }
}
