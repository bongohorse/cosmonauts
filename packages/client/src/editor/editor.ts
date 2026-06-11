import { defaultParams, ENTITY_TYPES, type EntityDef, entityTypeSpec } from "@cosmonauts/content";
import type { ShapeDef, Solidity, Vec2 } from "@cosmonauts/sim";
import type { Renderer } from "../renderer";
import { TILE_PX } from "../renderer";
import {
  blankDoc,
  clearStorage,
  compileDoc,
  docFromJson,
  docToDef,
  type MapDoc,
  saveToStorage,
} from "./doc";
import { History } from "./history";

type Tool = "select" | "rect" | "polygon" | "spawn" | "dummy" | "entity";

type Selection =
  | { kind: "shape"; id: string }
  | { kind: "entity"; id: string }
  | { kind: "spawn"; index: number }
  | { kind: "dummy"; index: number };

type Drag =
  | { type: "pan"; sx: number; sy: number; camX: number; camY: number }
  | { type: "move"; last: Vec2 }
  | { type: "resize"; corner: number }
  | { type: "rotate" }
  | { type: "draw-rect"; start: Vec2; current: Vec2 };

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

const SOLIDITY_OPTIONS: Solidity[] = ["solid", "glass", "teamA", "teamB"];

/**
 * In-game map editor MVP (doc 08 §1): geometry + spawn/dummy placement on the
 * running map. Tab (handled by main.ts) flips between editing and playing.
 */
export class Editor {
  doc: MapDoc;
  active = false;
  private tool: Tool = "select";
  private selection: Selection | null = null;
  private cam = { x: 0, y: 0, scale: 1 };
  private drag: Drag | null = null;
  private draft: [number, number][] = [];
  private mouseWorld: Vec2 = { x: 0, y: 0 };
  private newSolidity: Solidity = "solid";
  private newEntityType = ENTITY_TYPES[0]?.type ?? "jumper";
  private snap = true;
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

  constructor(
    private renderer: Renderer,
    doc: MapDoc,
  ) {
    this.doc = doc;
    this.buildUi();
    this.attachPointerHandlers();
    this.attachKeyHandlers();
  }

  // ---------- mode ----------

  enter(): void {
    this.active = true;
    const t = this.renderer.cameraOverride ?? { x: 0, y: 0, scale: 1 };
    this.cam = { ...t };
    this.renderer.cameraOverride = this.cam;
    this.bar.style.display = "flex";
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
    this.selection = null;
    this.draft = [];
    this.changed();
    this.refreshInspector();
  }

  private undo(): void {
    const prev = this.history.undo(this.doc);
    if (prev !== null) {
      this.doc = prev;
      this.selection = null;
      this.changed();
      this.refreshInspector();
    }
  }

  private redo(): void {
    const next = this.history.redo(this.doc);
    if (next !== null) {
      this.doc = next;
      this.selection = null;
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
    return this.snap ? Math.round(v * 2) / 2 : v;
  }

  // ---------- selection helpers ----------

  private selectedShape(): ShapeDef | null {
    const sel = this.selection;
    if (sel === null || sel.kind !== "shape") return null;
    return this.doc.shapes.find((s) => s.id === sel.id) ?? null;
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
        if (hit !== null && hit.kind === "entity") {
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
        }
        const hit = this.hitTest(w);
        this.selection = hit;
        this.refreshInspector();
        if (hit !== null) {
          this.beginChange();
          this.drag = { type: "move", last: w };
        }
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
        this.doc.playerSpawns.push([this.snapPt(w.x), this.snapPt(w.y)]);
        this.changed();
        break;
      case "dummy":
        this.beginChange();
        this.doc.dummySpawns.push([this.snapPt(w.x), this.snapPt(w.y)]);
        this.changed();
        break;
      case "entity":
        this.placeEntity(w);
        break;
    }
  }

