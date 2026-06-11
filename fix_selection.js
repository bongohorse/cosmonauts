const fs = require("fs");
let code = fs.readFileSync("packages/client/src/editor/editor.ts", "utf8");

// 1. Drag type
code = code.replace(
  '| { type: "paint"; val: string };',
  '| { type: "paint"; val: string }\n  | { type: "box-select"; start: Vec2; current: Vec2 };',
);

// 2. selection property
code = code.replace(
  "private selection: Selection | null = null;",
  "private selection: Selection[] = [];",
);

// 3. Clear selections
code = code.replace(/this\.selection = null;/g, "this.selection = [];");

// 4. selectedShape
code = code.replace(
  `  private selectedShape(): ShapeDef | null {
    const sel = this.selection;
    if (sel === null || sel.kind !== "shape") return null;
    return this.doc.shapes.find((s) => s.id === sel.id) ?? null;
  }`,
  `  private selectedShape(): ShapeDef | null {
    if (this.selection.length !== 1) return null;
    const sel = this.selection[0];
    if (sel.kind !== "shape") return null;
    return this.doc.shapes.find((s) => s.id === sel.id) ?? null;
  }`,
);

// 5. selectedEntity
code = code.replace(
  `  private selectedEntity(): EntityDef | null {
    const sel = this.selection;
    if (sel === null || sel.kind !== "entity") return null;
    return this.doc.entities.find((e) => e.id === sel.id) ?? null;
  }`,
  `  private selectedEntity(): EntityDef | null {
    if (this.selection.length !== 1) return null;
    const sel = this.selection[0];
    if (sel.kind !== "entity") return null;
    return this.doc.entities.find((e) => e.id === sel.id) ?? null;
  }`,
);

// 6. deleteSelection
code = code.replace(
  `  private deleteSelection(): void {
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
    this.selection = [];
    this.changed();
    this.refreshInspector();
  }`,
  `  private deleteSelection(): void {
    if (this.selection.length === 0) return;
    this.beginChange();
    for (const sel of this.selection) {
      if (sel.kind === "shape") {
        this.doc.shapes = this.doc.shapes.filter((s) => s.id !== sel.id);
      } else if (sel.kind === "entity") {
        this.doc.entities = this.doc.entities.filter((e) => e.id !== sel.id);
      } else if (sel.kind === "spawn") {
        if (this.doc.playerSpawns.length > 1) this.doc.playerSpawns.splice(sel.index, 1);
      } else {
        this.doc.dummySpawns.splice(sel.index, 1);
      }
    }
    this.selection = [];
    this.changed();
    this.refreshInspector();
  }`,
);

// 7. duplicateSelection
code = code.replace(
  `  private duplicateSelection(): void {
    const sel = this.selection;
    if (sel === null) return;
    this.beginChange();
    if (sel.kind === "shape") {
      const s = this.doc.shapes.find(x => x.id === sel.id);
      if (s) {
        const copy = JSON.parse(JSON.stringify(s)) as ShapeDef;
        copy.id = this.nextShapeId();
        this.translateShape(copy, 0.5, 0.5);
        this.doc.shapes.push(copy);
        this.selection = { kind: "shape", id: copy.id };
      }
    } else if (sel.kind === "entity") {
      const e = this.doc.entities.find(x => x.id === sel.id);
      if (e) {
        const copy = JSON.parse(JSON.stringify(e)) as EntityDef;
        copy.id = this.nextEntityId(e.type);
        copy.pos[0] += 0.5;
        copy.pos[1] += 0.5;
        this.doc.entities.push(copy);
        this.selection = { kind: "entity", id: copy.id };
      }
    } else if (sel.kind === "spawn") {
      const p = this.doc.playerSpawns[sel.index];
      if (p) {
        this.doc.playerSpawns.push([p[0] + 0.5, p[1] + 0.5, p[2]]);
        this.selection = { kind: "spawn", index: this.doc.playerSpawns.length - 1 };
      }
    } else {
      const d = this.doc.dummySpawns[sel.index];
      if (d) {
        this.doc.dummySpawns.push([d[0] + 0.5, d[1] + 0.5]);
        this.selection = { kind: "dummy", index: this.doc.dummySpawns.length - 1 };
      }
    }
    this.changed();
    this.refreshInspector();
  }`,
  `  private duplicateSelection(): void {
    if (this.selection.length === 0) return;
    this.beginChange();
    const newSel = [];
    for (const sel of this.selection) {
      if (sel.kind === "shape") {
        const s = this.doc.shapes.find(x => x.id === sel.id);
        if (s) {
          const copy = JSON.parse(JSON.stringify(s));
          copy.id = this.nextShapeId();
          this.translateShape(copy, 0.5, 0.5);
          this.doc.shapes.push(copy);
          newSel.push({ kind: "shape", id: copy.id });
        }
      } else if (sel.kind === "entity") {
        const e = this.doc.entities.find(x => x.id === sel.id);
        if (e) {
          const copy = JSON.parse(JSON.stringify(e));
          copy.id = this.nextEntityId(e.type);
          copy.pos[0] += 0.5;
          copy.pos[1] += 0.5;
          this.doc.entities.push(copy);
          newSel.push({ kind: "entity", id: copy.id });
        }
      } else if (sel.kind === "spawn") {
        const p = this.doc.playerSpawns[sel.index];
        if (p) {
          this.doc.playerSpawns.push([p[0] + 0.5, p[1] + 0.5, p[2]]);
          newSel.push({ kind: "spawn", index: this.doc.playerSpawns.length - 1 });
        }
      } else {
        const d = this.doc.dummySpawns[sel.index];
        if (d) {
          this.doc.dummySpawns.push([d[0] + 0.5, d[1] + 0.5]);
          newSel.push({ kind: "dummy", index: this.doc.dummySpawns.length - 1 });
        }
      }
    }
    this.selection = newSel;
    this.changed();
    this.refreshInspector();
  }`,
);

