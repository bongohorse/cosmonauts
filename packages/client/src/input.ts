import type { PlayerInput, Vec2 } from "@cosmonauts/sim";

/**
 * Samples keyboard + mouse into one PlayerInput per sim tick (doc 02 §6).
 * Key presses between ticks are latched so a sub-tick tap still registers.
 */
export class InputSource {
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };
  private jumpLatch = false;

  constructor(canvas: HTMLElement) {
    // Claim mouse buttons from the browser: right and middle click are reserved
    // for skill activation (abilities milestone). Scoped to the canvas so the
    // tuning panel keeps native context menus.
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 1 || e.button === 2) e.preventDefault(); // middle: no autoscroll
    });
    canvas.addEventListener("auxclick", (e) => e.preventDefault());
    // Block ctrl+wheel page zoom anywhere — zooming mid-fight is never intended.
    // Needs passive: false, or preventDefault is ignored for wheel events.
    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) e.preventDefault();
      },
      { passive: false },
    );

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      // Keyboard page zoom (ctrl/cmd +, -, 0) — blocked like ctrl+wheel.
      // Browser-reserved shortcuts (ctrl+T/W/N) stay with the browser.
      if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "_", "0"].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        if (this.isJumpKey(e.code)) this.jumpLatch = true;
        this.keys.add(e.code);
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("mousemove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouse.down = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouse.down = false;
    });
  }

  pendingBuyUpgrade?: "speed" | "cooldown" | "damage" | "jump";

  private isJumpKey(code: string): boolean {
    return code === "Space" || code === "KeyW" || code === "ArrowUp";
  }

  isPressed(code: string): boolean {
    return this.keys.has(code);
  }

  sample(playerWorld: Vec2, screenToWorld: (sx: number, sy: number) => Vec2): PlayerInput {
    const buyUpgrade = this.pendingBuyUpgrade;
    this.pendingBuyUpgrade = undefined;

    const shopOpen = document.getElementById("shop")?.classList.contains("open");
    if (shopOpen) {
      this.jumpLatch = false;
      return {
        moveX: 0,
        down: false,
        jump: false,
        jumpHeld: false,
        shoot: false,
        aimX: 1,
        aimY: 0,
        buyUpgrade,
      };
    }

    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const down = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const jumpHeld = this.keys.has("Space") || this.keys.has("KeyW") || this.keys.has("ArrowUp");

    const jump = this.jumpLatch;
    this.jumpLatch = false;

    const target = screenToWorld(this.mouse.x, this.mouse.y);
    let aimX = target.x - playerWorld.x;
    let aimY = target.y - playerWorld.y;
    const len = Math.sqrt(aimX * aimX + aimY * aimY);
    if (len > 0.001) {
      aimX /= len;
      aimY /= len;
    } else {
      aimX = 1;
      aimY = 0;
    }

    return {
      moveX: ((right ? 1 : 0) - (left ? 1 : 0)) as -1 | 0 | 1,
      down,
      jump,
      jumpHeld,
      shoot: this.mouse.down,
      aimX,
      aimY,
      buyUpgrade,
    };
  }
}
