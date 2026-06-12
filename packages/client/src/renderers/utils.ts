import type { Graphics } from "pixi.js";

export function getRotatedRectPoints(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotationDeg: number,
): number[] {
  const hw = w / 2;
  const hh = h / 2;
  const r = rotationDeg * (Math.PI / 180);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const corner = (x: number, y: number): [number, number] => [
    cx + x * c - y * s,
    cy + x * s + y * c,
  ];
  return [...corner(-hw, -hh), ...corner(hw, -hh), ...corner(hw, hh), ...corner(-hw, hh)];
}

export const TILE_PX = 40;

export const COLORS = {
  tile: 0x2c3354,
  tileEdge: 0x3d4570,
  dummy: 0xff5d73,
  dummyDead: 0x4a4f6e,
  projectile: 0xffd166,
  healthBack: 0x222741,
  health: 0x66ff8c,
  hitbox: 0xff2bd6, // must clash with every entity color — it outlines them
};

export function drawArrow(
  g: Graphics,
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  length: number,
  color: number,
  width: number,
): void {
  const tx = cx + vx * length;
  const ty = cy + vy * length;
  g.moveTo(cx, cy).lineTo(tx, ty).stroke({ color, width });

  // Draw arrow head
  const angle = Math.atan2(vy, vx);
  const headSize = Math.max(5, length * 0.25);
  const leftX = tx - headSize * Math.cos(angle - Math.PI / 6);
  const leftY = ty - headSize * Math.sin(angle - Math.PI / 6);
  const rightX = tx - headSize * Math.cos(angle + Math.PI / 6);
  const rightY = ty - headSize * Math.sin(angle + Math.PI / 6);

  g.moveTo(tx, ty).lineTo(leftX, leftY);
  g.moveTo(tx, ty).lineTo(rightX, rightY);
  g.stroke({ color, width });
}
