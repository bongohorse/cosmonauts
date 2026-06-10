export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

// Collision epsilon: keeps flush-against-a-boundary AABBs out of the neighboring tile.
export const SKIN = 1e-4;

export const DUMMY_WIDTH = 1;
export const DUMMY_HEIGHT = 1.5;
export const DUMMY_HEALTH = 60;
export const DUMMY_RESPAWN_TICKS = 2 * TICK_RATE;
