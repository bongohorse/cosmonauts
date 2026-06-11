const fs = require('fs');
let code = fs.readFileSync('packages/client/src/editor/editor.ts', 'utf8');

// 1. Drag type
code = code.replace(
  '| { type: "resize"; corner: number }',
  '| { type: "resize"; corner: number }\n  | { type: "move-vertex"; index: number }'
);

// 2. pointerDown logic
code = code.replace(
  `          if (handle !== null) {
            this.beginChange();
            this.drag = { type: "resize", corner: handle };
            return;
          }
        }`,
  `          if (handle !== null) {
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
        }`
);

// 3. pointerMove logic
code = code.replace(
  `      case "resize": {`,
  `      case "move-vertex": {
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
            const twin = this.doc.shapes.find(sh => 
              sh.id !== s.id && sh.kind === "polygon" &&
              sh.points.length === s.points.length &&
              Math.abs(sh.points[0]![0] - (mw - s.points[0]![0])) < 0.1
            );
            if (twin && twin.kind === "polygon") {
              twin.points[drag.index] = [mw - w.x, w.y];
            }
          }
          this.changed();
        }
        break;
      }
      case "resize": {`
);

// 4. hitPolygonHandle method
code = code.replace(
  `  private hitRectHandle(s: Extract<ShapeDef, { kind: "rect" }>, w: Vec2): number | "rotate" | null {`,
  `  private hitPolygonHandle(s: Extract<ShapeDef, { kind: "polygon" | "polyline" }>, w: Vec2): number | null {
    const grab = 0.35 / this.cam.scale;
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      if (p && Math.hypot(w.x - p[0], w.y - p[1]) < grab) return i;
    }
    return null;
  }

  private hitRectHandle(s: Extract<ShapeDef, { kind: "rect" }>, w: Vec2): number | "rotate" | null {`
);

// 5. drawShapeSelection
code = code.replace(
  `      if (s.kind === "polygon") g.lineTo(px(first[0]), px(first[1]));
      g.stroke({ color: SEL, width: lw(2) });
    } else {`,
  `      if (s.kind === "polygon") g.lineTo(px(first[0]), px(first[1]));
      g.stroke({ color: SEL, width: lw(2) });
      for (const [x, y] of s.points) {
        g.rect(px(x) - lw(5), px(y) - lw(5), lw(10), lw(10)).fill(0xffffff);
      }
    } else {`
);

fs.writeFileSync('packages/client/src/editor/editor.ts', code);
