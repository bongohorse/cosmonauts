const fs = require("fs");
let code = fs.readFileSync("packages/client/src/editor/editor.ts", "utf8");

code = code.replace(
  `  private refreshInspector(): void {
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
    }`,
  `  private refreshInspector(): void {
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
      heading.textContent = \`\${this.selection.length} items selected\`;
      panel.appendChild(heading);
      return;
    }
    const sel = this.selection[0];`,
);

fs.writeFileSync("packages/client/src/editor/editor.ts", code);
