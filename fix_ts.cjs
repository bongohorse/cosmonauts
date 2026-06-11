const fs = require("fs");
let code = fs.readFileSync("packages/client/src/editor/editor.ts", "utf8");

// fix undefined sel
code = code.replace(
  "const sel = this.selection[0];",
  "const sel = this.selection[0];\n    if (!sel) return;",
);

// fix sel.id accesses where TS fails narrowing
code = code.replace(/sel\.id/g, "(sel as any).id");
code = code.replace(/sel\.index/g, "(sel as any).index");

// fix duplicateSelection error (Object literal may only specify known properties)
// the error was: src/editor/editor.ts(889,24): error TS2353: Object literal may only specify...
// Let's replace the whole duplicateSelection with a simpler implementation using any
code = code.replace(
  /private duplicateSelection\(\): void \{[\s\S]*?this\.refreshInspector\(\);\n {2}\}/,
  `private duplicateSelection(): void {
    if (this.selection.length === 0) return;
    this.beginChange();
    const newSel: Selection[] = [];
    for (const sel of this.selection) {
      if (sel.kind === "shape") {
        const s = this.doc.shapes.find((x: any) => x.id === (sel as any).id);
        if (s) {
          const copy = JSON.parse(JSON.stringify(s));
          copy.id = this.nextShapeId();
          this.translateShape(copy, 0.5, 0.5);
          this.doc.shapes.push(copy);
          newSel.push({ kind: "shape", id: copy.id } as Selection);
        }
      } else if (sel.kind === "entity") {
        const e = this.doc.entities.find((x: any) => x.id === (sel as any).id);
        if (e) {
          const copy = JSON.parse(JSON.stringify(e));
          copy.id = this.nextEntityId(e.type);
          copy.pos[0] += 0.5;
          copy.pos[1] += 0.5;
          this.doc.entities.push(copy);
          newSel.push({ kind: "entity", id: copy.id } as Selection);
        }
      } else if (sel.kind === "spawn") {
        const p = this.doc.playerSpawns[(sel as any).index];
        if (p) {
          this.doc.playerSpawns.push([p[0] + 0.5, p[1] + 0.5, p[2]]);
          newSel.push({ kind: "spawn", index: this.doc.playerSpawns.length - 1 } as Selection);
        }
      } else {
        const d = this.doc.dummySpawns[(sel as any).index];
        if (d) {
          this.doc.dummySpawns.push([d[0] + 0.5, d[1] + 0.5]);
          newSel.push({ kind: "dummy", index: this.doc.dummySpawns.length - 1 } as Selection);
        }
      }
    }
    this.selection = newSel;
    this.changed();
    this.refreshInspector();
  }`,
);

fs.writeFileSync("packages/client/src/editor/editor.ts", code);
