import { entityTypeSpec } from "@cosmonauts/content";
import type { ContentIndex, GameState, MapData, Vec2 } from "@cosmonauts/sim";
import { DUMMY_HEIGHT, DUMMY_WIDTH, isSolid } from "@cosmonauts/sim";
import { type Application, Color, Container, Graphics } from "pixi.js";

function getRotatedRectPoints(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotationDeg: number,
): number[] {
  const hw = w / 2;
  const hh = h / 2;
  const r = rotationDeg * (Math.PI / 180);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const corner = (x: number, y: number): [number, number] => [
    cx + x * c - y * s,
    cy + x * s + y * c,
  ];
  return [...corner(-hw, -hh), ...corner(hw, -hh), ...corner(hw, hh), ...corner(-hw, hh)];
}

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
  readonly world = new Container({ isRenderGroup: true });
  private tileLayer = new Graphics();
  private entityLayer = new Graphics();
  private debugLayer = new Graphics();
  /** Editor overlay: drawn above everything, cleared by its owner. */
  readonly editorLayer = new Graphics();
  showHitboxes = false;
  showPaths = false;
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

  render(prev: GameState, curr: GameState, alpha: number): void {
    const g = this.entityLayer;
    g.clear();
    this.debugLayer.clear();

    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const prevPlayers = new Map(prev.players.map((p) => [p.id, p]));
    const prevProjectiles = new Map(prev.projectiles.map((p) => [p.id, p]));
    const prevPickups = new Map(prev.pickups.map((p) => [p.id, p]));
    const prevDroids = new Map(prev.droids?.map((p) => [p.id, p]) ?? []);

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

    if (curr.droids) {
      for (const d of curr.droids) {
        const before = prevDroids.get(d.id) ?? d;
        const x = lerp(before.pos.x, d.pos.x) * TILE_PX;
        const y = lerp(before.pos.y, d.pos.y) * TILE_PX;
        const hw = 0.4 * TILE_PX;
        const hh = 0.45 * TILE_PX;
        const color = d.team === "RED" ? 0xff4d5e : 0x4d7dff;
        g.rect(x - hw, y - hh, hw * 2, hh * 2).fill(color);
        g.circle(x + d.facing * hw * 0.45, y - hh * 0.45, 3.5).fill(0x10142a);
        if (d.health > 0) {
          this.drawHealthBar(x, y - hh - 8, 0.8 * TILE_PX, d.health / d.maxHealth);
        }
      }
    }

    if (curr.creeps) {
      const prevCreeps = new Map(prev.creeps?.map((c) => [c.id, c]) ?? []);
      for (const c of curr.creeps) {
        const before = prevCreeps.get(c.id) ?? c;
        const x = lerp(before.pos.x, c.pos.x) * TILE_PX;
        const y = lerp(before.pos.y, c.pos.y) * TILE_PX;
        const hw = 0.4 * TILE_PX;
        const hh = 0.45 * TILE_PX;
        const color = 0x8b5a2b; // Brown-ish creep color
        g.rect(x - hw, y - hh, hw * 2, hh * 2).fill(color);
        g.circle(x + c.facing * hw * 0.45, y - hh * 0.45, 3.5).fill(0x10142a);
        if (c.health > 0) {
          this.drawHealthBar(x, y - hh - 8, 0.8 * TILE_PX, c.health / c.maxHealth);
        }
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
      const color =
        p.team === "RED"
          ? 0xff4444
          : p.team === "BLU"
            ? 0x4444ff
            : Color.shared.setValue(char.color).toNumber();
      g.rect(x - hw, y - hh, hw * 2, hh * 2).fill(color);
      // An "eye" marks facing — the placeholder's only anatomy.
      g.circle(x + p.facing * hw * 0.45, y - hh * 0.45, 3.5).fill(0x10142a);

      // Draw health bar above player
      this.drawHealthBar(x, y - hh - 8, char.hitbox.w * TILE_PX, p.health / char.stats.maxHealth);

      if (this.showHitboxes) {
        this.debugLayer
          .rect(x - hw, y - hh, hw * 2, hh * 2)
          .stroke({ color: COLORS.hitbox, width: 1, pixelLine: true });
      }
    }

    for (const pr of curr.projectiles) {
      const before = prevProjectiles.get(pr.id) ?? pr;
      const x = lerp(before.pos.x, pr.pos.x) * TILE_PX;
      const y = lerp(before.pos.y, pr.pos.y) * TILE_PX;
      g.circle(x, y, pr.radius * TILE_PX).fill(COLORS.projectile);
    }

    for (const pickup of curr.pickups) {
      const before = prevPickups.get(pickup.id) ?? pickup;
      const x = lerp(before.pos.x, pickup.pos.x) * TILE_PX;
      const y = lerp(before.pos.y, pickup.pos.y) * TILE_PX;
      const size = 0.25 * TILE_PX;
      if (pickup.kind === "flux") {
        const color = pickup.amount === 5 ? 0xffca28 : 0xd1d5db;
        g.poly([x, y - size, x + size, y, x, y + size, x - size, y])
          .fill(color)
          .stroke({ color: 0xffffff, width: 1 });
      } else {
        const radius = 0.25 * TILE_PX;
        g.circle(x, y, radius).fill(0x66ff8c).stroke({ color: 0xffffff, width: 1.5 });
        g.rect(x - 1, y - 3, 2, 6).fill(0xffffff);
        g.rect(x - 3, y - 1, 6, 2).fill(0xffffff);
      }
    }

    for (let i = 0; i < this.map.entities.length; i++) {
      const data = this.map.entities[i];
      const dyn = curr.mapEntities[i];
      if (data === undefined || dyn === undefined) continue;
      const x = data.pos.x * TILE_PX;
      const y = data.pos.y * TILE_PX;
      const hw = (data.size.w / 2) * TILE_PX;
      const hh = (data.size.h / 2) * TILE_PX;
      const spec = entityTypeSpec(data.type);
      const color = Color.shared.setValue(data.tint ?? spec?.color ?? "#ffffff").toNumber();

      let finalColor = color;
      if (data.type === "base") {
        const team = typeof data.params.team === "string" ? data.params.team : "RED";
        finalColor = team === "RED" || team === "A" ? 0xff4d5e : 0x4d7dff;
      }
      let alpha = dyn.enabled ? 0.4 : 0.15;
      let strokeAlpha = dyn.enabled ? 0.6 : 0.2;
      let strokeWidth = 1;

      if (data.type === "hideZone") {
        const myTeam = curr.players[0]?.team;
        let hasVision = false;
        if (myTeam === "RED" && dyn.visionRED) hasVision = true;
        if (myTeam === "BLU" && dyn.visionBLU) hasVision = true;

        alpha = hasVision ? 0.2 : 1.0;
        strokeAlpha = hasVision ? 0.4 : 1.0;
        finalColor = 0x1a1e29; // Very dark green/grey like bushes
      }

      if (data.type === "teamBarrier") {
        const team = typeof data.params.team === "string" ? data.params.team : "RED";
        if (dyn.enabled) {
          // RED is red, BLU is blue
          finalColor = team === "RED" || team === "A" ? 0xff4d5e : 0x4d7dff;
        } else {
          const downgradeTo =
            typeof data.params.downgradeTo === "string" ? data.params.downgradeTo : "gone";
          if (downgradeTo === "glass") {
            finalColor = 0x9fe8ff;
            alpha = 0.55;
            strokeAlpha = 0.8;
            strokeWidth = 2;
          } else {
            // gone
            alpha = 0.05;
            strokeAlpha = 0.1;
          }
        }
      }

      if (data.type === "fluxCube") {
        const denomStr =
          typeof data.params.denomination === "string" ? data.params.denomination : "1";
        const finalColor = denomStr === "5" ? 0xffca28 : 0xd1d5db;
        const size = Math.min(data.size.w, data.size.h) * 0.35 * TILE_PX;
        g.poly([x, y - size, x + size, y, x, y + size, x - size, y])
          .fill({ color: finalColor, alpha: alpha + 0.2 })
          .stroke({ color: 0xffffff, width: 1.5, alpha: strokeAlpha });
        continue;
      }

      if (data.type === "healthPickup") {
        const radius = Math.min(data.size.w, data.size.h) * 0.35 * TILE_PX;
        g.circle(x, y, radius)
          .fill({ color: 0x66ff8c, alpha: alpha + 0.2 })
          .stroke({ color: 0xffffff, width: 1.5, alpha: strokeAlpha });
        g.rect(x - 1, y - 3, 2, 6).fill({ color: 0xffffff, alpha: dyn.enabled ? 1.0 : 0.4 });
        g.rect(x - 3, y - 1, 6, 2).fill({ color: 0xffffff, alpha: dyn.enabled ? 1.0 : 0.4 });
        continue;
      }

      if (data.tint) {
        finalColor = Color.shared.setValue(data.tint).toNumber();
      }

      const rotation = typeof data.params.rotation === "number" ? data.params.rotation : 0;
      if (rotation !== 0) {
        const polyPoints = getRotatedRectPoints(
          x,
          y,
          data.size.w * TILE_PX,
          data.size.h * TILE_PX,
          rotation,
        );
        g.poly(polyPoints).fill({
          color: finalColor,
          alpha,
        });
        g.poly(polyPoints).stroke({
          color: finalColor,
          width: strokeWidth,
          alpha: strokeAlpha,
        });
      } else {
        g.rect(x - hw, y - hh, hw * 2, hh * 2).fill({
          color: finalColor,
          alpha,
        });
        g.rect(x - hw, y - hh, hw * 2, hh * 2).stroke({
          color: finalColor,
          width: strokeWidth,
          alpha: strokeAlpha,
        });
      }

      // Draw team color coding indicator if applicable (RED or BLU, also fallback to A/B)
      const teamVal = data.params?.team;
      if (teamVal === "RED" || teamVal === "BLU" || teamVal === "A" || teamVal === "B") {
        const teamColor = teamVal === "RED" || teamVal === "A" ? 0xff4d5e : 0x4d7dff;
        g.circle(x, y, 5).fill(teamColor).stroke({ color: 0xffffff, width: 1.5 });
      }

      // Icons
      if (data.type === "base") {
        g.rect(x - 6, y - 2, 12, 4).fill(0xffffff);
        g.rect(x - 2, y - 6, 4, 12).fill(0xffffff);
      } else if (data.type === "droidSpawner") {
        g.rect(x - 8, y - 5, 16, 10).stroke({ color: 0xffffff, width: 2 });
        g.circle(x - 3, y, 2).fill(0xffffff);
        g.circle(x + 3, y, 2).fill(0xffffff);
      } else if (data.type === "core") {
        g.poly([x, y - 10, x + 8, y, x, y + 10, x - 8, y]).fill(0xffffff);
      } else if (data.type === "fireField") {
        if (dyn.active) {
          // Fire phase - fast blinking bright red/orange
          const fastBlink = Math.floor(curr.tick / 4) % 2 === 0;
          g.rect(x - data.size.w / 2, y - data.size.h / 2, data.size.w, data.size.h).fill({
            color: fastBlink ? 0xff3300 : 0xff7700,
            alpha: 0.8,
          });
        } else if (dyn.triggered) {
          // Warning phase - blinking yellow/orange
          const blink = Math.floor(curr.tick / 15) % 2 === 0;
          g.rect(x - data.size.w / 2, y - data.size.h / 2, data.size.w, data.size.h).fill({
            color: blink ? 0xffaa00 : 0xaa5500,
            alpha: 0.4,
          });
        } else {
          // Rest phase - muted slightly visible area
          g.rect(x - data.size.w / 2, y - data.size.h / 2, data.size.w, data.size.h).fill({
            color: 0xffaa00,
            alpha: 0.1,
          });
        }
      } else if (data.type === "turret" && !dyn.dead) {
        // Draw rotatable cannon
        const team = teamVal === "RED" ? "RED" : "BLU";
        const range = typeof data.params.range === "number" ? data.params.range : 15;
        let targetPos = null;
        let minDist = range * range;

        for (const p of curr.players) {
          if (p.health <= 0 || p.team === team) continue;
          const dist2 = (p.pos.x - data.pos.x) ** 2 + (p.pos.y - data.pos.y) ** 2;
          if (dist2 < minDist) {
            minDist = dist2;
            targetPos = p.pos;
          }
        }
        if (curr.droids) {
          for (const d of curr.droids) {
            if (d.health <= 0 || d.team === team) continue;
            const dist2 = (d.pos.x - data.pos.x) ** 2 + (d.pos.y - data.pos.y) ** 2;
            if (dist2 < minDist) {
              minDist = dist2;
              targetPos = d.pos;
            }
          }
        }

        const startY = y - hh;
        let dx = team === "RED" ? 1 : -1;
        let dy = 0;
        if (targetPos) {
          dx = targetPos.x - data.pos.x;
          dy = targetPos.y - (data.pos.y - data.size.h / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            dx /= dist;
            dy /= dist;
          }
        }
        g.moveTo(x, startY)
          .lineTo(x + dx * 20, startY + dy * 20)
          .stroke({ color: 0xa0a0a0, width: 6, cap: "round" });
        g.circle(x, startY, 6).fill(0x555555);
      }

      // Draw health bar for destructible entities (turret, core)
      if (
        dyn.health !== undefined &&
        (data.type === "turret" || data.type === "core") &&
        !dyn.dead
      ) {
        const maxHealth = typeof data.params.health === "number" ? data.params.health : 1000;
        this.drawHealthBar(x, y - hh - 12, data.size.w * TILE_PX, dyn.health / maxHealth);
      }

      // Draw orientation arrows for jumper and forceField
      if (data.type === "jumper") {
        const direction = typeof data.params.direction === "number" ? data.params.direction : 90;
        const rad = direction * (Math.PI / 180);
        const vx = Math.cos(rad);
        const vy = -Math.sin(rad);
        const len = Math.min(data.size.w, data.size.h) * 0.45 * TILE_PX;
        drawArrow(g, x, y, vx, vy, len, 0xffffff, 2);
      } else if (data.type === "forceField") {
        const fx = typeof data.params.forceX === "number" ? data.params.forceX : 0;
        const fy = typeof data.params.forceY === "number" ? data.params.forceY : -50;
        const flen = Math.hypot(fx, fy);
        if (flen > 0.001) {
          const vx = fx / flen;
          const vy = fy / flen;
          const len = Math.min(data.size.w, data.size.h) * 0.45 * TILE_PX;
          drawArrow(g, x, y, vx, vy, len, 0xffffff, 2);
        }
      }
    }

    if (this.showPaths) {
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
                  drawArrow(this.debugLayer, startX, startY, dx / dist, dy / dist, dist, color, 3);
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
              this.debugLayer.moveTo(dx, dy).lineTo(tx, ty).stroke({ color, width: 2, alpha: 0.5 });
            }
          }
        }
      }
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

function drawArrow(
  g: Graphics,
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  length: number,
  color: number,
  width: number,
): void {
  const tx = cx + vx * length;
  const ty = cy + vy * length;
  g.moveTo(cx, cy).lineTo(tx, ty).stroke({ color, width });

  // Draw arrow head
  const angle = Math.atan2(vy, vx);
  const headSize = Math.max(5, length * 0.25);
  const leftX = tx - headSize * Math.cos(angle - Math.PI / 6);
  const leftY = ty - headSize * Math.sin(angle - Math.PI / 6);
  const rightX = tx - headSize * Math.cos(angle + Math.PI / 6);
  const rightY = ty - headSize * Math.sin(angle + Math.PI / 6);

  g.moveTo(tx, ty).lineTo(leftX, leftY);
  g.moveTo(tx, ty).lineTo(rightX, rightY);
  g.stroke({ color, width });
}
