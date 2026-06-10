import type { PlayerInput, Vec2 } from "@cosmonauts/sim";

/**
 * Samples keyboard + mouse into one PlayerInput per sim tick (doc 02 §6).
 * Key presses between ticks are latched so a sub-tick tap still registers.
 */
export class InputSource {
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };
  private jumpLatch = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
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

  private isJumpKey(code: string): boolean {
    return code === "Space" || code === "KeyW" || code === "ArrowUp";
  }

  isPressed(code: string): boolean {
    return this.keys.has(code);
  }

  sample(playerWorld: Vec2, screenToWorld: (sx: number, sy: number) => Vec2): PlayerInput {
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
    };
  }
}