  private placeEntity(w: Vec2): void {
    const spec = entityTypeSpec(this.newEntityType);
    if (spec === undefined) return;
    this.beginChange();
    const id = this.nextEntityId(spec.type);
    this.doc.entities.push({
      id,
      type: spec.type,
      pos: [this.snapPt(w.x), this.snapPt(w.y)],
      size: [...spec.defaultSize],
      params: defaultParams(spec),
    } as EntityDef);
    this.selection = { kind: "entity", id };
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
        drag.current = w;
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
      case "resize": {
        const s = this.selectedShape();
        if (s !== null && s.kind === "rect") {
          this.resizeRect(s, drag.corner, w);
          this.changed();
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
        }
        break;
      }
    }
  }

  private pointerUp(e: PointerEvent): void {
    const drag = this.drag;
    this.drag = null;
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
        this.doc.shapes.push({
          id,
          kind: "rect",
          solidity: this.newSolidity,
          pos: [(x0 + x1) / 2, (y0 + y1) / 2],
          size: [wdt, hgt],
          rotation: 0,
        });
        this.selection = { kind: "shape", id };
        this.tool = "select";
        this.syncToolButtons();
        this.changed();
        this.refreshInspector();
      }
    }
  }

  private moveSelection(dx: number, dy: number): void {
    const sel = this.selection;
    if (sel === null) return;
    if (sel.kind === "shape") {
      const s = this.doc.shapes.find((sh) => sh.id === sel.id);
      if (s) this.translateShape(s, dx, dy);
    } else if (sel.kind === "entity") {
      const e = this.doc.entities.find((en) => en.id === sel.id);
      if (e) e.pos = [e.pos[0] + dx, e.pos[1] + dy];
    } else if (sel.kind === "spawn") {
      const p = this.doc.playerSpawns[sel.index];
      if (p) this.doc.playerSpawns[sel.index] = [p[0] + dx, p[1] + dy];
    } else {
      const p = this.doc.dummySpawns[sel.index];
      if (p) this.doc.dummySpawns[sel.index] = [p[0] + dx, p[1] + dy];
    }
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
    if (this.snap) {
      lx = Math.round(lx * 2) / 2;
      ly = Math.round(ly * 2) / 2;
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
    this.draft = [];
    this.selection = { kind: "shape", id };
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
    const sel = this.selection;
    if (sel === null) return;
    this.beginChange();
    if (sel.kind === "shape") {
      this.doc.shapes = this.doc.shapes.filter((s) => s.id !== sel.id);
    } else if (sel.kind === "entity") {
      this.doc.entities = this.doc.entities.filter((e) => e.id !== sel.id);
    } else if (sel.kind === "spawn") {
      if (this.doc.playerSpawns.length > 1) this.doc.playerSpawns.splice(sel.index, 1);
    } else {
      this.doc.dummySpawns.splice(sel.index, 1);
    }
    this.selection = null;
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
        this.selection = null;
        this.refreshInspector();
      } else if (e.code === "Enter") this.finishDraft();
      else if (e.code === "KeyG") {
        this.snap = !this.snap;
        this.updateStatus();
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
    for (const [x, y] of this.doc.playerSpawns) {
      g.circle(px(x), px(y), px(0.35)).fill({ color: 0x66ff8c, alpha: 0.9 });
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
      const color = Number.parseInt((e.tint ?? spec?.color ?? "#ffffff").slice(1), 16);
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

    // Polygon draft.
    if (this.draft.length > 0) {
      const first = this.draft[0];
      if (first) g.moveTo(px(first[0]), px(first[1]));
      for (const [x, y] of this.draft.slice(1)) g.lineTo(px(x), px(y));
      g.lineTo(px(this.mouseWorld.x), px(this.mouseWorld.y));
      g.stroke({ color: 0xffd166, width: lw(2) });
      for (const [x, y] of this.draft) g.circle(px(x), px(y), lw(4)).fill(0xffd166);
    }

    // Rect-draw preview.
    if (this.drag?.type === "draw-rect") {
      const { start, current } = this.drag;
      g.rect(
        px(Math.min(start.x, current.x)),
        px(Math.min(start.y, current.y)),
        px(Math.abs(current.x - start.x)),
        px(Math.abs(current.y - start.y)),
      ).stroke({ color: 0xffd166, width: lw(2) });
    }

    // Selection.
    const sel = this.selection;
    if (sel?.kind === "shape") {
      const s = this.doc.shapes.find((sh) => sh.id === sel.id);
      if (s) this.drawShapeSelection(g, s, lw);
    } else if (sel?.kind === "entity") {
      const e = this.doc.entities.find((en) => en.id === sel.id);
      if (e) {
        const [w, h] = this.entitySize(e);
        const rotation = typeof e.params?.rotation === "number" ? e.params.rotation : 0;
        if (rotation !== 0) {
          const pts = getRotatedRectPoints(px(e.pos[0]), px(e.pos[1]), px(w), px(h), rotation);
          g.poly(pts).stroke({
            color: 0xff2bd6,
            width: lw(2),
          });
        } else {
          g.rect(px(e.pos[0] - w / 2), px(e.pos[1] - h / 2), px(w), px(h)).stroke({
            color: 0xff2bd6,
            width: lw(2),
          });
        }
      }
    } else if (sel?.kind === "spawn") {
      const p = this.doc.playerSpawns[sel.index];
      if (p) g.circle(px(p[0]), px(p[1]), px(0.5)).stroke({ color: 0xffffff, width: lw(2) });
    } else if (sel?.kind === "dummy") {
      const p = this.doc.dummySpawns[sel.index];
      if (p)
        g.rect(px(p[0]) - px(0.4), px(p[1]) - px(0.55), px(0.8), px(1.1)).stroke({
          color: 0xffffff,
          width: lw(2),
        });
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
    const bar = document.createElement("div");
    bar.id = "editorbar";
    bar.style.display = "none";
    document.body.appendChild(bar);
    this.bar = bar;

    const title = document.createElement("strong");
    title.textContent = "EDIT";
    bar.appendChild(title);

    const tools: [Tool, string][] = [
      ["select", "Select (V)"],
      ["rect", "Rect"],
      ["polygon", "Polygon (dblclick/Enter to close)"],
      ["spawn", "Spawn"],
      ["dummy", "Dummy"],
    ];
    for (const [tool, tip] of tools) {
      const b = document.createElement("button");
      b.textContent = tool;
      b.title = tip;
      b.dataset.tool = tool;
      b.addEventListener("click", () => {
        this.tool = tool;
        this.draft = [];
        this.syncToolButtons();
      });
      bar.appendChild(b);
    }

    const sol = document.createElement("select");
    sol.title = "solidity for new shapes";
    for (const s of SOLIDITY_OPTIONS) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      sol.appendChild(o);
    }
    sol.addEventListener("change", () => {
      this.newSolidity = sol.value as Solidity;
    });
    bar.appendChild(sol);

    // Entity palette: generated from the registry — new types auto-appear
    // (doc 07 §1). One click-to-place button per type, tinted to match.
    const sep = document.createElement("span");
    sep.textContent = "·";
    bar.appendChild(sep);
    for (const spec of ENTITY_TYPES) {
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
      bar.appendChild(b);
    }

    const actions: [string, () => void][] = [
      ["undo", () => this.undo()],
      ["redo", () => this.redo()],
      ["export", () => this.exportJson()],
      ["import", () => this.importJson()],
      ["new", () => this.confirmNew()],
    ];
    for (const [label, fn] of actions) {
      const b = document.createElement("button");
      b.textContent = label;
      b.addEventListener("click", fn);
      bar.appendChild(b);
    }

    const status = document.createElement("span");
    status.id = "editorstatus";
    bar.appendChild(status);
    this.statusEl = status;

    const inspector = document.createElement("div");
    inspector.id = "inspector";
    inspector.style.display = "none";
    document.body.appendChild(inspector);
    this.inspector = inspector;

    this.syncToolButtons();
  }

  private syncToolButtons(): void {
    for (const b of this.bar.querySelectorAll("button[data-tool]")) {
      b.classList.toggle("active", (b as HTMLButtonElement).dataset.tool === this.tool);
    }
    for (const b of this.bar.querySelectorAll("button[data-entity]")) {
      b.classList.toggle(
        "active",
        this.tool === "entity" && (b as HTMLButtonElement).dataset.entity === this.newEntityType,
      );
    }
  }

  private updateStatus(): void {
    this.statusEl.textContent = ` snap ${this.snap ? "on" : "off"} (G) · zoom ${this.cam.scale.toFixed(2)} · Tab to play`;
  }

  private refreshInspector(): void {
    const sel = this.selection;
    const panel = this.inspector;
    panel.innerHTML = "";
    if (!this.active || sel === null) {
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

    // Position panel near the selected item
    let targetPos: { x: number; y: number } | null = null;
    let targetSize = { w: 1, h: 1 };

    if (sel.kind === "shape") {
      const s = this.doc.shapes.find((sh) => sh.id === sel.id);
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
      const e = this.doc.entities.find((en) => en.id === sel.id);
      if (e) {
        const [w, h] = this.entitySize(e);
        targetPos = { x: e.pos[0], y: e.pos[1] };
        targetSize = { w, h };
      }
    } else if (sel.kind === "spawn") {
      const p = this.doc.playerSpawns[sel.index];
      if (p) {
        targetPos = { x: p[0], y: p[1] };
        targetSize = { w: 1, h: 1.6 };
      }
    } else if (sel.kind === "dummy") {
      const p = this.doc.dummySpawns[sel.index];
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
      const s = this.doc.shapes.find((sh) => sh.id === sel.id);
      if (!s) return;
      heading.textContent = `${s.kind} · ${s.id}`;

      const solLabel = document.createElement("label");
      solLabel.textContent = "solidity";
      const sol = document.createElement("select");
      for (const opt of SOLIDITY_OPTIONS) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
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
    } else if (sel.kind === "entity") {
      const e = this.doc.entities.find((en) => en.id === sel.id);
      if (!e) return;
      const spec = entityTypeSpec(e.type);
      heading.textContent = `${spec?.label ?? e.type} · ${e.id}`;

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
    clearStorage();
    this.replaceDoc(blankDoc());
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
