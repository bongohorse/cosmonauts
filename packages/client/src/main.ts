import { loadContent, loadMapDefs } from "@cosmonauts/content";
import {
  cloneState,
  createState,
  DT,
  findActiveBaseForPlayer,
  type GameState,
  type PlayerState,
  step,
  type Team,
} from "@cosmonauts/sim";
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

let PLAYER_TEAM: Team = "RED";
const teamSelect = document.getElementById("player-team") as HTMLSelectElement | null;
if (teamSelect) {
  teamSelect.addEventListener("change", () => {
    PLAYER_TEAM = teamSelect.value as Team;
    state = newGame();
    prev = cloneState(state);
  });
}

const newGame = (): GameState =>
  createState(map, [{ playerId: PLAYER_ID, characterId: CHARACTER_ID, team: PLAYER_TEAM }], content);

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

const shopEl = document.getElementById("shop");
const shopBalanceEl = document.getElementById("shop-balance");
const shopUpgradesEl = document.getElementById("shop-upgrades");
const closeShopBtn = document.getElementById("close-shop");
const shopHintEl = document.getElementById("shop-hint");

let lastRenderedFlux = -1;
let lastRenderedUpgradesStr = "";

function openShop(): void {
  lastRenderedFlux = -1;
  lastRenderedUpgradesStr = "";
  shopEl?.classList.add("open");
}

function closeShop(): void {
  shopEl?.classList.remove("open");
}

function toggleShop(): void {
  if (shopEl?.classList.contains("open")) {
    closeShop();
  } else {
    openShop();
  }
}

function renderShop(p: PlayerState): void {
  if (!shopBalanceEl || !shopUpgradesEl) return;
  const upgradesStr = JSON.stringify(p.upgrades);
  if (p.flux === lastRenderedFlux && upgradesStr === lastRenderedUpgradesStr) {
    return;
  }
  lastRenderedFlux = p.flux;
  lastRenderedUpgradesStr = upgradesStr;

  shopBalanceEl.textContent = `Balance: ${p.flux} flux`;

  const upgradesConfig = [
    {
      id: "speed" as const,
      name: "Movement Shoes",
      desc: "+1.5 tiles/s per level",
      max: 3,
      getCost: (lvl: number) => (lvl + 1) * 5,
    },
    {
      id: "cooldown" as const,
      name: "Blaster Overclock",
      desc: "-15% cooldown per level",
      max: 3,
      getCost: (lvl: number) => (lvl + 1) * 5,
    },
    {
      id: "damage" as const,
      name: "Heavy Alloy Rounds",
      desc: "+5 damage per level",
      max: 3,
      getCost: (lvl: number) => (lvl + 1) * 5,
    },
    {
      id: "jump" as const,
      name: "Double Jump Booster",
      desc: "+1 max jump",
      max: 1,
      getCost: () => 15,
    },
  ];

  shopUpgradesEl.innerHTML = "";
  for (const cfg of upgradesConfig) {
    const lvl = p.upgrades[cfg.id];
    const isMax = lvl >= cfg.max;
    const cost = isMax ? 0 : cfg.getCost(lvl);
    const canAfford = p.flux >= cost && !isMax;

    const card = document.createElement("div");
    card.className = "upgrade-card";

    const info = document.createElement("div");
    info.className = "upgrade-info";

    const name = document.createElement("span");
    name.className = "upgrade-name";
    name.textContent = cfg.name;

    const desc = document.createElement("span");
    desc.className = "upgrade-desc";
    desc.textContent = cfg.desc;

    const level = document.createElement("span");
    level.className = "upgrade-level";
    level.textContent = `Level: ${lvl}/${cfg.max}`;

    info.appendChild(name);
    info.appendChild(desc);
    info.appendChild(level);

    const btn = document.createElement("button");
    btn.className = "upgrade-btn";
    if (isMax) {
      btn.textContent = "MAX";
      btn.disabled = true;
    } else {
      btn.textContent = `BUY [${cost} flux]`;
      btn.disabled = !canAfford;
      btn.onclick = () => {
        inputSource.pendingBuyUpgrade = cfg.id;
      };
    }

    card.appendChild(info);
    card.appendChild(btn);
    shopUpgradesEl.appendChild(card);
  }
}

closeShopBtn?.addEventListener("click", () => {
  closeShop();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && shopEl?.classList.contains("open")) {
    closeShop();
  }
});

function enterEdit(): void {
  mode = "edit";
  closeShop();
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
  closeShop();
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
  if (e.code === "KeyE") {
    const player = state.players[0];
    if (player) {
      const activeBase = findActiveBaseForPlayer(state, player, map, content);
      if (activeBase !== null) {
        e.preventDefault();
        toggleShop();
      }
    }
  }
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

  // Update Shop overlay and hint visibility.
  const player = state.players[0];
  if (player) {
    const activeBase = findActiveBaseForPlayer(state, player, map, content);
    const inBase = activeBase !== null;
    const isShopOpen = shopEl?.classList.contains("open") ?? false;

    if (inBase && !isShopOpen) {
      shopHintEl?.classList.add("visible");
    } else {
      shopHintEl?.classList.remove("visible");
    }

    if (!inBase && isShopOpen) {
      closeShop();
    }

    if (isShopOpen) {
      renderShop(player);
    }
  } else {
    shopHintEl?.classList.remove("visible");
    closeShop();
  }
});
