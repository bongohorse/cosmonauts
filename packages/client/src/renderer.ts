import type { ContentIndex, GameState, MapData, Vec2 } from "@cosmonauts/sim";
import { type Application, Container, Graphics } from "pixi.js";
import { DebugRenderer } from "./renderers/debugRenderer";
import { EntityRenderer } from "./renderers/entityRenderer";
import { TileRenderer } from "./renderers/tileRenderer";
import { TILE_PX } from "./renderers/utils";

/**
 * Draws interpolated sim states with Pixi placeholder primitives (doc 04 §2 era:
 * the rectangle IS the hitbox). Never mutates sim state.
 */
export class Renderer {
  readonly world = new Container({ isRenderGroup: true });
  private tileLayer = new Graphics();
  private entityLayer = new Graphics();
  private debugLayer = new Graphics();
  /** Editor overlay: drawn above everything, cleared by its owner. */
  readonly editorLayer = new Graphics();

  private tileRenderer: TileRenderer;
  private entityRenderer: EntityRenderer;
  private debugRenderer: DebugRenderer;

  /** When set (edit mode), replaces the follow-camera. Scale applies to the world. */
  cameraOverride: { x: number; y: number; scale: number } | null = null;

  constructor(
    private app: Application,
    private map: MapData,
    private content: ContentIndex,
  ) {
    this.world.addChild(this.tileLayer, this.entityLayer, this.debugLayer, this.editorLayer);
    app.stage.addChild(this.world);

    this.tileRenderer = new TileRenderer(this.tileLayer, this.map);
    this.entityRenderer = new EntityRenderer(this.entityLayer, this.map, this.content);
    this.debugRenderer = new DebugRenderer(this.debugLayer, this.map, this.content);

    this.tileRenderer.setMap(this.map);
  }

  get canvasElement(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get showHitboxes(): boolean {
    return this.debugRenderer.showHitboxes;
  }
  set showHitboxes(value: boolean) {
    this.debugRenderer.showHitboxes = value;
  }

  get showPaths(): boolean {
    return this.debugRenderer.showPaths;
  }
  set showPaths(value: boolean) {
    this.debugRenderer.showPaths = value;
  }

  /** Swap the static geometry (tiles + shapes) — used on every editor doc change. */
  setMap(map: MapData): void {
    this.map = map;
    this.tileRenderer.setMap(map);
    this.entityRenderer.setMap(map);
    this.debugRenderer.setMap(map);
  }

  clearEntities(): void {
    this.entityLayer.clear();
    this.debugLayer.clear();
  }

  render(prev: GameState, curr: GameState, alpha: number): void {
    this.entityRenderer.render(prev, curr, alpha);
    this.debugRenderer.render(prev, curr, alpha);
    this.updateCamera(curr, prev, alpha);
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

    const clampAxis = (target: number, screen: number): number => {
      return screen / 2 - target;
    };
    this.world.x = clampAxis(px, screenW);
    this.world.y = clampAxis(py, screenH);
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