// 8. moveSelection
code = code.replace(
  `  private moveSelection(dx: number, dy: number): void {
    const sel = this.selection;
    if (sel === null) return;
    const mw = this.doc.tiles[0]?.length ?? 48;
    if (sel.kind === "shape") {
      const s = this.doc.shapes.find((sh) => sh.id === sel.id);
      if (s) {
        let twin: ShapeDef | undefined;
        if (this.mirrorMode && s.kind === "rect") {
           twin = this.doc.shapes.find(sh => 
              sh.id !== s.id && sh.kind === "rect" && 
              Math.abs(sh.pos[0] - (mw - s.pos[0])) < 0.1 && 
              Math.abs(sh.pos[1] - s.pos[1]) < 0.1
           );
        }
        this.translateShape(s, dx, dy);
        if (twin) this.translateShape(twin, -dx, dy);
      }
    } else if (sel.kind === "entity") {
      const e = this.doc.entities.find((en) => en.id === sel.id);
      if (e) {
        let twin: EntityDef | undefined;
        if (this.mirrorMode) {
           twin = this.doc.entities.find(en => 
              en.id !== e.id && en.type === e.type && 
              Math.abs(en.pos[0] - (mw - e.pos[0])) < 0.1 && 
              Math.abs(en.pos[1] - e.pos[1]) < 0.1
           );
        }
        e.pos = [e.pos[0] + dx, e.pos[1] + dy];
        if (twin) twin.pos = [twin.pos[0] - dx, twin.pos[1] + dy];
      }
    } else if (sel.kind === "spawn") {
      const p = this.doc.playerSpawns[sel.index];
      if (p) {
        let twinIdx = -1;
        if (this.mirrorMode) {
          twinIdx = this.doc.playerSpawns.findIndex((other, idx) => 
            idx !== sel.index && Math.abs(other[0] - (mw - p[0])) < 0.1 && Math.abs(other[1] - p[1]) < 0.1
          );
        }
        this.doc.playerSpawns[sel.index] = [p[0] + dx, p[1] + dy, p[2]];
        if (twinIdx !== -1) {
          const twin = this.doc.playerSpawns[twinIdx];
          if (twin) this.doc.playerSpawns[twinIdx] = [twin[0] - dx, twin[1] + dy, twin[2]];
        }
      }
    } else {
      const p = this.doc.dummySpawns[sel.index];
      if (p) {
        let twinIdx = -1;
        if (this.mirrorMode) {
          twinIdx = this.doc.dummySpawns.findIndex((other, idx) => 
            idx !== sel.index && Math.abs(other[0] - (mw - p[0])) < 0.1 && Math.abs(other[1] - p[1]) < 0.1
          );
        }
        this.doc.dummySpawns[sel.index] = [p[0] + dx, p[1] + dy];
        if (twinIdx !== -1) {
          const twin = this.doc.dummySpawns[twinIdx];
          if (twin) this.doc.dummySpawns[twinIdx] = [twin[0] - dx, twin[1] + dy];
        }
      }
    }
  }`,
  `  private moveSelection(dx: number, dy: number): void {
    if (this.selection.length === 0) return;
    const mw = this.doc.tiles[0]?.length ?? 48;
    for (const sel of this.selection) {
      if (sel.kind === "shape") {
        const s = this.doc.shapes.find((sh) => sh.id === sel.id);
        if (s) {
          let twin;
          if (this.mirrorMode && s.kind === "rect") {
             twin = this.doc.shapes.find(sh => 
                sh.id !== s.id && sh.kind === "rect" && 
                Math.abs(sh.pos[0] - (mw - s.pos[0])) < 0.1 && 
                Math.abs(sh.pos[1] - s.pos[1]) < 0.1
             );
          }
          this.translateShape(s, dx, dy);
          if (twin && !this.selection.some((x: any) => x.id === twin.id)) this.translateShape(twin, -dx, dy);
        }
      } else if (sel.kind === "entity") {
        const e = this.doc.entities.find((en) => en.id === sel.id);
        if (e) {
          let twin;
          if (this.mirrorMode) {
             twin = this.doc.entities.find(en => 
                en.id !== e.id && en.type === e.type && 
                Math.abs(en.pos[0] - (mw - e.pos[0])) < 0.1 && 
                Math.abs(en.pos[1] - e.pos[1]) < 0.1
             );
          }
          e.pos = [e.pos[0] + dx, e.pos[1] + dy];
          if (twin && !this.selection.some((x: any) => x.id === twin.id)) twin.pos = [twin.pos[0] - dx, twin.pos[1] + dy];
        }
      } else if (sel.kind === "spawn") {
        const p = this.doc.playerSpawns[sel.index];
        if (p) {
          let twinIdx = -1;
          if (this.mirrorMode) {
            twinIdx = this.doc.playerSpawns.findIndex((other, idx) => 
              idx !== sel.index && Math.abs(other[0] - (mw - p[0])) < 0.1 && Math.abs(other[1] - p[1]) < 0.1
            );
          }
          this.doc.playerSpawns[sel.index] = [p[0] + dx, p[1] + dy, p[2]];
          if (twinIdx !== -1 && !this.selection.some((x: any) => x.index === twinIdx)) {
            const twin = this.doc.playerSpawns[twinIdx];
            if (twin) this.doc.playerSpawns[twinIdx] = [twin[0] - dx, twin[1] + dy, twin[2]];
          }
        }
      } else {
        const p = this.doc.dummySpawns[sel.index];
        if (p) {
          let twinIdx = -1;
          if (this.mirrorMode) {
            twinIdx = this.doc.dummySpawns.findIndex((other, idx) => 
              idx !== sel.index && Math.abs(other[0] - (mw - p[0])) < 0.1 && Math.abs(other[1] - p[1]) < 0.1
            );
          }
          this.doc.dummySpawns[sel.index] = [p[0] + dx, p[1] + dy];
          if (twinIdx !== -1 && !this.selection.some((x: any) => x.index === twinIdx)) {
            const twin = this.doc.dummySpawns[twinIdx];
            if (twin) this.doc.dummySpawns[twinIdx] = [twin[0] - dx, twin[1] + dy];
          }
        }
      }
    }
  }`,
);

