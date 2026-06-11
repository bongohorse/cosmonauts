import { aabbOverlap } from "./collision";
import { DT } from "./constants";
import type { ContentIndex, MapData, MapEntityData } from "./content-types";
import { DEG_TO_RAD, dcos, dsin, type Vec2 } from "./math";
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

export function triggerTargets(state: GameState, map: MapData, targets?: string[]): void {
  if (!targets) return;
  for (const tId of targets) {
    const idx = map.entities.findIndex((e) => e.id === tId);
    if (idx !== -1) {
      const targetDyn = state.mapEntities[idx];
      if (targetDyn) {
        targetDyn.enabled = !targetDyn.enabled;
      }
    }
  }
}

export function resolveMomentaryWiring(state: GameState, map: MapData): void {
  const activeTargets = new Map<string, boolean>();
  const targetedByMomentary = new Set<string>();

  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    const dyn = state.mapEntities[i];
    if (data === undefined || dyn === undefined) continue;

    const isMomentaryActivator =
      data.type === "activator" && str(data.params, "mode") === "momentary";
    const isTimer = data.type === "timer";

    if ((isMomentaryActivator || isTimer) && data.targets) {
      for (const tId of data.targets) {
        targetedByMomentary.add(tId);
        if (dyn.active) {
          activeTargets.set(tId, true);
        }
      }
    }
  }

  for (const tId of targetedByMomentary) {
    const idx = map.entities.findIndex((e) => e.id === tId);
    if (idx !== -1) {
      const targetData = map.entities[idx];
      const targetDyn = state.mapEntities[idx];
      if (targetData && targetDyn) {
        const isActive = activeTargets.get(tId) === true;
        const initialEnabled = targetData.enabled;
        targetDyn.enabled = isActive ? !initialEnabled : initialEnabled;
      }
    }
  }
}

export function triggerOnDestroyed(state: GameState, map: MapData, entityId: string): void {
  const idx = map.entities.findIndex((e) => e.id === entityId);
  if (idx !== -1) {
    const data = map.entities[idx];
    if (data?.onDestroyed) {
      triggerTargets(state, map, data.onDestroyed);
    }
  }
}

/**
 * The shared trigger-volume system (doc 07 §1, §5): every wave-1 entity is an
 * axis-aligned box plus one effect against players standing inside it.
 * Disabled entities are inert; types without a behavior here are ignored, so
 * the sim tolerates content from newer waves.
 */
export function stepMapEntities(state: GameState, map: MapData, content: ContentIndex): void {
  // 1. Process timer ticks
  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    const dyn = state.mapEntities[i];
    if (data === undefined || dyn === undefined) continue;

    // Cooldown ticks down for everyone
    if (dyn.cooldown > 0) {
      dyn.cooldown -= 1;
      if (dyn.cooldown === 0 && (data.type === "fluxCube" || data.type === "healthPickup")) {
        dyn.enabled = true;
      }
    }

    if (data.type === "timer") {
      if (!dyn.enabled) {
        dyn.timerElapsed = 0;
        dyn.active = false;
        continue;
      }
      dyn.timerElapsed = (dyn.timerElapsed ?? 0) + 1;
      const period = num(data.params, "periodTicks", 120);
      const onDuration = num(data.params, "onDurationTicks", 60);
      const startDelay = num(data.params, "startDelayTicks", 0);
      if (dyn.timerElapsed >= startDelay) {
        const t = dyn.timerElapsed - startDelay;
        const cycleTime = t % period;
        dyn.active = cycleTime < onDuration;
      } else {
        dyn.active = false;
      }
    }
  }

  // 2. Process touch activators
  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    const dyn = state.mapEntities[i];
    if (data === undefined || dyn === undefined) continue;
    if (!dyn.enabled) continue;

    if (data.type === "activator") {
      const trigger = str(data.params, "trigger") || "touch";
      const mode = str(data.params, "mode") || "toggle";

      if (trigger === "touch") {
        let anyPlayerInside = false;
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
            anyPlayerInside = true;
            break;
          }
        }

        if (mode === "momentary") {
          dyn.active = anyPlayerInside;
        } else {
          // toggle or once: detect rising edge using dyn.active as "was touched last tick"
          const previouslyTouched = !!dyn.active;
          dyn.active = anyPlayerInside;

          if (anyPlayerInside && !previouslyTouched) {
            if (mode === "once" && !dyn.triggered) {
              dyn.triggered = true;
              triggerTargets(state, map, data.targets);
            } else if (mode === "toggle" && dyn.cooldown === 0) {
              triggerTargets(state, map, data.targets);
              dyn.cooldown = num(data.params, "cooldownTicks", 30);
            }
          }
        }
      }
    }
  }

  // 3. Resolve momentary/timer wiring (state-driven propagation)
  resolveMomentaryWiring(state, map);

  // 4. Apply Wave 1 trigger volumes
  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    const dyn = state.mapEntities[i];
    if (data === undefined || dyn === undefined) continue;
    if (!dyn.enabled) continue;

    // Ignore Wave 2 logic entities and stateful colliders here
    if (
      data.type === "activator" ||
      data.type === "timer" ||
      data.type === "door" ||
      data.type === "teamBarrier"
    ) {
      continue;
    }

    for (const p of state.players) {
      if (!dyn.enabled) break;
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
        const oldHealth = p.health;
        applyEntity(state, map, data, dyn, p, char.stats.maxHealth);
        if (oldHealth > 0 && p.health <= 0) {
          spawnPlayerDrops(state, p.pos, undefined);
        }
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
    case "fluxCube": {
      const denomStr = str(data.params, "denomination") || "1";
      const denom = denomStr === "5" ? 5 : 1;
      p.flux += denom;
      dyn.enabled = false;
      const respawnTicks = num(data.params, "respawnTimeTicks", 0);
      if (respawnTicks > 0) {
        dyn.cooldown = respawnTicks;
      }
      break;
    }
    case "healthPickup": {
      if (p.health >= maxHealth) {
        break;
      }
      const amount = num(data.params, "amount", 20);
      p.health = Math.min(maxHealth, p.health + amount);
      dyn.enabled = false;
      const respawnTicks = num(data.params, "respawnTimeTicks", 0);
      if (respawnTicks > 0) {
        dyn.cooldown = respawnTicks;
      }
      break;
    }
    default:
      break;
  }
}

export function spawnDroppedPickups(state: GameState, pos: Vec2, killerId?: number): void {
  state.pickups.push({
    id: state.nextEntityId++,
    kind: "flux",
    pos: { x: pos.x, y: pos.y },
    vel: killerId !== undefined ? { x: 0, y: 0 } : { x: -2, y: -4 },
    amount: 1,
    homingPlayerId: killerId,
    ticksLeft: 600,
  });

  state.pickups.push({
    id: state.nextEntityId++,
    kind: "flux",
    pos: { x: pos.x, y: pos.y },
    vel: killerId !== undefined ? { x: 0, y: 0 } : { x: 2, y: -4 },
    amount: 1,
    homingPlayerId: killerId,
    ticksLeft: 600,
  });

  state.pickups.push({
    id: state.nextEntityId++,
    kind: "health",
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: -5 },
    amount: 20,
    ticksLeft: 600,
  });
}

export function spawnPlayerDrops(state: GameState, pos: Vec2, killerId?: number): void {
  state.pickups.push({
    id: state.nextEntityId++,
    kind: "flux",
    pos: { x: pos.x, y: pos.y },
    vel: killerId !== undefined ? { x: 0, y: 0 } : { x: 0, y: -4 },
    amount: 5,
    homingPlayerId: killerId,
    ticksLeft: 600,
  });
}
