import type { CharacterData, GameState } from "@cosmonauts/sim";

/** HUD text + the live tuning panel (doc 04 §1: tune until it feels right). */
export class DebugPanel {
  private hud: HTMLElement;

  constructor(character: CharacterData) {
    const hud = document.getElementById("hud");
    if (hud === null) throw new Error("missing #hud element");
    this.hud = hud;
    this.buildTuningPanel(character);
  }

  update(state: GameState, fps: number, showHitboxes: boolean): void {
    const p = state.players[0];
    if (p === undefined) return;
    this.hud.textContent = [
      `fps ${fps.toFixed(0)}  tick ${state.tick}`,
      `pos ${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}  vel ${p.vel.x.toFixed(1)}, ${p.vel.y.toFixed(1)}`,
      `grounded ${p.grounded}  jumps ${p.jumpsUsed}  projectiles ${state.projectiles.length}`,
      "",
      "A/D move · Space/W jump (×2) · S+jump drop through glass · mouse aim · click shoot",
      `F1 hitboxes ${showHitboxes ? "on" : "off"} · R reset`,
    ].join("\n");
  }

  /**
   * Number inputs writing straight into the live CharacterData the sim reads
   * each tick — edits apply on the next tick, no reload. The browser-native
   * version of Ronimo's live editors (doc 01 §4.9).
   */
  private buildTuningPanel(character: CharacterData): void {
    const panel = document.getElementById("tuning");
    if (panel === null) return;

    const addSection = (title: string, target: Record<string, number>): void => {
      const heading = document.createElement("h4");
      heading.textContent = title;
      panel.appendChild(heading);
      for (const key of Object.keys(target)) {
        const label = document.createElement("label");
        label.textContent = key;
        const inputEl = document.createElement("input");
        inputEl.type = "number";
        inputEl.step = "any";
        inputEl.value = String(target[key]);
        inputEl.addEventListener("input", () => {
          const value = Number.parseFloat(inputEl.value);
          if (Number.isFinite(value)) target[key] = value;
        });
        label.appendChild(inputEl);
        panel.appendChild(label);
      }
    };

    addSection("stats (tiles, s)", character.stats as unknown as Record<string, number>);
    addSection("attack (ticks)", character.attack as unknown as Record<string, number>);
  }
}