// 9. pointerDown selection
code = code.replace(
  `        const hit = this.hitTest(w);
        this.selection = hit;
        this.refreshInspector();
        if (hit !== null) {
          this.beginChange();
          this.drag = { type: "move", last: w };
        }`,
  `        const hit = this.hitTest(w);
        if (e.shiftKey) {
          if (hit !== null) {
            const idx = this.selection.findIndex((s: any) => s.kind === hit.kind && s.id === (hit as any).id && s.index === (hit as any).index);
            if (idx >= 0) this.selection.splice(idx, 1);
            else this.selection.push(hit);
          }
        } else {
          if (hit === null) {
            this.selection = [];
            this.drag = { type: "box-select", start: w, current: w };
          } else {
            const has = this.selection.some((s: any) => s.kind === hit.kind && s.id === (hit as any).id && s.index === (hit as any).index);
            if (!has) this.selection = [hit];
            this.beginChange();
            this.drag = { type: "move", last: w };
          }
        }
        this.refreshInspector();`,
);

// 10. Box select drag
code = code.replace(
  `      case "draw-rect":
        drag.current = w;
        break;`,
  `      case "draw-rect":
      case "box-select":
        drag.current = w;
        break;`,
);

fs.writeFileSync("packages/client/src/editor/editor.ts", code);
