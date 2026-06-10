export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Move `current` toward `target` by at most `maxDelta`, without overshooting. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export const TWO_PI = Math.PI * 2;
export const DEG_TO_RAD = Math.PI / 180;

/**
 * Deterministic sine (doc 02 §5): Math.sin is not correctly-rounded and differs
 * across JS engines, so geometry compilation uses this instead — pure
 * arithmetic, identical everywhere. Max error ~2e-7, far below any gameplay
 * tolerance. Range-reduced Taylor series through x^11 on [-π/2, π/2].
 */
export function dsin(x: number): number {
  // reduce to [-π, π]
  let t = x - TWO_PI * Math.floor((x + Math.PI) / TWO_PI);
  // fold to [-π/2, π/2]
  if (t > Math.PI / 2) t = Math.PI - t;
  else if (t < -Math.PI / 2) t = -Math.PI - t;
  const t2 = t * t;
  return (
    t *
    (1 +
      t2 * (-1 / 6 + t2 * (1 / 120 + t2 * (-1 / 5040 + t2 * (1 / 362880 + t2 * (-1 / 39916800))))))
  );
}

export function dcos(x: number): number {
  return dsin(x + Math.PI / 2);
}

/**
 * Deterministic PRNG (mulberry32) as a pure function: the state lives in
 * GameState.rng, never in module scope. Returns [valueIn0to1, nextState].
 */
export function rand(state: number): [number, number] {
  const nextState = (state + 0x6d2b79f5) | 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextState];
}
