import { aabbOverlap } from "./collision";
import { DT } from "./constants";
import type { ContentIndex, MapData, MapEntityData } from "./content-types";
import { DEG_TO_RAD, dcos, dsin } from "./math";
import { type GameState, type MapEntityState, type PlayerState, playerSpawnPos } from "./state";

type Params = MapEntityData["params"];

function num(params: Params, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}

function str(params: Params, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

function bool(params: Params, key: string): boolean {
  return params[key] === true;
}

/**
 * The shared trigger-volume system (doc 07 §1, §5): every wave-1 entity is an
 * axis-aligned box plus one effect against players standing inside it.
 * Disabled entities are inert; types without a behavior here are ignored, so
 * the sim tolerates content from newer waves.
 */
export function stepMapEntities(state: GameState, map: MapData, content: ContentIndex): void {
  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    const dyn = state.mapEntities[i];
    if (data === undefined || dyn === undefined) continue;
    if (dyn.cooldown > 0) dyn.cooldown -= 1;
    if (!dyn.enabled) continue;

    for (const p of state.players) {
      const char = content.characters[p.characterId];
      if (char === undefined) continue;
      const inside = aabbOverlap(
        data.pos.x,
        data.pos.y,
        data.size.w / 2,
        data.size.h / 2,
        p.pos.x,
        p.pos.y,
        char.hitbox.w / 2,
        char.hitbox.h / 2,
      );
      if (inside) {
        applyEntity(state, map, data, dyn, p, char.stats.maxHealth);
      }
    }
  }

  // Instant kill-and-respawn (doc 07 killZone), applied to every death cause
  // so 0-HP players never keep walking. A proper death timer comes with M6.
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p === undefined || p.health > 0) continue;
    const char = content.characters[p.characterId];
    if (char === undefined) continue;
    respawnPlayer(map, p, i, char.stats.maxHealth, char.hitbox.h);
  }
}

function respawnPlayer(
  map: MapData,
  p: PlayerState,
  index: number,
  maxHealth: number,
  hitboxH: number,
): void {
  const pos = playerSpawnPos(map, index, hitboxH);
  p.pos.x = pos.x;
  p.pos.y = pos.y;
  p.vel.x = 0;
  p.vel.y = 0;
  p.health = maxHealth;
  p.grounded = false;
  p.jumpsUsed = 0;
  p.jumpCutApplied = false;
  p.dropShapeId = "";
  p.dropTicks = 0;
}

function applyEntity(
  state: GameState,
  map: MapData,
  data: MapEntityData,
  dyn: MapEntityState,
  p: PlayerState,
  maxHealth: number,
): void {
  switch (data.type) {
    case "jumper": {
      if (dyn.cooldown > 0) break;
      const rad = num(data.params, "direction", 90) * DEG_TO_RAD;
      const strength = num(data.params, "strength", 22);
      p.vel.x = dcos(rad) * strength;
      p.vel.y = -dsin(rad) * strength;
      p.grounded = false;
      p.jumpCutApplied = true;
      dyn.cooldown = num(data.params, "cooldownTicks", 30);
      break;
    }
    case "forceField": {
      p.vel.x += num(data.params, "forceX", 0) * DT;
      p.vel.y += num(data.params, "forceY", -50) * DT;
      // If the net force is lifting the player, unground them so they don't
      // get snapped back by the grounded-tangent logic in stepPlayer.
      if (p.vel.y < -0.01) p.grounded = false;
      break;
    }
    case "teleporter": {
      if (dyn.cooldown > 0) break;
      const targetIndex = map.entities.findIndex((e) => e.id === str(data.params, "targetId"));
      const target = map.entities[targetIndex];
      const targetDyn = state.mapEntities[targetIndex];
      if (target === undefined || targetDyn === undefined || target.id === data.id) break;
      p.pos.x = target.pos.x;
      p.pos.y = target.pos.y;
      if (!bool(data.params, "preserveVelocity")) {
        p.vel.x = 0;
        p.vel.y = 0;
      }
      p.grounded = false;
      const cd = num(data.params, "cooldownTicks", 60);
      dyn.cooldown = cd;
      targetDyn.cooldown = Math.max(targetDyn.cooldown, cd); // no instant ping-pong
      break;
    }
    case "fireField":
      p.health = Math.max(0, p.health - num(data.params, "dps", 30) * DT);
      break;
    case "healField":
      p.health = Math.min(maxHealth, p.health + num(data.params, "hps", 20) * DT);
      break;
    case "killZone":
      p.health = 0;
      break;
    default:
      break;
  }
}
