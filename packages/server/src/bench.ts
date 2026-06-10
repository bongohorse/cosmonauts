// Headless sim benchmark: proves the sim package runs server-side and measures
// headroom. The real authoritative server lands in Milestone 3 (doc 03).
import { loadContent } from "@cosmonauts/content";
import { createState, NEUTRAL_INPUT, type PlayerInput, step, TICK_RATE } from "@cosmonauts/sim";

const TICKS = 60_000; // 1000 seconds of game time

const content = loadContent();
const map = content.maps["testing-grounds"];
if (map === undefined) throw new Error("missing testing-grounds map");

const state = createState(
  map,
  [
    { playerId: 1, characterId: "nova" },
    { playerId: 2, characterId: "nova" },
  ],
  content,
);

const scripted = (t: number, phase: number): PlayerInput => ({
  ...NEUTRAL_INPUT,
  moveX: ((((t + phase) >> 4) % 3) - 1) as -1 | 0 | 1,
  jump: (t + phase) % 37 === 0,
  jumpHeld: (t + phase) % 37 < 20,
  shoot: t % 5 === 0,
  aimX: (t % 7) - 3,
  aimY: (t % 11) - 5,
});

const started = process.hrtime.bigint();
for (let t = 0; t < TICKS; t++) {
  step(state, { 1: scripted(t, 0), 2: scripted(t, 18) }, content);
}
const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

const ticksPerSecond = TICKS / (elapsedMs / 1000);
console.log(`${TICKS} ticks (2 players) in ${elapsedMs.toFixed(0)} ms`);
console.log(
  `${Math.round(ticksPerSecond).toLocaleString("en-US")} ticks/s = ${Math.round(
    ticksPerSecond / TICK_RATE,
  ).toLocaleString("en-US")}x realtime`,
);
console.log(`final tick ${state.tick}, projectiles ${state.projectiles.length}`);
