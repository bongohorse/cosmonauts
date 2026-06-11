export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

// Collision epsilon: keeps flush-against-a-boundary AABBs out of the neighboring tile.
export const SKIN = 1e-4;

export const DUMMY_WIDTH = 1;
export const DUMMY_HEIGHT = 1.5;
export const DUMMY_HEALTH = 60;
export const DUMMY_RESPAWN_TICKS = 2 * TICK_RATE;
export const FLUX_INTERVAL_TICKS = 2 * TICK_RATE; // +1 flux every 2 seconds

// Geometry v2 (doc 06 §4): slope and glass-platform behavior.
// Walkable if contact normal.y <= -GROUND_NORMAL_Y (≈ surfaces up to ~50°).
export const GROUND_NORMAL_Y = 0.64;
// While grounded and not jumping, stick to ground within this distance per tick.
export const GROUND_SNAP = 0.25;
// Ticks a dropped-through glass collider stays ignored (≈0.25 s).
export const DROP_IGNORE_TICKS = 15;
// A previous-tick bottom must be at most this far below a glass face to land on it.
export const GLASS_EPS = 0.08;
