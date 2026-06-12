import { defaultParams, ENTITY_TYPES, type EntityDef, entityTypeSpec } from "@cosmonauts/content";
import type { ShapeDef, Solidity, Vec2 } from "@cosmonauts/sim";
import { Assets, Color, Sprite } from "pixi.js";
import type { Renderer } from "../renderer";
import { TILE_PX } from "../renderer";
import { blankDoc, compileDoc, docFromJson, docToDef, type MapDoc, saveToStorage } from "./doc";
import { History } from "./history";

type Tool = "select" | "rect" | "polygon" | "spawn" | "dummy" | "entity" | "brush";

type Selection =
  | { kind: "shape"; id: string }
  | { kind: "entity"; id: string }
  | { kind: "spawn"; index: number }
  | { kind: "dummy"; index: number };

type Drag =
  | { type: "pan"; sx: number; sy: number; camX: number; camY: number }
  | { type: "move"; last: Vec2 }
  | { type: "resize"; corner: number }
  | { type: "move-vertex"; index: number }
  | { type: "rotate" }
  | { type: "draw-rect"; start: Vec2; current: Vec2 }
  | { type: "paint"; val: string }
  | { type: "box-select"; start: Vec2; current: Vec2 };

const DEG = Math.PI / 180;

function getRotatedRectPoints(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotationDeg: number,
): number[] {
  const hw = w / 2;
  const hh = h / 2;
  const r = rotationDeg * DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const corner = (x: number, y: number): [number, number] => [
    cx + x * c - y * s,
    cy + x * s + y * c,
  ];
  return [...corner(-hw, -hh), ...corner(hw, -hh), ...corner(hw, hh), ...corner(-hw, hh)];
}

const SOLIDITY_OPTIONS: Solidity[] = ["solid", "glass", "teamRED", "teamBLU", "none"];

function formatSolidity(s: Solidity): string {
  if (s === "teamRED") return "team RED";
  if (s === "teamBLU") return "team BLU";
  if (s === "none") return "none (decoration)";
  return s;
}

/**
 * In-game map editor MVP (doc 08 §1): geometry + spawn/dummy placement on the
 * running map. Tab (handled by main.ts) flips between editing and playing.
 */
export class Editor {
  doc: MapDoc;
  active = false;
  private tool: Tool = "select";
  private selection: Selection[] = [];
  private cam = { x: 0, y: 0, scale: 1 };
  private drag: Drag | null = null;
  private draft: [number, number][] = [];
  private mouseWorld: Vec2 = { x: 0, y: 0 };
  private newSolidity: Solidity = "solid";
  private newEntityType = ENTITY_TYPES[0]?.type ?? "jumper";
  private snapVal: number | null = 0.5;
  private mirrorMode = false;
  private history = new History();
  private linkingField: {
    type: "targets" | "onDestroyed" | { kind: "param"; key: string };
    entityId: string;
  } | null = null;
  private shapeCounter = 1;
  private entityCounter = 1;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  private bar!: HTMLElement;
  private inspector!: HTMLElement;
  private statusEl!: HTMLElement;
  private warningsEl!: HTMLElement;
  private bgSprite: Sprite | null = null;

  constructor(
    private renderer: Renderer,
    doc: MapDoc,
    private availableMaps: { id: string; name: string }[] = [],
    private onSwitchMap?: (mapId: string) => void,
  ) {
    this.doc = doc;
    this.buildUi();
    this.attachPointerHandlers();
    this.attachKeyHandlers();
  }

  // ---------- mode ----------

  enter(): void {
    this.active = true;
    const t = this.renderer.cameraOverride ?? {
      x: this.renderer.world.x,
      y: this.renderer.world.y,
      scale: this.renderer.world.scale.x,
    };
    this.cam = { ...t };
    this.renderer.cameraOverride = this.cam;
    this.bar.style.display = "block";
    this.refreshInspector();
  }

  exit(): void {
    this.active = false;
    this.drag = null;
    this.draft = [];
    this.renderer.cameraOverride = null;
    this.renderer.editorLayer.clear();
    this.bar.style.display = "none";
    this.inspector.style.display = "none";
  }

  // ---------- document mutation plumbing ----------

  private beginChange(): void {
    this.history.push(this.doc);
  }

