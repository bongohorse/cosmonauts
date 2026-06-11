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

export function isTargetVisible(
  state: GameState,
  map: MapData,
  targetPos: Vec2,
  observerTeam: "RED" | "BLU",
): boolean {
  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    if (data && data.type === "hideZone" && data.size) {
      const inside = aabbOverlap(
        data.pos.x,
        data.pos.y,
        data.size.w / 2,
        data.size.h / 2,
        targetPos.x,
        targetPos.y,
        0.1,
        0.1,
      );
      if (inside) {
        const dyn = state.mapEntities[i];
        if (observerTeam === "RED" && !dyn?.visionRED) return false;
        if (observerTeam === "BLU" && !dyn?.visionBLU) return false;
      }
    }
  }
  return true;
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

    if (data.type === "hideZone") {
      dyn.visionRED = false;
      dyn.visionBLU = false;
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
        if (data.type === "hideZone") {
          if (p.team === "RED") dyn.visionRED = true;
          if (p.team === "BLU") dyn.visionBLU = true;
        } else {
          const oldHealth = p.health;
          applyEntity(state, map, data, dyn, p, char.stats.maxHealth);
          if (oldHealth > 0 && p.health <= 0) {
            spawnPlayerDrops(state, p.pos, undefined);
          }
        }
      }
    }

    // Apply trigger volumes to droids (fireZone, killZone, jumper, etc.)
    for (const d of state.droids) {
      if (!dyn.enabled) break;
      if (d.health <= 0) continue;
      const inside = aabbOverlap(
        data.pos.x,
        data.pos.y,
        data.size.w / 2,
        data.size.h / 2,
        d.pos.x,
        d.pos.y,
        0.4, // droid half-width
        0.45, // droid half-height
      );
      if (inside) {
        if (data.type === "hideZone") {
          if (d.team === "RED") dyn.visionRED = true;
          if (d.team === "BLU") dyn.visionBLU = true;
        } else {
          const mockP = d as unknown as PlayerState;
          const oldHealth = mockP.health;
          applyEntity(state, map, data, dyn, mockP, d.maxHealth);
          if (oldHealth > 0 && mockP.health <= 0) {
            spawnDroppedPickups(state, d.pos, undefined);
          }
        }
      }
    }

    for (const c of state.creeps) {
      if (!dyn.enabled) break;
      if (c.health <= 0) continue;
      const inside = aabbOverlap(
        data.pos.x,
        data.pos.y,
        data.size.w / 2,
        data.size.h / 2,
        c.pos.x,
        c.pos.y,
        0.4, // creep half-width
        0.45, // creep half-height
      );
      if (inside && data.type !== "hideZone") {
        const mockP = c as unknown as PlayerState;
        const oldHealth = mockP.health;
        applyEntity(state, map, data, dyn, mockP, c.maxHealth);
        if (oldHealth > 0 && mockP.health <= 0) {
          spawnCreepDrops(state, c.pos, undefined);
        }
      }
    }
  }

  // 4. Map Objectives (Turrets and Droid Spawners)
  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    const dyn = state.mapEntities[i];
    if (!data || !dyn || dyn.dead) continue;

    if (data.type === "turret") {
      if (dyn.cooldown > 0) dyn.cooldown -= 1;
      if (dyn.cooldown <= 0) {
        const team = str(data.params, "team") || "RED";
        const range = num(data.params, "range", 15);
        const dps = num(data.params, "dps", 50);

        let targetPos: Vec2 | null = null;
        let minDist = range * range;

        // Find closest enemy player
        for (const p of state.players) {
          if (p.health <= 0 || p.team === team) continue;
          const dx = p.pos.x - data.pos.x;
          const dy = p.pos.y - data.pos.y;
          const dist2 = dx * dx + dy * dy;
          // biome-ignore lint/suspicious/noExplicitAny: valid
          if (dist2 < minDist && isTargetVisible(state, map, p.pos, team as any)) {
            minDist = dist2;
            targetPos = p.pos;
          }
        }

        // Find closest enemy droid
        for (const d of state.droids) {
          if (d.health <= 0 || d.team === team) continue;
          const dx = d.pos.x - data.pos.x;
          const dy = d.pos.y - data.pos.y;
          const dist2 = dx * dx + dy * dy;
          // biome-ignore lint/suspicious/noExplicitAny: valid
          if (dist2 < minDist && isTargetVisible(state, map, d.pos, team as any)) {
            minDist = dist2;
            targetPos = d.pos;
          }
        }

        // Find closest creep (neutral, so anyone can target them)
        for (const c of state.creeps) {
          if (c.health <= 0) continue;
          const dx = c.pos.x - data.pos.x;
          const dy = c.pos.y - data.pos.y;
          const dist2 = dx * dx + dy * dy;
          // biome-ignore lint/suspicious/noExplicitAny: valid
          if (dist2 < minDist && isTargetVisible(state, map, c.pos, team as any)) {
            minDist = dist2;
            targetPos = c.pos;
          }
        }

        if (targetPos) {
          // Shoot!
          const dx = targetPos.x - data.pos.x;
          // Shoot from the top of the turret (Y axis points down, so subtract half height)
          const startY = data.pos.y - data.size.h / 2;
          const dy = targetPos.y - startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = 20;
          state.projectiles.push({
            id: state.nextEntityId++,
            // biome-ignore lint/suspicious/noExplicitAny: valid
            team: team as any,
            pos: { x: data.pos.x, y: startY },
            vel: { x: (dx / dist) * speed, y: (dy / dist) * speed },
            radius: 0.3,
            damage: dps * (30 / 60), // assume it shoots every 30 ticks (0.5s)
            ticksLeft: 60,
          });
          dyn.cooldown = 30; // 0.5s cooldown
        }
      }
    }

    if (data.type === "droidSpawner") {
      const intervalTicks = num(data.params, "intervalTicks", 600); // 10s default
      if (intervalTicks <= 0) continue;

      if (dyn.cooldown > 0) dyn.cooldown -= 1;
      if (dyn.cooldown <= 0) {
        dyn.cooldown = intervalTicks;

        const team = str(data.params, "team") || "RED";
        const count = num(data.params, "count", 2);

        for (let j = 0; j < count; j++) {
          state.droids.push({
            id: state.nextEntityId++,
            type: "small",
            // biome-ignore lint/suspicious/noExplicitAny: valid
            team: team as any,
            pos: { x: data.pos.x + j * 1.5, y: data.pos.y },
            vel: { x: 0, y: 0 },
            health: 250,
            maxHealth: 250,
            facing: team === "RED" ? 1 : -1,
            grounded: false,
            groundShapeId: "",
            attackCooldown: 0,
            pathTargetId: str(data.params, "pathId"),
          });
        }
      }
    }

    if (data.type === "creepDen") {
      if (dyn.cooldown > 0) dyn.cooldown -= 1;

      const hasAliveCreep = state.creeps.some((c) => c.denId === data.id);
      if (!hasAliveCreep && dyn.cooldown <= 0) {
        state.creeps.push({
          id: state.nextEntityId++,
          pos: { x: data.pos.x, y: data.pos.y },
          vel: { x: 0, y: 0 },
          health: 150,
          maxHealth: 150,
          facing: 1,
          grounded: false,
          groundShapeId: "",
          fleeTicks: 0,
          origin: { x: data.pos.x, y: data.pos.y },
          denId: data.id,
        });
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
  const pos = playerSpawnPos(map, p.team, index, hitboxH);
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
    case "shop": {
      const baseTeam = str(data.params, "team") || "RED";
      if (p.team === baseTeam) {
        const hps = num(data.params, "hps", 50);
        p.health = Math.min(maxHealth, p.health + hps * DT);
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

export function spawnCreepDrops(state: GameState, pos: Vec2, killerId?: number): void {
  // Drops a large health pack (200) and 3 silver flux
  state.pickups.push({
    id: state.nextEntityId++,
    kind: "health",
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: -5 },
    amount: 200,
    ticksLeft: 1200,
  });

  for (let i = 0; i < 3; i++) {
    state.pickups.push({
      id: state.nextEntityId++,
      kind: "flux",
      pos: { x: pos.x, y: pos.y },
      vel: killerId !== undefined ? { x: 0, y: 0 } : { x: -2 + i * 2, y: -4 - i },
      amount: 1,
      homingPlayerId: killerId,
      ticksLeft: 1200,
    });
  }
}

export function findActiveBaseForPlayer(
  state: GameState,
  p: PlayerState,
  map: MapData,
  content: ContentIndex,
): MapEntityData | null {
  for (let i = 0; i < map.entities.length; i++) {
    const data = map.entities[i];
    const dyn = state.mapEntities[i];
    if (data === undefined || dyn === undefined || !dyn.enabled) continue;
    if (data.type !== "shop") continue;

    const baseTeam = str(data.params, "team") || "RED";
    if (baseTeam !== p.team) continue;

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
      return data;
    }
  }
  return null;
}

export function buyPlayerUpgrade(
  p: PlayerState,
  upgrade: "speed" | "cooldown" | "damage" | "jump",
): void {
  if (upgrade === "speed" || upgrade === "cooldown" || upgrade === "damage") {
    const currentLvl = p.upgrades[upgrade];
    if (currentLvl < 3) {
      const cost = (currentLvl + 1) * 5;
      if (p.flux >= cost) {
        p.flux -= cost;
        p.upgrades[upgrade] += 1;
      }
    }
  } else if (upgrade === "jump") {
    const currentLvl = p.upgrades.jump;
    if (currentLvl < 1) {
      const cost = 15;
      if (p.flux >= cost) {
        p.flux -= cost;
        p.upgrades.jump += 1;
      }
    }
  }
}
