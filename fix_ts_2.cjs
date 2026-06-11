const fs = require("fs");
let code = fs.readFileSync("packages/client/src/editor/editor.ts", "utf8");

code = code.replace("    if (!sel) return;", "    if (!sel) return null;");
code = code.replace("    if (!sel) return;", "    if (!sel) return null;");

code = code.replace(
  'this.selection = { kind: "shape", id };',
  'this.selection = [{ kind: "shape", id }];',
);
code = code.replace(
  'this.selection = { kind: "entity", id };',
  'this.selection = [{ kind: "entity", id }];',
);

// fix `sel` is possibly 'undefined' in refreshInspector (lines 1517, 1541, 1548, 1554, 1601, 1624, 1702, 1948, 1949)
// It comes from `for (const other of this.doc.entities) { if ((sel as any).kind === "entity" && other.id === (sel as any).id) continue;`
// Wait, the error is 1517,9: error TS18048: 'sel' is possibly 'undefined'.
// Actually, earlier in refreshInspector:
// `const sel = this.selection[0];`
// I added `if (!sel) return;` but wait, it was added as `const sel = this.selection[0];\n    if (!sel) return;`
// Let's check `refreshInspector` to see if `sel` is ever reassigned or if TS just doesn't carry the narrowing into the closures/loops.
code = code.replace(
  `    const sel = this.selection[0];
    if (!sel) return;`,
  `    const sel = this.selection[0] as Selection;`,
);

fs.writeFileSync("packages/client/src/editor/editor.ts", code);
