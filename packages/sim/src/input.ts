/**
 * One player's input for one tick. This struct is sampled by the client,
 * consumed by `step`, and (in M3) is the exact payload sent over the wire.
 * Aim is a pre-normalized direction — the sim never does trig (doc 02 §5).
 */
export interface PlayerInput {
  moveX: -1 | 0 | 1;
  jump: boolean; // pressed this tick (edge)
  jumpHeld: boolean; // level
  shoot: boolean; // level; auto-fire is gated by the attack cooldown
  aimX: number;
  aimY: number;
}

export const NEUTRAL_INPUT: PlayerInput = Object.freeze({
  moveX: 0,
  jump: false,
  jumpHeld: false,
  shoot: false,
  aimX: 1,
  aimY: 0,
});
