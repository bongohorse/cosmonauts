import { loadContent, loadMapDefs } from "@cosmonauts/content";
import { cloneState, createState, DT, type GameState, step } from "@cosmonauts/sim";
import { Application } from "pixi.js";
import { DebugPanel } from "./debug";
import { compileDoc, docFromDef, loadFromStorage } from "./editor/doc";
import { Editor } from "./editor/editor";
import { InputSource } from "./input";
import { Renderer } from "./renderer";

const MAP_ID = "testing-grounds";
const CHARACTER_ID = "nova";
const PLAYER_ID = 1;

const content = loadContent();
const character = content.characters[CHARACTER_ID];
const shippedDef = loadMapDefs().find((d) => d.id === MAP_ID);
if (shippedDef === undefined || character === undefined) {
  throw new Error("missing shipped content — check packages/content");
}

// The editor document is the source of truth for the map: autosaved work in
// progress wins over the shipped map.
let doc = loadFromStorage() ?? docFromDef(shippedDef);
let map = compileDoc(doc);
content.maps[map.id] = map;

const newGame = (): GameState =>
  createState(map, [{ playerId: PLAYER_ID, characterId: CHARACTER_ID }], content);

let state = newGame();
let prev = cloneState(state);

const app = new Application();
await app.init({
  resizeTo: window,
  background: "#10142a",
  antialias: true,
  resolution: window.devicePixelRatio,
  autoDensity: true,
});
document.body.appendChild(app.canvas);

const renderer = new Renderer(app, map, content);
const inputSource = new InputSource(app.canvas);
const debugPanel = new DebugPanel(character);
const editor = new Editor(renderer, doc);

let mode: "play" | "edit" = "play";

function enterEdit(): void {
  mode = "edit";
  renderer.clearEntities();
  editor.doc = doc;
  editor.enter();
}

function enterPlay(): void {
  doc = editor.doc;
  map = compileDoc(doc);
  content.maps[map.id] = map;
  renderer.setMap(map);
  state = newGame();
  prev = cloneState(state);
  editor.exit();
  mode = "play";
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Tab") {
    e.preventDefault();
    if (mode === "play") enterEdit();
    else enterPlay();
    return;
  }
  if (mode !== "play") return;
  if (e.code === "F1") {
    e.preventDefault();
    renderer.showHitboxes = !renderer.showHitboxes;
  }
  if (e.code === "KeyR") {
    state = newGame();
    prev = cloneState(state);
  }
});

// Sandbox debug hook: console + E2E-test access to the running game.
declare global {
  interface Window {
    __cosmo?: {
      state: () => GameState;
      teleport: (x: number, y: number) => void;
      mode: () => string;
      editor: () => Editor;
      toggleMode: () => void;
    };
  }
}
window.__cosmo = {
  state: () => state,
  teleport(x, y) {
    const p = state.players[0];
    if (p === undefined) return;
    p.pos.x = x;
    p.pos.y = y;
    p.vel.x = 0;
    p.vel.y = 0;
  },
  mode: () => mode,
  editor: () => editor,
  toggleMode: () => (mode === "play" ? enterEdit() : enterPlay()),
};

// Fixed-timestep driver with render interpolation (doc 02 §2).
let accumulator = 0;
app.ticker.add((ticker) => {
  if (mode === "edit") {
    accumulator = 0;
    editor.update();
    renderer.applyCameraOverride();
    return;
  }

  // Cap the catch-up burst after a background-tab stall (doc 01 §5).
  accumulator = Math.min(accumulator + ticker.deltaMS / 1000, 0.25);

  while (accumulator >= DT) {
    prev = cloneState(state);
    const player = state.players[0];
    const input = inputSource.sample(player?.pos ?? { x: 0, y: 0 }, (sx, sy) =>
      renderer.screenToWorld(sx, sy),
    );
    step(state, { [PLAYER_ID]: input }, content);
    accumulator -= DT;
  }

  renderer.render(prev, state, accumulator / DT);
  debugPanel.update(state, app.ticker.FPS, renderer.showHitboxes);
});