  private changed(): void {
    this.renderer.setMap(compileDoc(this.doc));
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveToStorage(this.doc), 400);
  }

  private replaceDoc(doc: MapDoc): void {
    this.doc = doc;
    this.selection = [];
    this.draft = [];
    this.changed();
    this.refreshInspector();
  }

  private undo(): void {
    const prev = this.history.undo(this.doc);
    if (prev !== null) {
      this.doc = prev;
      this.selection = [];
      this.changed();
      this.refreshInspector();
    }
  }

  private redo(): void {
    const next = this.history.redo(this.doc);
    if (next !== null) {
      this.doc = next;
      this.selection = [];
      this.changed();
      this.refreshInspector();
    }
  }

  // ---------- coordinates ----------

  private toWorld(sx: number, sy: number): Vec2 {
    return {
      x: (sx - this.cam.x) / (TILE_PX * this.cam.scale),
      y: (sy - this.cam.y) / (TILE_PX * this.cam.scale),
    };
  }

  private toScreen(wx: number, wy: number): Vec2 {
    return {
      x: wx * TILE_PX * this.cam.scale + this.cam.x,
      y: wy * TILE_PX * this.cam.scale + this.cam.y,
    };
  }

  private snapPt(v: number): number {
    return this.snapVal ? Math.round(v / this.snapVal) * this.snapVal : v;
  }

  // ---------- selection helpers ----------

  private selectedShape(): ShapeDef | null {
    if (this.selection.length !== 1) return null;
    const sel = this.selection[0];
    if (!sel) return null;
    if (sel === undefined || sel.kind !== "shape") return null;
    return (
      this.doc.shapes.find((s) => s.id === (sel as Extract<Selection, { id: string }>).id) ?? null
    );
  }

  private selectedEntity(): EntityDef | null {
    if (this.selection.length !== 1) return null;
    const sel = this.selection[0];
    if (sel === undefined || sel.kind !== "entity") return null;
    return (
      this.doc.entities.find((e) => e.id === (sel as Extract<Selection, { id: string }>).id) ?? null
    );
  }

  private entityCorners(e: EntityDef): Vec2[] {
    const rotation = typeof e.params?.rotation === "number" ? e.params.rotation : 0;
    const r = rotation * DEG;
    const c = Math.cos(r);
    const n = Math.sin(r);
    const [w, h] = this.entitySize(e);
    const hw = w / 2;
    const hh = h / 2;
    const local: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
    return local.map(([lx, ly]) => ({
      x: e.pos[0] + lx * c - ly * n,
      y: e.pos[1] + lx * n + ly * c,
    }));
  }

  private entityRotateHandlePos(e: EntityDef): Vec2 {
    const rotation = typeof e.params?.rotation === "number" ? e.params.rotation : 0;
    const r = rotation * DEG;
    const [_, h] = this.entitySize(e);
    const d = h / 2 + 0.9;
    return { x: e.pos[0] + Math.sin(r) * d, y: e.pos[1] - Math.cos(r) * d };
  }

  private translateShape(s: ShapeDef, dx: number, dy: number): void {
    switch (s.kind) {
      case "rect":
        s.pos = [s.pos[0] + dx, s.pos[1] + dy];
        break;
      case "arc":
        s.center = [s.center[0] + dx, s.center[1] + dy];
        break;
      default:
        s.points = s.points.map(([px, py]) => [px + dx, py + dy]);
    }
  }

  /** Rect corners in world space (TL, TR, BR, BL). */
  private rectCorners(s: Extract<ShapeDef, { kind: "rect" }>): Vec2[] {
    const r = (s.rotation ?? 0) * DEG;
    const c = Math.cos(r);
    const n = Math.sin(r);
    const hw = s.size[0] / 2;
    const hh = s.size[1] / 2;
    const local: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
    return local.map(([lx, ly]) => ({
      x: s.pos[0] + lx * c - ly * n,
      y: s.pos[1] + lx * n + ly * c,
    }));
  }

  private hitTest(w: Vec2): Selection | null {
    for (let i = 0; i < this.doc.playerSpawns.length; i++) {
      const p = this.doc.playerSpawns[i];
      if (p && Math.hypot(w.x - p[0], w.y - p[1]) < 0.6) return { kind: "spawn", index: i };
    }
    for (let i = 0; i < this.doc.dummySpawns.length; i++) {
      const p = this.doc.dummySpawns[i];
      if (p && Math.hypot(w.x - p[0], w.y - p[1]) < 0.7) return { kind: "dummy", index: i };
    }
    for (let i = this.doc.entities.length - 1; i >= 0; i--) {
      const e = this.doc.entities[i];
      if (e && this.hitEntity(e, w)) return { kind: "entity", id: e.id };
    }
    for (let i = this.doc.shapes.length - 1; i >= 0; i--) {
      const s = this.doc.shapes[i];
      if (s && this.hitShape(s, w)) return { kind: "shape", id: s.id };
    }
    return null;
  }

  private hitEntity(e: EntityDef, w: Vec2): boolean {
    const [hw, hh] = this.entitySize(e);
    const rotation = typeof e.params?.rotation === "number" ? e.params.rotation : 0;
    if (rotation !== 0) {
      const r = -rotation * DEG;
      const dx = w.x - e.pos[0];
      const dy = w.y - e.pos[1];
      const lx = dx * Math.cos(r) - dy * Math.sin(r);
      const ly = dx * Math.sin(r) + dy * Math.cos(r);
      return Math.abs(lx) <= hw / 2 + 0.1 && Math.abs(ly) <= hh / 2 + 0.1;
    }
    return Math.abs(w.x - e.pos[0]) <= hw / 2 + 0.1 && Math.abs(w.y - e.pos[1]) <= hh / 2 + 0.1;
  }

  private entitySize(e: EntityDef): [number, number] {
    return e.size ?? entityTypeSpec(e.type)?.defaultSize ?? [2, 2];
  }

  private hitShape(s: ShapeDef, w: Vec2): boolean {
    switch (s.kind) {
      case "rect": {
        const r = -(s.rotation ?? 0) * DEG;
        const dx = w.x - s.pos[0];
        const dy = w.y - s.pos[1];
        const lx = dx * Math.cos(r) - dy * Math.sin(r);
        const ly = dx * Math.sin(r) + dy * Math.cos(r);
        return Math.abs(lx) <= s.size[0] / 2 + 0.1 && Math.abs(ly) <= s.size[1] / 2 + 0.1;
      }
      case "polygon": {
        let inside = false;
        const pts = s.points;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i];
          const b = pts[j];
          if (!a || !b) continue;
          if (
            a[1] > w.y !== b[1] > w.y &&
            w.x < ((b[0] - a[0]) * (w.y - a[1])) / (b[1] - a[1]) + a[0]
          ) {
            inside = !inside;
          }
        }
        return inside;
      }
      case "polyline":
        return s.points.some((p, i) => {
          const q = s.points[i + 1];
          return q !== undefined && distToSeg(w, p, q) < 0.35;
        });
      case "arc": {
        const d = Math.hypot(w.x - s.center[0], w.y - s.center[1]);
        return Math.abs(d - s.radius) < 0.4;
      }
    }
  }

  // ---------- pointer handling ----------

  private attachPointerHandlers(): void {
    const canvas = this.renderer.canvasElement;
    canvas.addEventListener("pointerdown", (e) => this.active && this.pointerDown(e));
    window.addEventListener("pointermove", (e) => this.active && this.pointerMove(e));
    window.addEventListener("pointerup", (e) => this.active && this.pointerUp(e));
    canvas.addEventListener("dblclick", () => this.active && this.finishDraft());
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.active) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const next = Math.min(3, Math.max(0.25, this.cam.scale * factor));
        const w = this.toWorld(e.clientX, e.clientY);
        this.cam.x = e.clientX - w.x * TILE_PX * next;
        this.cam.y = e.clientY - w.y * TILE_PX * next;
        this.cam.scale = next;
      },
      { passive: false },
    );
  }

  private pointerDown(e: PointerEvent): void {
    const w = this.toWorld(e.clientX, e.clientY);

    const linking = this.linkingField;
    if (linking !== null) {
      if (e.button === 0) {
        const hit = this.hitTest(w);
        if (hit !== null && hit.kind === "entity" && hit.id !== linking.entityId) {
          this.beginChange();
          const srcEntity = this.doc.entities.find((en) => en.id === linking.entityId);
          if (srcEntity) {
            const targetId = hit.id;
            if (linking.type === "targets") {
              const list = srcEntity.targets ?? [];
              if (!list.includes(targetId)) {
                srcEntity.targets = [...list, targetId];
              }
            } else if (linking.type === "onDestroyed") {
              const list = srcEntity.onDestroyed ?? [];
              if (!list.includes(targetId)) {
                srcEntity.onDestroyed = [...list, targetId];
              }
            } else if (typeof linking.type === "object" && linking.type.kind === "param") {
              const key = linking.type.key;
              if (!srcEntity.params) srcEntity.params = {};
              srcEntity.params[key] = targetId;
            }
            this.changed();
          }
        }
        this.linkingField = null;
        this.refreshInspector();
      }
      return;
    }

    if (e.button === 1 || e.button === 2) {
      this.drag = { type: "pan", sx: e.clientX, sy: e.clientY, camX: this.cam.x, camY: this.cam.y };
      return;
    }
    if (e.button !== 0) return;

    switch (this.tool) {
      case "select": {
        // Handles take priority over body hits.
        const shape = this.selectedShape();
        if (shape !== null && shape.kind === "rect") {
          const handle = this.hitRectHandle(shape, w);
          if (handle === "rotate") {
            this.beginChange();
            this.drag = { type: "rotate" };
            return;
          }
          if (handle !== null) {
            this.beginChange();
            this.drag = { type: "resize", corner: handle };
            return;
          }
        } else if (shape !== null && (shape.kind === "polygon" || shape.kind === "polyline")) {
          const handle = this.hitPolygonHandle(shape, w);
          if (handle !== null) {
            this.beginChange();
            this.drag = { type: "move-vertex", index: handle };
            return;
          }
        }
        const entity = this.selectedEntity();
        if (entity !== null) {
          const handle = this.hitEntityHandle(entity, w);
          if (handle === "rotate") {
            this.beginChange();
            this.drag = { type: "rotate" };
            return;
          }
          if (handle !== null) {
            this.beginChange();
            this.drag = { type: "resize", corner: handle };
            return;
          }
        }
        const hit = this.hitTest(w);
        if (e.shiftKey) {
          if (hit !== null) {
            const hitId = (hit as Extract<Selection, { id: string }>).id;
            const hitIndex = (hit as Extract<Selection, { index: number }>).index;
            const idx = this.selection.findIndex(
              (s) =>
                s.kind === hit.kind &&
                (s as Extract<Selection, { id: string }>).id === hitId &&
                (s as Extract<Selection, { index: number }>).index === hitIndex,
            );
            if (idx >= 0) this.selection.splice(idx, 1);
            else this.selection.push(hit);
          }
        } else {
          if (hit === null) {
            this.selection = [];
            this.drag = { type: "box-select", start: w, current: w };
          } else {
            const has = this.selection.some((s) => {
              if (s.kind !== hit.kind) return false;
              if ("id" in s && "id" in hit) return s.id === hit.id;
              if ("index" in s && "index" in hit) return s.index === hit.index;
              return false;
            });
            if (!has) this.selection = [hit];
            this.beginChange();
            this.drag = { type: "move", last: w };
          }
        }
        this.refreshInspector();
        break;
      }
      case "rect":
        this.drag = {
          type: "draw-rect",
          start: { x: this.snapPt(w.x), y: this.snapPt(w.y) },
          current: w,
        };
        break;
      case "polygon":
        this.draft.push([this.snapPt(w.x), this.snapPt(w.y)]);
        break;
      case "spawn":
        this.beginChange();
        this.doc.playerSpawns.push([this.snapPt(w.x), this.snapPt(w.y), "RED"]);
        if (this.mirrorMode) {
          const mw = this.doc.tiles[0]?.length ?? 48;
          this.doc.playerSpawns.push([mw - this.snapPt(w.x), this.snapPt(w.y), "BLU"]);
        }
        this.changed();
        break;
      case "dummy":
        this.beginChange();
        this.doc.dummySpawns.push([this.snapPt(w.x), this.snapPt(w.y)]);
        if (this.mirrorMode) {
          const mw = this.doc.tiles[0]?.length ?? 48;
          this.doc.dummySpawns.push([mw - this.snapPt(w.x), this.snapPt(w.y)]);
        }
        this.changed();
        break;
      case "entity":
        this.placeEntity(w);
        break;
      case "brush":
        this.beginChange();
        this.drag = { type: "paint", val: this.newSolidity === "solid" ? "#" : "." };
        this.paintTile(w, this.drag.val);
        break;
    }
  }

  private paintTile(w: Vec2, val: string): void {
    let modified = false;
    const paintOne = (tx: number, ty: number) => {
      if (ty < 0 || ty >= this.doc.tiles.length) return;
      const row = this.doc.tiles[ty];
      if (row === undefined || tx < 0 || tx >= row.length) return;
      if (row[tx] !== val && row[tx] !== "S" && row[tx] !== "D") {
        this.doc.tiles[ty] = row.substring(0, tx) + val + row.substring(tx + 1);
        modified = true;
      }
    };
    paintOne(Math.floor(w.x), Math.floor(w.y));
    if (this.mirrorMode) {
      const mw = this.doc.tiles[0]?.length ?? 48;
      paintOne(mw - 1 - Math.floor(w.x), Math.floor(w.y));
    }
    if (modified) this.changed();
  }

  private mirrorEntityParams(
    // biome-ignore lint/suspicious/noExplicitAny: valid
    params: Record<string, any> | undefined,
    // biome-ignore lint/suspicious/noExplicitAny: valid
  ): Record<string, any> | undefined {
    if (!params) return params;
    const out = { ...params };
    if (typeof out.team === "string") {
      if (out.team === "RED") out.team = "BLU";
      else if (out.team === "BLU") out.team = "RED";
      else if (out.team === "A") out.team = "B";
      else if (out.team === "B") out.team = "A";
    }
    if (typeof out.rotation === "number") {
      out.rotation = (((360 - out.rotation) % 360) + 360) % 360;
    }
    if (typeof out.direction === "number") {
      out.direction = (((180 - out.direction) % 360) + 360) % 360;
    }
    if (typeof out.forceX === "number") {
      out.forceX = -out.forceX;
    }
    return out;
  }

  private placeEntity(w: Vec2): void {
    const spec = entityTypeSpec(this.newEntityType);
    if (spec === undefined) return;
    this.beginChange();
    const id = this.nextEntityId(spec.type);
    const sx = this.snapPt(w.x);
    const sy = this.snapPt(w.y);
    this.doc.entities.push({
      id,
      type: spec.type,
      pos: [sx, sy],
      size: [...spec.defaultSize],
      params: defaultParams(spec),
    } as EntityDef);

    if (this.mirrorMode) {
      const mw = this.doc.tiles[0]?.length ?? 48;
      const twinId = this.nextEntityId(spec.type);
      this.doc.entities.push({
        id: twinId,
        type: spec.type,
        pos: [mw - sx, sy],
        size: [...spec.defaultSize],
        params: this.mirrorEntityParams(defaultParams(spec)),
      } as EntityDef);
    }

    this.selection = [{ kind: "entity", id }];
    this.tool = "select";
    this.syncToolButtons();
    this.changed();
    this.refreshInspector();
  }

  private nextEntityId(type: string): string {
    let id = `${type}-${this.entityCounter++}`;
    while (this.doc.entities.some((e) => e.id === id)) id = `${type}-${this.entityCounter++}`;
    return id;
  }

  private pointerMove(e: PointerEvent): void {
    const w = this.toWorld(e.clientX, e.clientY);
    this.mouseWorld = w;
    const drag = this.drag;
    if (drag === null) return;

    switch (drag.type) {
      case "pan":
        this.cam.x = drag.camX + (e.clientX - drag.sx);
        this.cam.y = drag.camY + (e.clientY - drag.sy);
        break;
      case "draw-rect":
      case "box-select":
        drag.current = w;
        break;
      case "paint":
        this.paintTile(w, drag.val);
        break;
      case "move": {
        const dx = this.snapPt(w.x) - this.snapPt(drag.last.x);
        const dy = this.snapPt(w.y) - this.snapPt(drag.last.y);
        if (dx === 0 && dy === 0) break;
        drag.last = w;
        this.moveSelection(dx, dy);
        this.changed();
        break;
      }
      case "move-vertex": {
        const s = this.selectedShape();
        if (s !== null && (s.kind === "polygon" || s.kind === "polyline")) {
          const snap = this.snapVal;
          if (snap) {
            w.x = Math.round(w.x / snap) * snap;
            w.y = Math.round(w.y / snap) * snap;
          }
          s.points[drag.index] = [w.x, w.y];
          if (this.mirrorMode && s.kind === "polygon") {
            const mw = this.doc.tiles[0]?.length ?? 48;
            const twin = this.doc.shapes.find(
              (sh) =>
                sh.id !== s.id &&
                sh.kind === "polygon" &&
                sh.points.length === s.points.length &&
                sh.points[0] !== undefined &&
                s.points[0] !== undefined &&
                Math.abs(sh.points[0][0] - (mw - s.points[0][0])) < 0.1,
            );
            if (twin && twin.kind === "polygon") {
              twin.points[drag.index] = [mw - w.x, w.y];
            }
          }
          this.changed();
        }
        break;
      }
      case "resize": {
        const s = this.selectedShape();
        if (s !== null && s.kind === "rect") {
          this.resizeRect(s, drag.corner, w);
          this.changed();
        } else {
          const e = this.selectedEntity();
          if (e !== null) {
            this.resizeEntity(e, drag.corner, w);
            this.changed();
            this.refreshInspector();
          }
        }
        break;
      }
      case "rotate": {
        const s = this.selectedShape();
        if (s !== null && s.kind === "rect") {
          const angle = Math.atan2(w.y - s.pos[1], w.x - s.pos[0]) / DEG + 90;
          const snapped = e.altKey ? angle : Math.round(angle / 15) * 15;
          s.rotation = ((snapped % 360) + 360) % 360;
          this.changed();
        } else {
          const ent = this.selectedEntity();
          if (ent !== null) {
            const angle = Math.atan2(w.y - ent.pos[1], w.x - ent.pos[0]) / DEG + 90;
            const snapped = e.altKey ? angle : Math.round(angle / 15) * 15;
            if (!ent.params) ent.params = {};
            ent.params.rotation = ((snapped % 360) + 360) % 360;
            this.changed();
            this.refreshInspector();
          }
        }
        break;
      }
    }
  }

  private pointerUp(e: PointerEvent): void {
    const drag = this.drag;
    this.drag = null;
    if (drag?.type === "box-select" && e.button === 0) {
      const minX = Math.min(drag.start.x, drag.current.x);
      const maxX = Math.max(drag.start.x, drag.current.x);
      const minY = Math.min(drag.start.y, drag.current.y);
      const maxY = Math.max(drag.start.y, drag.current.y);
      if (maxX - minX > 0.1 && maxY - minY > 0.1) {
        const inBox = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
        this.doc.shapes.forEach((s) => {
          if (s.kind === "rect" && inBox(s.pos[0], s.pos[1]))
            this.selection.push({ kind: "shape", id: s.id });
          else if (s.kind === "polygon" && s.points.some((p) => inBox(p[0], p[1])))
            this.selection.push({ kind: "shape", id: s.id });
        });
        this.doc.entities.forEach((en) => {
          if (inBox(en.pos[0], en.pos[1])) this.selection.push({ kind: "entity", id: en.id });
        });
        this.refreshInspector();
      }
    }
    if (drag?.type === "draw-rect" && e.button === 0) {
      const x0 = drag.start.x;
      const y0 = drag.start.y;
      const x1 = this.snapPt(drag.current.x);
      const y1 = this.snapPt(drag.current.y);
      const wdt = Math.abs(x1 - x0);
      const hgt = Math.abs(y1 - y0);
      if (wdt >= 0.5 && hgt >= 0.25) {
        this.beginChange();
        const id = this.nextShapeId();
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        this.doc.shapes.push({
          id,
          kind: "rect",
          solidity: this.newSolidity,
          pos: [cx, cy],
          size: [wdt, hgt],
          rotation: 0,
        });

        if (this.mirrorMode) {
          const mw = this.doc.tiles[0]?.length ?? 48;
          let twinSolidity = this.newSolidity;
          if (twinSolidity === "teamRED") twinSolidity = "teamBLU";
          else if (twinSolidity === "teamBLU") twinSolidity = "teamRED";
          this.doc.shapes.push({
            id: this.nextShapeId(),
            kind: "rect",
            solidity: twinSolidity,
            pos: [mw - cx, cy],
            size: [wdt, hgt],
            rotation: 0,
          });
        }

        this.selection = [{ kind: "shape", id }];
        this.tool = "select";
        this.syncToolButtons();
        this.changed();
        this.refreshInspector();
      }
    }
  }

  private moveSelection(dx: number, dy: number): void {
    if (this.selection.length === 0) return;
    const mw = this.doc.tiles[0]?.length ?? 48;
    for (const sel of this.selection) {
      if (sel.kind === "shape") {
        const s = this.doc.shapes.find(
          (sh) => sh.id === (sel as Extract<Selection, { id: string }>).id,
        );
        if (s) {
          let twin: ShapeDef | undefined;
          if (this.mirrorMode && s.kind === "rect") {
            twin = this.doc.shapes.find(
              (sh) =>
                sh.id !== s.id &&
                sh.kind === "rect" &&
                Math.abs(sh.pos[0] - (mw - s.pos[0])) < 0.1 &&
                Math.abs(sh.pos[1] - s.pos[1]) < 0.1,
            );
          }
          this.translateShape(s, dx, dy);
          if (twin && !this.selection.some((x) => "id" in x && x.id === twin.id))
            this.translateShape(twin, -dx, dy);
        }
      } else if (sel.kind === "entity") {
        const e = this.doc.entities.find(
          (en) => en.id === (sel as Extract<Selection, { id: string }>).id,
        );
        if (e) {
          let twin: EntityDef | undefined;
          if (this.mirrorMode) {
            twin = this.doc.entities.find(
              (en) =>
                en.id !== e.id &&
                en.type === e.type &&
                Math.abs(en.pos[0] - (mw - e.pos[0])) < 0.1 &&
                Math.abs(en.pos[1] - e.pos[1]) < 0.1,
            );
          }
          e.pos = [e.pos[0] + dx, e.pos[1] + dy];
          if (twin && !this.selection.some((x) => "id" in x && x.id === twin.id))
            twin.pos = [twin.pos[0] - dx, twin.pos[1] + dy];
        }
      } else if (sel.kind === "spawn") {
        const p = this.doc.playerSpawns[(sel as Extract<Selection, { index: number }>).index];
        if (p) {
          let twinIdx = -1;
          if (this.mirrorMode) {
            twinIdx = this.doc.playerSpawns.findIndex(
              (other, idx) =>
                idx !== (sel as Extract<Selection, { index: number }>).index &&
                Math.abs(other[0] - (mw - p[0])) < 0.1 &&
                Math.abs(other[1] - p[1]) < 0.1,
            );
          }
          this.doc.playerSpawns[(sel as Extract<Selection, { index: number }>).index] = [
            p[0] + dx,
            p[1] + dy,
            p[2],
          ];
          if (twinIdx !== -1 && !this.selection.some((x) => "index" in x && x.index === twinIdx)) {
            const twin = this.doc.playerSpawns[twinIdx];
            if (twin) this.doc.playerSpawns[twinIdx] = [twin[0] - dx, twin[1] + dy, twin[2]];
          }
        }
      } else {
        const p = this.doc.dummySpawns[(sel as Extract<Selection, { index: number }>).index];
        if (p) {
          let twinIdx = -1;
          if (this.mirrorMode) {
            twinIdx = this.doc.dummySpawns.findIndex(
              (other, idx) =>
                idx !== (sel as Extract<Selection, { index: number }>).index &&
                Math.abs(other[0] - (mw - p[0])) < 0.1 &&
                Math.abs(other[1] - p[1]) < 0.1,
            );
          }
          this.doc.dummySpawns[(sel as Extract<Selection, { index: number }>).index] = [
            p[0] + dx,
            p[1] + dy,
          ];
          if (twinIdx !== -1 && !this.selection.some((x) => "index" in x && x.index === twinIdx)) {
            const twin = this.doc.dummySpawns[twinIdx];
            if (twin) this.doc.dummySpawns[twinIdx] = [twin[0] - dx, twin[1] + dy];
          }
        }
      }
    }
  }

  private hitPolygonHandle(
    s: Extract<ShapeDef, { kind: "polygon" | "polyline" }>,
    w: Vec2,
  ): number | null {
    const grab = 0.35 / this.cam.scale;
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      if (p && Math.hypot(w.x - p[0], w.y - p[1]) < grab) return i;
    }
    return null;
  }

  private hitRectHandle(s: Extract<ShapeDef, { kind: "rect" }>, w: Vec2): number | "rotate" | null {
    const grab = 0.35 / this.cam.scale;
    const corners = this.rectCorners(s);
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      if (c && Math.hypot(w.x - c.x, w.y - c.y) < grab) return i;
    }
    const rh = this.rotateHandlePos(s);
    if (Math.hypot(w.x - rh.x, w.y - rh.y) < grab) return "rotate";
    return null;
  }

  private rotateHandlePos(s: Extract<ShapeDef, { kind: "rect" }>): Vec2 {
    const r = (s.rotation ?? 0) * DEG;
    const d = s.size[1] / 2 + 0.9;
    return { x: s.pos[0] + Math.sin(r) * d, y: s.pos[1] - Math.cos(r) * d };
  }

  private resizeRect(s: Extract<ShapeDef, { kind: "rect" }>, corner: number, w: Vec2): void {
    const r = (s.rotation ?? 0) * DEG;
    const c = Math.cos(r);
    const n = Math.sin(r);
    // Mouse in the rect's local frame.
    const dx = w.x - s.pos[0];
    const dy = w.y - s.pos[1];
    let lx = dx * c + dy * n;
    let ly = -dx * n + dy * c;
    if (this.snapVal !== null) {
      lx = Math.round(lx / this.snapVal) * this.snapVal;
      ly = Math.round(ly / this.snapVal) * this.snapVal;
    }
    // Opposite corner stays fixed.
    const signs: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const sign = signs[corner];
    if (!sign) return;
    const ox = -sign[0] * (s.size[0] / 2);
    const oy = -sign[1] * (s.size[1] / 2);
    const ncx = (lx + ox) / 2;
    const ncy = (ly + oy) / 2;
    const nw = Math.max(0.25, Math.abs(lx - ox));
    const nh = Math.max(0.25, Math.abs(ly - oy));
    s.pos = [s.pos[0] + ncx * c - ncy * n, s.pos[1] + ncx * n + ncy * c];
    s.size = [nw, nh];
  }

  private hitEntityHandle(e: EntityDef, w: Vec2): number | "rotate" | null {
    const grab = 0.35 / this.cam.scale;
    const corners = this.entityCorners(e);
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      if (c && Math.hypot(w.x - c.x, w.y - c.y) < grab) return i;
    }
    const rh = this.entityRotateHandlePos(e);
    if (Math.hypot(w.x - rh.x, w.y - rh.y) < grab) return "rotate";
    return null;
  }

  private resizeEntity(e: EntityDef, corner: number, w: Vec2): void {
    const rotation = typeof e.params?.rotation === "number" ? e.params.rotation : 0;
    const r = rotation * DEG;
    const c = Math.cos(r);
    const n = Math.sin(r);
    // Mouse in the local frame.
    const dx = w.x - e.pos[0];
    const dy = w.y - e.pos[1];
    let lx = dx * c + dy * n;
    let ly = -dx * n + dy * c;
    if (this.snapVal !== null) {
      lx = Math.round(lx / this.snapVal) * this.snapVal;
      ly = Math.round(ly / this.snapVal) * this.snapVal;
    }
    // Opposite corner stays fixed.
    const signs: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const sign = signs[corner];
    if (!sign) return;
    const [esw, esh] = this.entitySize(e);
    const ox = -sign[0] * (esw / 2);
    const oy = -sign[1] * (esh / 2);
    const ncx = (lx + ox) / 2;
    const ncy = (ly + oy) / 2;
    const nw = Math.max(0.25, Math.abs(lx - ox));
    const nh = Math.max(0.25, Math.abs(ly - oy));
    e.pos = [e.pos[0] + ncx * c - ncy * n, e.pos[1] + ncx * n + ncy * c];
    e.size = [nw, nh];
  }

  private finishDraft(): void {
    if (this.tool !== "polygon" || this.draft.length < 3) return;
    this.beginChange();
    const id = this.nextShapeId();
    this.doc.shapes.push({
      id,
      kind: "polygon",
      solidity: this.newSolidity,
      points: this.draft.map(([x, y]) => [x, y]),
    });
    if (this.mirrorMode) {
      const mw = this.doc.tiles[0]?.length ?? 48;
      let twinSolidity = this.newSolidity;
      if (twinSolidity === "teamRED") twinSolidity = "teamBLU";
      else if (twinSolidity === "teamBLU") twinSolidity = "teamRED";
      this.doc.shapes.push({
        id: this.nextShapeId(),
        kind: "polygon",
        solidity: twinSolidity,
        points: this.draft.map(([x, y]) => [mw - x, y]),
      });
    }
    this.draft = [];
    this.selection = [{ kind: "shape", id }];
    this.tool = "select";
    this.syncToolButtons();
    this.changed();
    this.refreshInspector();
  }

  private nextShapeId(): string {
    let id = `shape-${this.shapeCounter++}`;
    while (this.doc.shapes.some((s) => s.id === id)) id = `shape-${this.shapeCounter++}`;
    return id;
  }

  private deleteSelection(): void {
    if (this.selection.length === 0) return;
    this.beginChange();
    for (const sel of this.selection) {
      if (sel.kind === "shape") {
        this.doc.shapes = this.doc.shapes.filter(
          (s) => s.id !== (sel as Extract<Selection, { id: string }>).id,
        );
      } else if (sel.kind === "entity") {
        this.doc.entities = this.doc.entities.filter(
          (e) => e.id !== (sel as Extract<Selection, { id: string }>).id,
        );
      } else if (sel.kind === "spawn") {
        if (this.doc.playerSpawns.length > 1)
          this.doc.playerSpawns.splice((sel as Extract<Selection, { index: number }>).index, 1);
      } else {
        this.doc.dummySpawns.splice((sel as Extract<Selection, { index: number }>).index, 1);
      }
    }
    this.selection = [];
    this.changed();
    this.refreshInspector();
  }

  private duplicateSelection(): void {
    if (this.selection.length === 0) return;
    this.beginChange();
    const newSel: Selection[] = [];
    for (const sel of this.selection) {
      if (sel.kind === "shape") {
        const s = this.doc.shapes.find(
          (x) => x.id === (sel as Extract<Selection, { id: string }>).id,
        );
        if (s) {
          const copy = JSON.parse(JSON.stringify(s));
          copy.id = this.nextShapeId();
          this.translateShape(copy, 0.5, 0.5);
          this.doc.shapes.push(copy);
          newSel.push({ kind: "shape", id: copy.id } as Selection);
        }
      } else if (sel.kind === "entity") {
        const e = this.doc.entities.find(
          (x) => x.id === (sel as Extract<Selection, { id: string }>).id,
        );
        if (e) {
          const copy = JSON.parse(JSON.stringify(e));
          copy.id = this.nextEntityId(e.type);
          copy.pos[0] += 0.5;
          copy.pos[1] += 0.5;
          this.doc.entities.push(copy);
          newSel.push({ kind: "entity", id: copy.id } as Selection);
        }
      } else if (sel.kind === "spawn") {
        const p = this.doc.playerSpawns[(sel as Extract<Selection, { index: number }>).index];
        if (p) {
          this.doc.playerSpawns.push([p[0] + 0.5, p[1] + 0.5, p[2]]);
          newSel.push({ kind: "spawn", index: this.doc.playerSpawns.length - 1 } as Selection);
        }
      } else {
        const d = this.doc.dummySpawns[(sel as Extract<Selection, { index: number }>).index];
        if (d) {
          this.doc.dummySpawns.push([d[0] + 0.5, d[1] + 0.5]);
          newSel.push({ kind: "dummy", index: this.doc.dummySpawns.length - 1 } as Selection);
        }
      }
    }
    this.selection = newSel;
    this.changed();
    this.refreshInspector();
  }

  // ---------- keyboard ----------

  private attachKeyHandlers(): void {
    window.addEventListener("keydown", (e) => {
      if (!this.active) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Delete" || e.code === "Backspace") this.deleteSelection();
      else if (e.code === "Escape") {
        this.draft = [];
        this.selection = [];
        this.refreshInspector();
      } else if (e.code === "Enter") this.finishDraft();
      else if (e.code === "KeyG") {
        this.snapVal = this.snapVal === null ? 0.5 : null;
        this.updateStatus();
      } else if (e.code === "KeyM") {
        this.mirrorMode = !this.mirrorMode;
        this.updateStatus();
        this.syncToolButtons();
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyD") {
        e.preventDefault();
        this.duplicateSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey))
      ) {
        e.preventDefault();
        this.redo();
      }
    });
  }

  // ---------- per-frame overlay ----------

  update(): void {
    const g = this.renderer.editorLayer;
    g.clear();
    const px = (v: number) => v * TILE_PX;
    const lw = (w: number) => w / this.cam.scale;

    // Grid.
    if (this.cam.scale * TILE_PX >= 10) {
      const w = this.doc.tiles[0]?.length ?? 0;
      const h = this.doc.tiles.length;
      for (let x = 0; x <= w; x++) {
        g.moveTo(px(x), 0).lineTo(px(x), px(h));
      }
      for (let y = 0; y <= h; y++) {
        g.moveTo(0, px(y)).lineTo(px(w), px(y));
      }
      g.stroke({ color: 0xffffff, alpha: 0.05, width: lw(1) });
    }

    // Markers.
    for (const [x, y, team] of this.doc.playerSpawns) {
      const color = team === "RED" ? 0xff4444 : 0x4444ff;
      g.circle(px(x), px(y), px(0.35)).fill({ color, alpha: 0.9 });
      g.circle(px(x), px(y), px(0.35)).stroke({ color: 0xffffff, width: lw(2) });
    }
    for (const [x, y] of this.doc.dummySpawns) {
      g.rect(px(x) - px(0.3), px(y) - px(0.45), px(0.6), px(0.9)).fill({
        color: 0xff5d73,
        alpha: 0.8,
      });
    }

    // Entities.
    for (const e of this.doc.entities) {
      const [w, h] = this.entitySize(e);
      const spec = entityTypeSpec(e.type);
      let color = Color.shared.setValue(e.tint ?? spec?.color ?? "#ffffff").toNumber();
      if (e.type === "base") {
        const team = typeof e.params?.team === "string" ? e.params.team : "RED";
        color = team === "RED" || team === "A" ? 0xff4d5e : 0x4d7dff;
      }
      const rotation = typeof e.params?.rotation === "number" ? e.params.rotation : 0;
      if (rotation !== 0) {
        const pts = getRotatedRectPoints(px(e.pos[0]), px(e.pos[1]), px(w), px(h), rotation);
        g.poly(pts).fill({
          color,
          alpha: e.enabled === false ? 0.3 : 0.6,
        });
        g.poly(pts).stroke({
          color,
          width: lw(1),
          alpha: 0.8,
        });
      } else {
        if (e.type === "fluxCube") {
          const denomStr = typeof e.params?.denomination === "string" ? e.params.denomination : "1";
          const finalColor = denomStr === "5" ? 0xffca28 : 0xd1d5db;
          const size = px(Math.min(w, h) * 0.35);
          const x = px(e.pos[0]);
          const y = px(e.pos[1]);
          const alpha = e.enabled === false ? 0.3 : 0.6;
          g.poly([x, y - size, x + size, y, x, y + size, x - size, y])
            .fill({ color: finalColor, alpha })
            .stroke({ color: 0xffffff, width: lw(1.5), alpha: 0.8 });
        } else if (e.type === "healthPickup") {
          const radius = px(Math.min(w, h) * 0.35);
          const x = px(e.pos[0]);
          const y = px(e.pos[1]);
          const alpha = e.enabled === false ? 0.3 : 0.6;
          g.circle(x, y, radius)
            .fill({ color: 0x66ff8c, alpha })
            .stroke({ color: 0xffffff, width: lw(1.5), alpha: 0.8 });
          g.rect(x - lw(1), y - lw(3), lw(2), lw(6)).fill(0xffffff);
          g.rect(x - lw(3), y - lw(1), lw(6), lw(2)).fill(0xffffff);
        } else {
          g.rect(px(e.pos[0] - w / 2), px(e.pos[1] - h / 2), px(w), px(h)).fill({
            color,
            alpha: e.enabled === false ? 0.3 : 0.6,
          });
          g.rect(px(e.pos[0] - w / 2), px(e.pos[1] - h / 2), px(w), px(h)).stroke({
            color,
            width: lw(1),
            alpha: 0.8,
          });
        }
      }

      // Draw team color coding indicator if applicable (RED or BLU, also fallback to A/B)
      const teamVal = e.params?.team;
      if (teamVal === "RED" || teamVal === "BLU" || teamVal === "A" || teamVal === "B") {
        const teamColor = teamVal === "RED" || teamVal === "A" ? 0xff4d5e : 0x4d7dff;
        g.circle(px(e.pos[0]), px(e.pos[1]), lw(5))
          .fill(teamColor)
          .stroke({ color: 0xffffff, width: lw(1.5) });
      }

      // Draw orientation arrows for jumper and forceField
      if (e.type === "jumper") {
        const direction = typeof e.params?.direction === "number" ? e.params.direction : 90;
        const rad = direction * (Math.PI / 180);
        const vx = Math.cos(rad);
        const vy = -Math.sin(rad);
        const len = Math.min(w, h) * 0.45;
        drawArrow(g, px(e.pos[0]), px(e.pos[1]), vx, vy, px(len), 0xffffff, lw(2));
      } else if (e.type === "forceField") {
        const fx = typeof e.params?.forceX === "number" ? e.params.forceX : 0;
        const fy = typeof e.params?.forceY === "number" ? e.params.forceY : -50;
        const flen = Math.hypot(fx, fy);
        if (flen > 0.001) {
          const vx = fx / flen;
          const vy = fy / flen;
          const len = Math.min(w, h) * 0.45;
          drawArrow(g, px(e.pos[0]), px(e.pos[1]), vx, vy, px(len), 0xffffff, lw(2));
        }
      }

      // Draw linking mode highlight
      if (this.linkingField !== null && e.id !== this.linkingField.entityId) {
        if (rotation !== 0) {
          const pts = getRotatedRectPoints(px(e.pos[0]), px(e.pos[1]), px(w), px(h), rotation);
          g.poly(pts).stroke({
            color: 0x7df9ff,
            width: lw(2.5),
            alpha: 0.85,
          });
        } else {
          g.rect(px(e.pos[0] - w / 2), px(e.pos[1] - h / 2), px(w), px(h)).stroke({
            color: 0x7df9ff,
            width: lw(2.5),
            alpha: 0.85,
          });
        }
      }
    }

    // Polygon draft.
    if (this.draft.length > 0) {
      const first = this.draft[0];
      if (first) g.moveTo(px(first[0]), px(first[1]));
      for (const [x, y] of this.draft.slice(1)) g.lineTo(px(x), px(y));
      g.lineTo(px(this.mouseWorld.x), px(this.mouseWorld.y));
      g.stroke({ color: 0xffd166, width: lw(2) });
      for (const [x, y] of this.draft) g.circle(px(x), px(y), lw(4)).fill(0xffd166);
    }

    // Rect-draw or box-select preview.
    if (this.drag?.type === "draw-rect" || this.drag?.type === "box-select") {
      const { start, current } = this.drag;
      const isBox = this.drag.type === "box-select";
      g.rect(
        px(Math.min(start.x, current.x)),
        px(Math.min(start.y, current.y)),
        px(Math.abs(current.x - start.x)),
        px(Math.abs(current.y - start.y)),
      ).stroke({ color: isBox ? 0x7df9ff : 0xffd166, width: lw(2) });
      if (isBox) {
        g.rect(
          px(Math.min(start.x, current.x)),
          px(Math.min(start.y, current.y)),
          px(Math.abs(current.x - start.x)),
          px(Math.abs(current.y - start.y)),
        ).fill({ color: 0x7df9ff, alpha: 0.1 });
      }
    }

    // Selection.
    for (const sel of this.selection) {
      if (sel?.kind === "shape") {
        const s = this.doc.shapes.find(
          (sh) => sh.id === (sel as Extract<Selection, { id: string }>).id,
        );
        if (s) this.drawShapeSelection(g, s, lw);
      } else if (sel?.kind === "entity") {
        const e = this.doc.entities.find(
          (en) => en.id === (sel as Extract<Selection, { id: string }>).id,
        );
        if (e) {
          const SEL = 0xff2bd6;
          const corners = this.entityCorners(e);
          const c0 = corners[0];
          const c1 = corners[1];
          if (c0 && c1) {
            g.moveTo(px(c0.x), px(c0.y));
            for (const c of corners.slice(1)) g.lineTo(px(c.x), px(c.y));
            g.lineTo(px(c0.x), px(c0.y));
            g.stroke({ color: SEL, width: lw(2) });
            for (const c of corners) {
              g.rect(px(c.x) - lw(5), px(c.y) - lw(5), lw(10), lw(10)).fill(0xffffff);
            }
            const rh = this.entityRotateHandlePos(e);
            g.moveTo(px((c0.x + c1.x) / 2), px((c0.y + c1.y) / 2))
              .lineTo(px(rh.x), px(rh.y))
              .stroke({ color: SEL, width: lw(1) });
            g.circle(px(rh.x), px(rh.y), lw(6)).fill(SEL);
          }

          // Draw connection lines to linked entities
          const spec = entityTypeSpec(e.type);
          const targetIds = new Set<string>();
          if (e.targets) {
            for (const t of e.targets) {
              if (t) targetIds.add(t);
            }
          }
          if (e.onDestroyed) {
            for (const t of e.onDestroyed) {
              if (t) targetIds.add(t);
            }
          }
          if (spec) {
            for (const [key, p] of Object.entries(spec.params)) {
              if (p.kind === "entityId") {
                const val = e.params?.[key];
                if (typeof val === "string" && val) {
                  targetIds.add(val);
                }
              }
            }
          }
          for (const tid of targetIds) {
            const t = this.doc.entities.find((en) => en.id === tid);
            if (t) {
              g.moveTo(px(e.pos[0]), px(e.pos[1]))
                .lineTo(px(t.pos[0]), px(t.pos[1]))
                .stroke({ color: SEL, width: lw(2), alpha: 0.7 });
              g.circle(px(t.pos[0]), px(t.pos[1]), px(0.15)).fill({ color: SEL, alpha: 0.9 });
            }
          }
        }
      } else if (sel?.kind === "spawn") {
        const p = this.doc.playerSpawns[(sel as Extract<Selection, { index: number }>).index];
        if (p) g.circle(px(p[0]), px(p[1]), px(0.5)).stroke({ color: 0xffffff, width: lw(2) });
      } else if (sel?.kind === "dummy") {
        const p = this.doc.dummySpawns[(sel as Extract<Selection, { index: number }>).index];
        if (p)
          g.rect(px(p[0]) - px(0.4), px(p[1]) - px(0.55), px(0.8), px(1.1)).stroke({
            color: 0xffffff,
            width: lw(2),
          });
      }
    }

    this.updateStatus();
  }

  private drawShapeSelection(
    g: import("pixi.js").Graphics,
    s: ShapeDef,
    lw: (w: number) => number,
  ): void {
    const px = (v: number) => v * TILE_PX;
    const SEL = 0xff2bd6;
    if (s.kind === "rect") {
      const corners = this.rectCorners(s);
      const c0 = corners[0];
      const c1 = corners[1];
      if (!c0 || !c1) return;
      g.moveTo(px(c0.x), px(c0.y));
      for (const c of corners.slice(1)) g.lineTo(px(c.x), px(c.y));
      g.lineTo(px(c0.x), px(c0.y));
      g.stroke({ color: SEL, width: lw(2) });
      for (const c of corners) {
        g.rect(px(c.x) - lw(5), px(c.y) - lw(5), lw(10), lw(10)).fill(0xffffff);
      }
      const rh = this.rotateHandlePos(s);
      g.moveTo(px((c0.x + c1.x) / 2), px((c0.y + c1.y) / 2))
        .lineTo(px(rh.x), px(rh.y))
        .stroke({ color: SEL, width: lw(1) });
      g.circle(px(rh.x), px(rh.y), lw(6)).fill(SEL);
    } else if (s.kind === "polygon" || s.kind === "polyline") {
      const first = s.points[0];
      if (!first) return;
      g.moveTo(px(first[0]), px(first[1]));
      for (const [x, y] of s.points.slice(1)) g.lineTo(px(x), px(y));
      if (s.kind === "polygon") g.lineTo(px(first[0]), px(first[1]));
      g.stroke({ color: SEL, width: lw(2) });
      for (const [x, y] of s.points) {
        g.rect(px(x) - lw(5), px(y) - lw(5), lw(10), lw(10)).fill(0xffffff);
      }
    } else {
      g.circle(px(s.center[0]), px(s.center[1]), px(s.radius)).stroke({
        color: SEL,
        alpha: 0.5,
        width: lw(2),
      });
    }
  }

  // ---------- DOM UI ----------

  private buildUi(): void {
    const uiContainer = document.createElement("div");
    uiContainer.id = "editor-ui";
    uiContainer.style.display = "none";
    document.body.appendChild(uiContainer);
    this.bar = uiContainer;

    const topBar = document.createElement("div");
    topBar.id = "editor-actions";
    topBar.className = "editor-panel";
    uiContainer.appendChild(topBar);

    if (this.availableMaps.length > 0 && this.onSwitchMap) {
      const mapSelectDiv = document.createElement("div");
      mapSelectDiv.style.display = "flex";
      mapSelectDiv.style.alignItems = "center";
      mapSelectDiv.style.gap = "8px";
      mapSelectDiv.style.marginRight = "16px";
      mapSelectDiv.style.borderRight = "1px solid #2c3354";
      mapSelectDiv.style.paddingRight = "16px";

      const mapLabel = document.createElement("span");
      mapLabel.textContent = "MAP:";
      mapLabel.style.fontSize = "10px";
      mapLabel.style.color = "#9fb4ff";
      mapLabel.style.fontWeight = "bold";

      const mapSelect = document.createElement("select");
      mapSelect.style.background = "#10142a";
      mapSelect.style.color = "#ffffff";
      mapSelect.style.border = "1px solid #2c3354";
      mapSelect.style.padding = "2px 4px";
      mapSelect.style.borderRadius = "4px";

      for (const m of this.availableMaps) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === this.doc.id) opt.selected = true;
        mapSelect.appendChild(opt);
      }

      mapSelect.addEventListener("change", () => {
        if (this.onSwitchMap) this.onSwitchMap(mapSelect.value);
      });

      mapSelectDiv.appendChild(mapLabel);
      mapSelectDiv.appendChild(mapSelect);
      topBar.appendChild(mapSelectDiv);
    }

    const leftDock = document.createElement("div");
    leftDock.id = "editor-tools";
    leftDock.className = "editor-panel";
    uiContainer.appendChild(leftDock);

    const bottomBar = document.createElement("div");
    bottomBar.id = "editor-status-bar";
    bottomBar.className = "editor-panel";
    uiContainer.appendChild(bottomBar);

    const entityPalette = document.createElement("div");
    entityPalette.id = "editor-entities";
    entityPalette.className = "editor-panel";
    uiContainer.appendChild(entityPalette);

    const createIcon = (d: string) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "14");
      svg.setAttribute("height", "14");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
      return svg;
    };

    const icons: Record<string, string> = {
      bg: "M4 4h16v16H4z M14 9l-3 4-2-2-3 4h12z",
      select: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z",
      brush: "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586",
      rect: "M3 3h18v18H3z",
      polygon: "M12 2l8.5 6-3 14h-11l-3-14z",
      spawn: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
      dummy: "M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z M12 14v8 M8 22h8 M8 10h8",
      undo: "M3 7v6h6 M3 13l3-3a9 9 0 0 1 15 3",
      redo: "M21 7v6h-6 M21 13l-3-3a9 9 0 0 0-15 3",
      export: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
      import: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
      new: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6",
    };

    const tools: [Tool, string, string][] = [
      ["select", "Select", "V"],
      ["brush", "Tile Brush (solid/none)", ""],
      ["rect", "Rect", ""],
      ["polygon", "Polygon (dblclick/Enter to close)", ""],
      ["spawn", "Spawn", ""],
      ["dummy", "Dummy", ""],
    ];
    for (const [tool, tip, hotkey] of tools) {
      const b = document.createElement("button");
      b.title = tip;
      b.dataset.tool = tool;
      if (icons[tool]) b.appendChild(createIcon(icons[tool]));
      const span = document.createElement("span");
      span.textContent = tool.charAt(0).toUpperCase() + tool.slice(1);
      b.appendChild(span);
      if (hotkey) {
        const kbd = document.createElement("kbd");
        kbd.textContent = hotkey;
        b.appendChild(kbd);
      }
      b.addEventListener("click", () => {
        this.tool = tool;
        this.draft = [];
        this.syncToolButtons();
      });
      leftDock.appendChild(b);
    }

    const solDiv = document.createElement("div");
    solDiv.className = "editor-divider";
    solDiv.dataset.id = "sol-divider";
    leftDock.appendChild(solDiv);

    const sol = document.createElement("select");
    sol.dataset.id = "sol-select";
    sol.title = "solidity for new shapes";
    for (const s of SOLIDITY_OPTIONS) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = formatSolidity(s);
      sol.appendChild(o);
    }
    sol.addEventListener("change", () => {
      this.newSolidity = sol.value as Solidity;
    });
    leftDock.appendChild(sol);

    const groupDefinitions = [
      {
        name: "Mechanics",
        types: [
          "jumper",
          "teleporter",
          "activator",
          "timer",
          "door",
          "teamBarrier",
          "fluxCube",
          "healthPickup",
        ],
      },
      { name: "Fields", types: ["forceField", "fireField", "healField", "killZone", "hideZone"] },
      { name: "Units", types: ["shop", "turret", "core", "droidSpawner", "pathNode", "creepDen"] },
    ];

    for (const group of groupDefinitions) {
      const groupDiv = document.createElement("div");
      groupDiv.style.display = "flex";
      groupDiv.style.alignItems = "center";
      groupDiv.style.gap = "4px";
      groupDiv.style.padding = "0 6px";
      if (group !== groupDefinitions[0]) {
        groupDiv.style.borderLeft = "1px solid #2c3354";
      }

      const label = document.createElement("span");
      label.textContent = group.name;
      label.style.color = "#9fb4ff";
      label.style.marginRight = "4px";
      label.style.fontSize = "10px";
      label.style.textTransform = "uppercase";
      label.style.letterSpacing = "0.5px";
      groupDiv.appendChild(label);

      for (const type of group.types) {
        const spec = ENTITY_TYPES.find((s) => s.type === type);
        if (!spec) continue;
        const b = document.createElement("button");
        b.textContent = spec.label;
        b.title = `place a ${spec.label}`;
        b.dataset.entity = spec.type;
        b.style.borderBottom = `2px solid ${spec.color}`;
        b.addEventListener("click", () => {
          this.tool = "entity";
          this.newEntityType = spec.type;
          this.draft = [];
          this.syncToolButtons();
        });
        groupDiv.appendChild(b);
      }
      entityPalette.appendChild(groupDiv);
    }

    const topDiv = document.createElement("div");
    topDiv.className = "editor-divider";
    topBar.appendChild(topDiv);

    const actions: [string, string, string, () => void][] = [
      ["bg", "Set Background", "", () => this.uploadBackground()],
      ["undo", "Undo", "", () => this.undo()],
      ["redo", "Redo", "", () => this.redo()],
      ["export", "Export", "", () => this.exportJson()],
      ["import", "Import", "", () => this.importJson()],
      ["new", "New", "", () => this.confirmNew()],
    ];
    for (const [id, label, hotkey, fn] of actions) {
      const b = document.createElement("button");
      b.title = label;
      if (icons[id]) b.appendChild(createIcon(icons[id]));
      const span = document.createElement("span");
      span.textContent = label;
      b.appendChild(span);
      if (hotkey) {
        const kbd = document.createElement("kbd");
        kbd.textContent = hotkey;
        b.appendChild(kbd);
      }
      b.addEventListener("click", fn);
      topBar.appendChild(b);
    }

    const bgScaleDiv = document.createElement("div");
    bgScaleDiv.id = "editor-bg-scale";
    bgScaleDiv.style.display = "none";
    bgScaleDiv.style.alignItems = "center";
    bgScaleDiv.style.gap = "4px";
    bgScaleDiv.style.marginLeft = "auto";
    bgScaleDiv.style.padding = "0 8px";

    const bgScaleLabel = document.createElement("span");
    bgScaleLabel.textContent = "BG Scale:";
    bgScaleLabel.style.fontSize = "10px";
    bgScaleLabel.style.color = "#9fb4ff";

    const bgScaleInput = document.createElement("input");
    bgScaleInput.type = "number";
    bgScaleInput.step = "0.01";
    bgScaleInput.value = "1.0";
    bgScaleInput.style.width = "50px";
    bgScaleInput.style.background = "#10142a";
    bgScaleInput.style.color = "#ffffff";
    bgScaleInput.style.border = "1px solid #2c3354";
    bgScaleInput.style.borderRadius = "4px";
    bgScaleInput.style.padding = "2px 4px";
    bgScaleInput.addEventListener("input", () => {
      if (this.bgSprite) {
        const scale = parseFloat(bgScaleInput.value) || 1.0;
        this.bgSprite.scale.set(scale);
      }
    });

    bgScaleDiv.appendChild(bgScaleLabel);
    bgScaleDiv.appendChild(bgScaleInput);
    topBar.appendChild(bgScaleDiv);

    const btnMirror = document.createElement("button");
    btnMirror.title = "Toggle Mirror Mode";
    btnMirror.dataset.action = "mirror";
    btnMirror.innerHTML = `<span>Mirror</span><kbd>M</kbd>`;
    btnMirror.addEventListener("click", () => {
      this.mirrorMode = !this.mirrorMode;
      this.updateStatus();
      this.syncToolButtons();
    });
    bottomBar.appendChild(btnMirror);

    const botDiv = document.createElement("div");
    botDiv.className = "editor-divider";
    bottomBar.appendChild(botDiv);

    const snapSelect = document.createElement("select");
    snapSelect.title = "grid snap";
    for (const v of [1.0, 0.5, 0.25, 0.1, 0]) {
      const o = document.createElement("option");
      o.value = v.toString();
      o.textContent = v === 0 ? "snap: OFF" : `snap: ${v}`;
      if (v === 0.5) o.selected = true;
      snapSelect.appendChild(o);
    }
    snapSelect.addEventListener("change", () => {
      this.snapVal = parseFloat(snapSelect.value) || null;
      this.updateStatus();
    });
    bottomBar.appendChild(snapSelect);

    const status = document.createElement("span");
    status.id = "editorstatus";
    bottomBar.appendChild(status);
    this.statusEl = status;

    const warnings = document.createElement("span");
    warnings.id = "editorwarnings";
    warnings.style.color = "#ffca28";
    warnings.style.marginLeft = "12px";
    warnings.style.fontWeight = "bold";
    bottomBar.appendChild(warnings);
    this.warningsEl = warnings;

    const inspector = document.createElement("div");
    inspector.id = "inspector";
    inspector.style.display = "none";
    document.body.appendChild(inspector);
    this.inspector = inspector;

    this.syncToolButtons();
  }

  private syncToolButtons(): void {
    for (const b of this.bar.querySelectorAll("button[data-tool]")) {
      b.classList.toggle("active", (b as HTMLElement).dataset.tool === this.tool);
    }
    for (const b of this.bar.querySelectorAll("button[data-entity]")) {
      b.classList.toggle(
        "active",
        this.tool === "entity" && (b as HTMLElement).dataset.entity === this.newEntityType,
      );
    }
    const mirrorBtn = this.bar.querySelector("button[data-action='mirror']");
    if (mirrorBtn) {
      mirrorBtn.classList.toggle("active", this.mirrorMode);
    }

    const solSelect = this.bar.querySelector<HTMLElement>("select[data-id='sol-select']");
    const solDivider = this.bar.querySelector<HTMLElement>("div[data-id='sol-divider']");
    if (solSelect && solDivider) {
      const showSol = ["brush", "rect", "polygon"].includes(this.tool);
      solSelect.style.display = showSol ? "" : "none";
      solDivider.style.display = showSol ? "" : "none";
    }
  }

  private validateMap(): string[] {
    const warnings: string[] = [];
    const redSpawns = this.doc.playerSpawns.filter((p) => p[2] === "RED").length;
    const bluSpawns = this.doc.playerSpawns.filter((p) => p[2] === "BLU").length;
    if (redSpawns === 0) warnings.push("Missing RED player spawn");
    if (bluSpawns === 0) warnings.push("Missing BLU player spawn");

    let hasRedCore = false;
    let hasBluCore = false;
    for (const e of this.doc.entities) {
      if (e.type === "base") {
        if (e.params?.team === "RED" || e.params?.team === "A") hasRedCore = true;
        if (e.params?.team === "BLU" || e.params?.team === "B") hasBluCore = true;
      }
    }
    // Only warn about base cores if it looks like a full map with entities
    if (this.doc.entities.length > 5) {
      if (!hasRedCore) warnings.push("Missing RED base core");
      if (!hasBluCore) warnings.push("Missing BLU base core");
    }

    const allIds = new Set<string>();
    for (const s of this.doc.shapes) allIds.add(s.id);
    for (const e of this.doc.entities) allIds.add(e.id);

    for (const e of this.doc.entities) {
      const checkIds = (ids: string[] | undefined, name: string) => {
        if (!ids) return;
        for (const id of ids) {
          if (id && !allIds.has(id)) warnings.push(`Broken ${name} link: '${id}'`);
        }
      };
      checkIds(e.targets, "target");
      checkIds(e.onDestroyed, "onDestroyed");

      const spec = entityTypeSpec(e.type);
      if (spec && e.params) {
        for (const [key, p] of Object.entries(spec.params)) {
          if (p.kind === "entityId") {
            const val = e.params[key];
            if (typeof val === "string" && val !== "" && !allIds.has(val)) {
              warnings.push(`Broken '${key}' link: '${val}'`);
            }
          }
        }
      }
    }
    return warnings;
  }

  private updateStatus(): void {
    this.statusEl.textContent = ` zoom ${this.cam.scale.toFixed(2)} · Tab to play`;
    const warnings = this.validateMap();
    if (warnings.length > 0) {
      this.warningsEl.textContent = ` ⚠️ ${warnings.join(" · ")}`;
    } else {
      this.warningsEl.textContent = " ✔️ Map OK";
      this.warningsEl.style.color = "#66ff8c";
    }
    if (warnings.length > 0) {
      this.warningsEl.style.color = "#ffca28";
    }
  }

  private refreshInspector(): void {
    const panel = this.inspector;
    panel.innerHTML = "";
    if (!this.active || this.selection.length === 0) {
      panel.style.display = "none";
      if (this.renderer.canvasElement) {
        this.renderer.canvasElement.style.cursor = "default";
      }
      return;
    }
    panel.style.display = "block";

    if (this.renderer.canvasElement) {
      this.renderer.canvasElement.style.cursor =
        this.linkingField !== null ? "crosshair" : "default";
    }

    if (this.selection.length > 1) {
      const heading = document.createElement("h4");
      heading.textContent = `${this.selection.length} items selected`;
      panel.appendChild(heading);
      return;
    }
    const sel = this.selection[0];
    if (!sel) return;

    // Position panel near the selected item
    let targetPos: { x: number; y: number } | null = null;
    let targetSize = { w: 1, h: 1 };

    if (sel.kind === "shape") {
      const s = this.doc.shapes.find(
        (sh) => sh.id === (sel as Extract<Selection, { id: string }>).id,
      );
      if (s) {
        if (s.kind === "rect") {
          targetPos = { x: s.pos[0], y: s.pos[1] };
          targetSize = { w: s.size[0], h: s.size[1] };
        } else if (s.kind === "arc") {
          targetPos = { x: s.center[0], y: s.center[1] };
          targetSize = { w: s.radius * 2, h: s.radius * 2 };
        } else if (s.points && s.points.length > 0) {
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          for (const p of s.points) {
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
          }
          targetPos = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
          targetSize = { w: maxX - minX, h: maxY - minY };
        }
      }
    } else if (sel.kind === "entity") {
      const e = this.doc.entities.find(
        (en) => en.id === (sel as Extract<Selection, { id: string }>).id,
      );
      if (e) {
        const [w, h] = this.entitySize(e);
        targetPos = { x: e.pos[0], y: e.pos[1] };
        targetSize = { w, h };
      }
    } else if (sel.kind === "spawn") {
      const p = this.doc.playerSpawns[(sel as Extract<Selection, { index: number }>).index];
      if (p) {
        targetPos = { x: p[0], y: p[1] };
        targetSize = { w: 1, h: 1.6 };
      }
    } else if (sel.kind === "dummy") {
      const p = this.doc.dummySpawns[(sel as Extract<Selection, { index: number }>).index];
      if (p) {
        targetPos = { x: p[0], y: p[1] };
        targetSize = { w: 1, h: 2 };
      }
    }

    if (targetPos) {
      const screenPos = this.toScreen(
        targetPos.x + targetSize.w / 2 + 0.5,
        targetPos.y - targetSize.h / 2,
      );
      panel.style.position = "absolute";

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      let left = screenPos.x;
      let top = screenPos.y;

      if (left + 240 > screenW) {
        const screenPosLeft = this.toScreen(
          targetPos.x - targetSize.w / 2 - 0.5,
          targetPos.y - targetSize.h / 2,
        );
        left = screenPosLeft.x - 240;
      }

      left = Math.max(10, Math.min(screenW - 240, left));
      top = Math.max(10, Math.min(screenH - 350, top));

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.bottom = "auto";
      panel.style.right = "auto";
    } else {
      panel.style.position = "fixed";
      panel.style.bottom = "8px";
      panel.style.right = "8px";
      panel.style.left = "auto";
      panel.style.top = "auto";
    }

    // Create datalist for autocompletion of entity IDs
    const datalist = document.createElement("datalist");
    datalist.id = "entity-ids-list";
    for (const other of this.doc.entities) {
      if (sel.kind === "entity" && other.id === (sel as Extract<Selection, { id: string }>).id)
        continue;
      const opt = document.createElement("option");
      opt.value = other.id;
      datalist.appendChild(opt);
    }
    panel.appendChild(datalist);

    if (this.linkingField !== null) {
      const banner = document.createElement("div");
      banner.textContent = "🔗 Linking Mode: Click viewport entity to target";
      banner.style.background = "#ff2bd6";
      banner.style.color = "#ffffff";
      banner.style.padding = "4px 8px";
      banner.style.borderRadius = "4px";
      banner.style.marginBottom = "8px";
      banner.style.textAlign = "center";
      banner.style.fontWeight = "bold";
      panel.appendChild(banner);
    }

    const heading = document.createElement("h4");
    panel.appendChild(heading);

    if (sel.kind === "shape") {
      const s = this.doc.shapes.find(
        (sh) => sh.id === (sel as Extract<Selection, { id: string }>).id,
      );
      if (!s) return;
      heading.textContent = `${s.kind} · ${s.id}`;

      const layerControls = document.createElement("div");
      layerControls.style.display = "flex";
      layerControls.style.gap = "4px";
      layerControls.style.marginBottom = "8px";
      const btnBack = document.createElement("button");
      btnBack.textContent = "to back";
      btnBack.addEventListener("click", () => {
        this.beginChange();
        this.doc.shapes = this.doc.shapes.filter((x) => x.id !== s.id);
        this.doc.shapes.unshift(s);
        this.changed();
      });
      const btnFront = document.createElement("button");
      btnFront.textContent = "to front";
      btnFront.addEventListener("click", () => {
        this.beginChange();
        this.doc.shapes = this.doc.shapes.filter((x) => x.id !== s.id);
        this.doc.shapes.push(s);
        this.changed();
      });
      layerControls.appendChild(btnBack);
      layerControls.appendChild(btnFront);
      panel.appendChild(layerControls);

      const solLabel = document.createElement("label");
      solLabel.textContent = "solidity";
      const sol = document.createElement("select");
      for (const opt of SOLIDITY_OPTIONS) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = formatSolidity(opt);
        o.selected = s.solidity === opt;
        sol.appendChild(o);
      }
      sol.addEventListener("change", () => {
        this.beginChange();
        s.solidity = sol.value as Solidity;
        this.changed();
      });
      solLabel.appendChild(sol);
      panel.appendChild(solLabel);

      const tintLabel = document.createElement("label");
      tintLabel.textContent = "tint";
      const tint = document.createElement("input");
      tint.type = "color";
      tint.value = s.tint ?? "#2c3354";
      tint.addEventListener("input", () => {
        this.beginChange();
        s.tint = tint.value;
        this.changed();
      });
      tintLabel.appendChild(tint);
      panel.appendChild(tintLabel);

      if (s.kind === "rect") {
        const rotLabel = document.createElement("label");
        rotLabel.textContent = "rotation";
        const rot = document.createElement("input");
        rot.type = "number";
        rot.step = "any";
        rot.value = String(s.rotation ?? 0);
        rot.addEventListener("input", () => {
          const v = Number.parseFloat(rot.value);
          if (Number.isFinite(v)) {
            this.beginChange();
            s.rotation = v;
            this.changed();
          }
        });
        rotLabel.appendChild(rot);
        panel.appendChild(rotLabel);
      }

      if (s.kind === "rect" || s.kind === "polygon") {
        const convertDiv = document.createElement("div");
        convertDiv.style.marginTop = "12px";
        convertDiv.style.paddingTop = "8px";
        convertDiv.style.borderTop = "1px solid #2c3354";
        convertDiv.style.display = "flex";
        convertDiv.style.flexDirection = "column";
        convertDiv.style.gap = "4px";

        const convertLabel = document.createElement("label");
        convertLabel.textContent = "Convert to Entity:";
        convertLabel.style.color = "#ffca28";
        convertDiv.appendChild(convertLabel);

        const convertSelect = document.createElement("select");
        for (const spec of ENTITY_TYPES) {
          const opt = document.createElement("option");
          opt.value = spec.type;
          opt.textContent = spec.label;
          convertSelect.appendChild(opt);
        }
        convertDiv.appendChild(convertSelect);

        const convertBtn = document.createElement("button");
        convertBtn.textContent = "Convert";
        convertBtn.style.marginTop = "4px";
        convertBtn.addEventListener("click", () => {
          this.beginChange();
          let cx = 0,
            cy = 0,
            w = 1,
            h = 1;
          if (s.kind === "rect") {
            cx = s.pos[0];
            cy = s.pos[1];
            w = s.size[0];
            h = s.size[1];
          } else if (s.kind === "polygon" && s.points) {
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity;
            for (const p of s.points) {
              if (p[0] < minX) minX = p[0];
              if (p[0] > maxX) maxX = p[0];
              if (p[1] < minY) minY = p[1];
              if (p[1] > maxY) maxY = p[1];
            }
            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;
            w = Math.max(0.1, maxX - minX);
            h = Math.max(0.1, maxY - minY);
          }

          const spec = entityTypeSpec(convertSelect.value);
          if (!spec) return;

          const newEntity: EntityDef = {
            id: `e_${Math.random().toString(36).slice(2, 8)}`,
            // biome-ignore lint/suspicious/noExplicitAny: dynamic type
            type: convertSelect.value as any,
            pos: [cx, cy],
            size: [w, h],
            enabled: true,
            tint: s.tint,
            // biome-ignore lint/suspicious/noExplicitAny: dynamic type
            params: defaultParams(spec) as any,
          };

          this.doc.entities.push(newEntity);
          this.selection = [{ kind: "entity", id: newEntity.id }];
          this.changed();
        });
        convertDiv.appendChild(convertBtn);
        panel.appendChild(convertDiv);
      }
    } else if (sel.kind === "entity") {
      const e = this.doc.entities.find(
        (en) => en.id === (sel as Extract<Selection, { id: string }>).id,
      );
      if (!e) return;
      const spec = entityTypeSpec(e.type);
      heading.textContent = `${spec?.label ?? e.type} · ${e.id}`;

      const layerControls = document.createElement("div");
      layerControls.style.display = "flex";
      layerControls.style.gap = "4px";
      layerControls.style.marginBottom = "8px";
      const btnBack = document.createElement("button");
      btnBack.textContent = "to back";
      btnBack.addEventListener("click", () => {
        this.beginChange();
        this.doc.entities = this.doc.entities.filter((x) => x.id !== e.id);
        this.doc.entities.unshift(e);
        this.changed();
      });
      const btnFront = document.createElement("button");
      btnFront.textContent = "to front";
      btnFront.addEventListener("click", () => {
        this.beginChange();
        this.doc.entities = this.doc.entities.filter((x) => x.id !== e.id);
        this.doc.entities.push(e);
        this.changed();
      });
      layerControls.appendChild(btnBack);
      layerControls.appendChild(btnFront);
      panel.appendChild(layerControls);

      const enLabel = document.createElement("label");
      enLabel.textContent = "enabled";
      const en = document.createElement("input");
      en.type = "checkbox";
      en.checked = e.enabled !== false;
      en.addEventListener("change", () => {
        this.beginChange();
        e.enabled = en.checked;
        this.changed();
      });
      enLabel.appendChild(en);
      panel.appendChild(enLabel);

      const tintLabel = document.createElement("label");
      tintLabel.textContent = "tint";
      const tint = document.createElement("input");
      tint.type = "color";
      tint.value = e.tint ?? spec?.color ?? "#ffffff";
      tint.addEventListener("input", () => {
        this.beginChange();
        e.tint = tint.value;
        this.changed();
      });
      tintLabel.appendChild(tint);
      panel.appendChild(tintLabel);

      // targets input
      const targetsLabel = document.createElement("label");
      targetsLabel.textContent = "targets";

      const targetsWrapper = document.createElement("div");
      targetsWrapper.style.display = "flex";
      targetsWrapper.style.gap = "4px";
      targetsWrapper.style.alignItems = "center";
      targetsWrapper.style.flex = "1";
      targetsWrapper.style.justifyContent = "flex-end";

      const targetsInput = document.createElement("input");
      targetsInput.type = "text";
      targetsInput.placeholder = "e.g., door1, barrier2";
      targetsInput.value = (e.targets ?? []).join(", ");
      targetsInput.setAttribute("list", "entity-ids-list");
      targetsInput.style.flex = "1";
      targetsInput.style.minWidth = "0";
      targetsInput.addEventListener("change", () => {
        this.beginChange();
        const ids = targetsInput.value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (ids.length > 0) {
          e.targets = ids;
        } else {
          delete e.targets;
        }
        this.changed();
      });

      const targetsLinkBtn = document.createElement("button");
      targetsLinkBtn.type = "button";
      targetsLinkBtn.textContent = "🔗";
      targetsLinkBtn.title =
        "Link to entity (click to enter linking mode, then click an entity in viewport)";
      targetsLinkBtn.addEventListener("click", () => {
        this.linkingField = { type: "targets", entityId: e.id };
        this.refreshInspector();
      });

      targetsWrapper.appendChild(targetsInput);
      targetsWrapper.appendChild(targetsLinkBtn);
      targetsLabel.appendChild(targetsWrapper);
      panel.appendChild(targetsLabel);

      // onDestroyed input
      const onDestroyedLabel = document.createElement("label");
      onDestroyedLabel.textContent = "onDestroyed";

      const onDestroyedWrapper = document.createElement("div");
      onDestroyedWrapper.style.display = "flex";
      onDestroyedWrapper.style.gap = "4px";
      onDestroyedWrapper.style.alignItems = "center";
      onDestroyedWrapper.style.flex = "1";
      onDestroyedWrapper.style.justifyContent = "flex-end";

      const onDestroyedInput = document.createElement("input");
      onDestroyedInput.type = "text";
      onDestroyedInput.placeholder = "e.g., door1, barrier2";
      onDestroyedInput.value = (e.onDestroyed ?? []).join(", ");
      onDestroyedInput.setAttribute("list", "entity-ids-list");
      onDestroyedInput.style.flex = "1";
      onDestroyedInput.style.minWidth = "0";
      onDestroyedInput.addEventListener("change", () => {
        this.beginChange();
        const ids = onDestroyedInput.value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (ids.length > 0) {
          e.onDestroyed = ids;
        } else {
          delete e.onDestroyed;
        }
        this.changed();
      });

      const onDestroyedLinkBtn = document.createElement("button");
      onDestroyedLinkBtn.type = "button";
      onDestroyedLinkBtn.textContent = "🔗";
      onDestroyedLinkBtn.title =
        "Link to entity (click to enter linking mode, then click an entity in viewport)";
      onDestroyedLinkBtn.addEventListener("click", () => {
        this.linkingField = { type: "onDestroyed", entityId: e.id };
        this.refreshInspector();
      });

      onDestroyedWrapper.appendChild(onDestroyedInput);
      onDestroyedWrapper.appendChild(onDestroyedLinkBtn);
      onDestroyedLabel.appendChild(onDestroyedWrapper);
      panel.appendChild(onDestroyedLabel);

      if (spec) {
        for (const [key, p] of Object.entries(spec.params)) {
          const row = document.createElement("label");
          row.textContent = p.label;
          if (!e.params) e.params = {};
          const params = e.params as Record<string, number | string | boolean>;
          const val = params[key] ?? (p.kind === "entityId" ? "" : p.default);

          if (p.kind === "boolean") {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!val;
            input.addEventListener("change", () => {
              this.beginChange();
              params[key] = input.checked;
              this.changed();
            });
            row.appendChild(input);
          } else if (p.kind === "entityId") {
            const paramWrapper = document.createElement("div");
            paramWrapper.style.display = "flex";
            paramWrapper.style.gap = "4px";
            paramWrapper.style.alignItems = "center";
            paramWrapper.style.flex = "1";
            paramWrapper.style.justifyContent = "flex-end";

            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "(none)";
            input.value = String(val);
            input.setAttribute("list", "entity-ids-list");
            input.style.flex = "1";
            input.style.minWidth = "0";
            input.addEventListener("change", () => {
              this.beginChange();
              params[key] = input.value;
              this.changed();
            });

            const linkBtn = document.createElement("button");
            linkBtn.type = "button";
            linkBtn.textContent = "🔗";
            linkBtn.title =
              "Link to entity (click to enter linking mode, then click an entity in viewport)";
            linkBtn.addEventListener("click", () => {
              this.linkingField = { type: { kind: "param", key }, entityId: e.id };
              this.refreshInspector();
            });

            paramWrapper.appendChild(input);
            paramWrapper.appendChild(linkBtn);
            row.appendChild(paramWrapper);
          } else if (p.kind === "select") {
            const sel = document.createElement("select");
            for (const opt of p.options) {
              const o = document.createElement("option");
              o.value = opt;
              o.textContent = opt;
              o.selected = opt === val;
              sel.appendChild(o);
            }
            sel.addEventListener("change", () => {
              this.beginChange();
              params[key] = sel.value;
              this.changed();
            });
            row.appendChild(sel);
          } else {
            const input = document.createElement("input");
            input.type = "number";
            if (p.kind === "number") {
              if (p.min !== undefined) input.min = String(p.min);
              if (p.max !== undefined) input.max = String(p.max);
              if (p.step !== undefined) input.step = String(p.step);
              else input.step = "any";
            } else if (p.kind === "duration") {
              input.min = "0";
              input.step = "any";
            } else {
              input.step = "any";
            }
            input.value = String(val);
            input.addEventListener("input", () => {
              const v = Number.parseFloat(input.value);
              if (Number.isFinite(v)) {
                this.beginChange();
                params[key] = v;
                this.changed();
              }
            });
            row.appendChild(input);
          }
          panel.appendChild(row);
        }
      }
    } else {
      heading.textContent = sel.kind === "spawn" ? "player spawn" : "dummy";
      if (sel.kind === "spawn") {
        const p = this.doc.playerSpawns[(sel as Extract<Selection, { index: number }>).index];
        if (p) {
          const teamLabel = document.createElement("label");
          teamLabel.textContent = "team";
          const teamSelect = document.createElement("select");
          for (const t of ["RED", "BLU"]) {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            opt.selected = p[2] === t;
            teamSelect.appendChild(opt);
          }
          teamSelect.addEventListener("change", () => {
            this.beginChange();
            p[2] = teamSelect.value as "RED" | "BLU";
            this.changed();
          });
          teamLabel.appendChild(teamSelect);
          panel.appendChild(teamLabel);
        }
      }
    }

    const del = document.createElement("button");
    del.textContent = "delete";
    del.addEventListener("click", () => this.deleteSelection());
    panel.appendChild(del);
  }

  // ---------- import/export ----------

  private exportJson(): void {
    const blob = new Blob([JSON.stringify(docToDef(this.doc), null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.doc.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private uploadBackground(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const texture = await Assets.load({
        src: url,
        parser: "texture",
      });
      if (!this.bgSprite) {
        this.bgSprite = new Sprite(texture);
        this.bgSprite.alpha = 0.5;
        this.renderer.world.addChildAt(this.bgSprite, 0);
        const scaleDiv = this.bar.querySelector<HTMLElement>("#editor-bg-scale");
        if (scaleDiv) scaleDiv.style.display = "flex";
      } else {
        this.bgSprite.texture = texture;
      }
    };
    input.click();
  }

  private importJson(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        this.history.push(this.doc);
        this.replaceDoc(docFromJson(await file.text()));
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    input.click();
  }

  private confirmNew(): void {
    if (!confirm("Start a new blank map? (current map stays in undo history)")) return;
    this.history.push(this.doc);
    const newDoc = blankDoc();
    newDoc.id = `custom-map-${Math.random().toString(36).substring(2, 8)}`;
    newDoc.name = "New Custom Map";

    // Save to storage and switch
    localStorage.setItem(`cosmonauts.editor.mapdoc.${newDoc.id}`, JSON.stringify(docToDef(newDoc)));
    this.onSwitchMap?.(newDoc.id);
  }
}

function distToSeg(p: Vec2, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / len2));
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy));
}

function drawArrow(
  g: import("pixi.js").Graphics,
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
