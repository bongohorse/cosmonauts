const fs = require("fs");
let code = fs.readFileSync("packages/client/src/editor/editor.ts", "utf8");

code = code.replace(
  "    const sel = this.selection[0];\n\n    // Position panel near the selected item",
  "    const sel = this.selection[0];\n    if (!sel) return;\n\n    // Position panel near the selected item",
);

fs.writeFileSync("packages/client/src/editor/editor.ts", code);
