import { movePlayer } from "./capsule";
import { aabbOverlap } from "./collision";
import {
  DROP_IGNORE_TICKS,
  DT,
  DUMMY_HEIGHT,
  DUMMY_RESPAWN_TICKS,
  DUMMY_WIDTH,
  FLUX_INTERVAL_TICKS,
} from "./constants";
import type { CharacterData, ContentIndex, MapData } from "./content-types";
import {
  buyPlayerUpgrade,
  findActiveBaseForPlayer,
  spawnCreepDrops,
  spawnDroppedPickups,
  spawnPlayerDrops,
  stepMapEntities,
  triggerTargets,
} from "./entities";
import { closestSegSeg } from "./geometry";
import { NEUTRAL_INPUT, type PlayerInput } from "./input";
import { approach, rand, type Vec2 } from "./math";
import type { GameState, PlayerState } from "./state";

export type InputMap = Record<number, PlayerInput>;

/** Advance the world exactly one tick. Mutates `state` (doc 02 §10). */
export function step(state: GameState, inputs: InputMap, content: ContentIndex): void {
  const map = content.maps[state.mapId];
  if (map === undefined) throw new Error(`unknown map "${state.mapId}"`);

  // Reset active state for momentary activators and timers at the start of the tick.
  // This allows touch or projectile hits to set it to true during the tick.
  for (let i = 0; i < map.entities.length; i++) {
    const dyn = state.mapEntities[i];
    if (dyn === undefined) continue;
    const data = map.entities[i];
    if (data && (data.type === "activator" || data.type === "timer")) {
      dyn.active = false;
    }
  }

  for (const player of state.players) {
    const char = content.characters[player.characterId];
    if (char === undefined) throw new Error(`unknown character "${player.characterId}"`);
    stepPlayer(state, player, inputs[player.id] ?? NEUTRAL_INPUT, char, map, content);
  }

  stepProjectiles(state, map);
  stepMapEntities(state, map, content);
  stepPickups(state, map, content);
  stepCreeps(state, map, content);
  stepDummies(state);
  stepDroids(state, map, content);

  // Passive flux income: +1 flux every 2 seconds for living players.
  if (state.tick > 0 && state.tick % FLUX_INTERVAL_TICKS === 0) {
    for (const p of state.players) {
      if (p.health > 0) p.flux += 1;
    }
  }

  state.tick += 1;
}

function stepPlayer(
  state: GameState,
  p: PlayerState,
  input: PlayerInput,
  char: CharacterData,
  map: MapData,
  content: ContentIndex,
): void {
  const { stats, attack } = char;

  if (input.buyUpgrade) {
    const activeBase = findActiveBaseForPlayer(state, p, map, content);
    if (activeBase !== null) {
      buyPlayerUpgrade(p, input.buyUpgrade);
    }
  }

  const currentMoveSpeed = stats.moveSpeed + p.upgrades.speed * 1.5;
  const maxJumps = stats.maxJumps + p.upgrades.jump;

  if (p.dropTicks > 0) {
    p.dropTicks -= 1;
    if (p.dropTicks === 0) p.dropShapeId = "";
  }

  // Down on glass drops through — held or pressed, with or without jump
  // (doc 06 §4a). A jump press in the same tick is absorbed: a drop is not a jump.
  let jumpedThisTick = false;
  if (p.grounded && p.groundGlass && input.down) {
    p.dropShapeId = p.groundShapeId;
    p.dropTicks = DROP_IGNORE_TICKS;
    p.grounded = false;
    if (p.vel.y < 2) p.vel.y = 2; // exit the face this tick
  } else if (input.jump && p.jumpsUsed < maxJumps) {
    p.vel.y = -stats.jumpVelocity;
    p.jumpsUsed += 1;
    p.jumpCutApplied = false;
    jumpedThisTick = true;
    p.grounded = false;
  }

  // Variable jump height: releasing while rising cuts the jump short, once per jump.
  if (!input.jumpHeld && p.vel.y < 0 && !p.jumpCutApplied) {
    p.vel.y *= stats.jumpCutFactor;
    p.jumpCutApplied = true;
  }

  if (p.grounded) {
    // Walk along the ground tangent at constant surface speed (doc 06 §4).
    let tx = -p.groundNY;
    let ty = p.groundNX;
    if (tx < 0) {
      tx = -tx;
      ty = -ty;
    }
    const along = p.vel.x * tx + p.vel.y * ty;
    const next = approach(along, input.moveX * currentMoveSpeed, stats.groundAccel * DT);
    p.vel.x = tx * next;
    p.vel.y = ty * next;
  } else {
    p.vel.x = approach(p.vel.x, input.moveX * currentMoveSpeed, stats.airAccel * DT);
    p.vel.y = Math.min(p.vel.y + stats.gravity * DT, stats.maxFallSpeed);
  }

  // Aim direction controls facing, independent of movement (Awesomenauts-style).
  if (input.aimX > 0.01) p.facing = 1;
  else if (input.aimX < -0.01) p.facing = -1;

  movePlayer(state, map, p, char, jumpedThisTick);

  if (p.attackCooldown > 0) p.attackCooldown -= 1;
  if (input.shoot && p.attackCooldown === 0) {
    const len = Math.sqrt(input.aimX * input.aimX + input.aimY * input.aimY);
    const dirX = len > 0.001 ? input.aimX / len : p.facing;
    const dirY = len > 0.001 ? input.aimY / len : 0;

    const currentDamage = attack.damage + p.upgrades.damage * 5;
    const cooldownReduction = p.upgrades.cooldown * 0.15;
    const currentCooldown = Math.max(1, Math.round(attack.cooldownTicks * (1 - cooldownReduction)));

    state.projectiles.push({
      id: state.nextEntityId++,
      ownerId: p.id,
      team: p.team,
      pos: { x: p.pos.x, y: p.pos.y },
      vel: { x: dirX * attack.projectileSpeed, y: dirY * attack.projectileSpeed },
      radius: attack.projectileRadius,
      damage: currentDamage,
      ticksLeft: attack.lifetimeTicks,
    });
    p.attackCooldown = currentCooldown;
  }
}

/** Swept circle vs solid segments — fast shots can't tunnel (doc 06 §5). */
function projectileHitsWorld(
  state: GameState,
  map: MapData,
  ox: number,
  oy: number,
  nx: number,
  ny: number,
  radius: number,
): boolean {
  const r2 = radius * radius;
  for (const seg of map.segments) {
    // Check if this segment belongs to a door entity.
    const entityIndex = map.entityIdToIndex[seg.shapeId] ?? -1;
    if (entityIndex !== -1) {
      const data = map.entities[entityIndex];
      const dyn = state.mapEntities[entityIndex];
      if (data && dyn) {
        if (data.type === "door") {
          // An enabled door blocks projectiles; a disabled door does not.
          if (!dyn.enabled) continue;
        } else if (data.type === "teamBarrier" || data.type === "turret") {
          // teamBarrier and turret never block shots
          continue;
        }
      }
    } else {
      if (seg.solidity !== "solid") continue; // glass/team never block shots
    }
    const cs = closestSegSeg(ox, oy, nx, ny, seg.ax, seg.ay, seg.bx, seg.by);
    if (cs.dist2 <= r2) return true;
  }
  return false;
}

function stepProjectiles(state: GameState, map: MapData): void {
  const dummyHw = DUMMY_WIDTH / 2;
  const dummyHh = DUMMY_HEIGHT / 2;

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const pr = state.projectiles[i];
    if (pr === undefined) continue;
    const ox = pr.pos.x;
    const oy = pr.pos.y;
    pr.pos.x += pr.vel.x * DT;
    pr.pos.y += pr.vel.y * DT;
    pr.ticksLeft -= 1;

    let dead = pr.ticksLeft <= 0;

    if (!dead && projectileHitsWorld(state, map, ox, oy, pr.pos.x, pr.pos.y, pr.radius)) {
      dead = true;
    }

    // Check hit against damage-triggered activators
    if (!dead) {
      for (let j = 0; j < map.entities.length; j++) {
        const entData = map.entities[j];
        const entDyn = state.mapEntities[j];
        if (entData && entDyn?.enabled && entData.type === "activator") {
          const trigger = entData.params.trigger ?? "touch";
          if (trigger === "damage") {
            const hw = entData.size.w / 2;
            const hh = entData.size.h / 2;
            if (
              aabbOverlap(
                pr.pos.x,
                pr.pos.y,
                pr.radius,
                pr.radius,
                entData.pos.x,
                entData.pos.y,
                hw,
                hh,
              )
            ) {
              const mode = entData.params.mode ?? "toggle";
              if (mode === "momentary") {
                entDyn.active = true;
              } else if (mode === "once") {
                if (!entDyn.triggered) {
                  entDyn.triggered = true;
                  triggerTargets(state, map, entData.targets);
                }
              } else if (mode === "toggle" && entDyn.cooldown === 0) {
                triggerTargets(state, map, entData.targets);
                // Cooldown parameter converted to ticks on sim side:
                const cdTicks =
                  typeof entData.params.cooldownTicks === "number"
                    ? entData.params.cooldownTicks
                    : 30;
                entDyn.cooldown = cdTicks;
              }
              dead = true;
              break;
            }
          }
        }
      }
    }

    if (!dead) {
      for (const d of state.dummies) {
        if (d.health <= 0) continue;
        if (
          aabbOverlap(pr.pos.x, pr.pos.y, pr.radius, pr.radius, d.pos.x, d.pos.y, dummyHw, dummyHh)
        ) {
          d.health -= pr.damage;
          if (d.health <= 0) {
            d.respawnTicks = DUMMY_RESPAWN_TICKS;
            spawnDroppedPickups(state, d.pos, pr.ownerId);
          }
          dead = true;
          break;
        }
      }
    }

    if (!dead) {
      for (const c of state.creeps) {
        if (c.health <= 0) continue;
        const thw = 0.4;
        const thh = 0.45;
        if (aabbOverlap(pr.pos.x, pr.pos.y, pr.radius, pr.radius, c.pos.x, c.pos.y, thw, thh)) {
          c.health -= pr.damage;
          dead = true;
          break;
        }
      }
    }

    if (!dead) {
      for (const d of state.droids) {
        if (d.health <= 0 || d.team === pr.team) continue;
        const thw = 0.4;
        const thh = 0.8;
        if (aabbOverlap(pr.pos.x, pr.pos.y, pr.radius, pr.radius, d.pos.x, d.pos.y, thw, thh)) {
          d.health -= pr.damage;
          if (d.health <= 0) {
            spawnDroppedPickups(state, d.pos, pr.ownerId);
          }
          dead = true;
          break;
        }
      }
    }

    if (!dead) {
      for (let j = 0; j < map.entities.length; j++) {
        const entData = map.entities[j];
        const entDyn = state.mapEntities[j];
        if (!entData || !entDyn || entDyn.health === undefined || entDyn.health <= 0) continue;
        const team = typeof entData.params.team === "string" ? entData.params.team : undefined;
        if (team === pr.team) continue;

        const hw = entData.size.w / 2;
        const hh = entData.size.h / 2;
        if (
          aabbOverlap(
            pr.pos.x,
            pr.pos.y,
            pr.radius,
            pr.radius,
            entData.pos.x,
            entData.pos.y,
            hw,
            hh,
          )
        ) {
          entDyn.health -= pr.damage;
          if (entDyn.health <= 0) {
            entDyn.dead = true;
            if (entData.type === "core") {
              state.gameOver = { winner: pr.team, ticksLeft: 300 }; // 5 seconds at 60fps
            }
            if (entData.onDestroyed) triggerTargets(state, map, entData.onDestroyed);
            spawnDroppedPickups(state, entData.pos, pr.ownerId);
          }
          dead = true;
          break;
        }
      }
    }

    if (!dead) {
      for (const target of state.players) {
        if (target.team === pr.team || target.health <= 0) continue;
        const thw = 0.4; // M2-era: shared hit size; per-character hitbox lookup comes with teams/M4
        const thh = 0.8;
        if (
          aabbOverlap(
            pr.pos.x,
            pr.pos.y,
            pr.radius,
            pr.radius,
            target.pos.x,
            target.pos.y,
            thw,
            thh,
          )
        ) {
          const oldHealth = target.health;
          target.health = Math.max(0, target.health - pr.damage);
          if (oldHealth > 0 && target.health <= 0) {
            spawnPlayerDrops(state, target.pos, pr.ownerId);
          }
          dead = true;
          break;
        }
      }
    }

    if (dead) state.projectiles.splice(i, 1);
  }
}

function stepDummies(state: GameState): void {
  for (const d of state.dummies) {
    if (d.health <= 0) {
      d.respawnTicks -= 1;
      if (d.respawnTicks <= 0) d.health = d.maxHealth;
    }
  }
}

function pickupHitsWorld(
  state: GameState,
  map: MapData,
  ox: number,
  oy: number,
  nx: number,
  ny: number,
  radius: number,
  velY: number,
): { hit: boolean; normalY: number } | null {
  const r2 = radius * radius;
  for (const seg of map.segments) {
    const entityIndex = map.entityIdToIndex[seg.shapeId] ?? -1;
    if (entityIndex !== -1) {
      const data = map.entities[entityIndex];
      const dyn = state.mapEntities[entityIndex];
      if (data && dyn) {
        if (data.type === "door") {
          if (!dyn.enabled) continue;
        } else if (data.type === "teamBarrier") {
          continue;
        }
      }
    } else {
      if (seg.solidity !== "solid" && seg.solidity !== "glass") {
        continue;
      }
    }

    if (seg.solidity === "glass") {
      if (velY < 0) continue; // rising passes through
      if (seg.ny > -0.1) continue; // only up-facing fronts are landable
      const faceTop = Math.min(seg.ay, seg.by);
      if (oy > faceTop + 0.1) continue; // already below it
    }

    const cs = closestSegSeg(ox, oy, nx, ny, seg.ax, seg.ay, seg.bx, seg.by);
    if (cs.dist2 <= r2) {
      return { hit: true, normalY: seg.ny };
    }
  }
  return null;
}

function stepPickups(state: GameState, map: MapData, content: ContentIndex): void {
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];
    if (pickup === undefined) continue;

    pickup.ticksLeft -= 1;
    let destroyed = pickup.ticksLeft <= 0 || pickup.pos.y > map.height + 5;

    if (!destroyed) {
      if (pickup.homingPlayerId !== undefined) {
        const target = state.players.find((p) => p.id === pickup.homingPlayerId);
        if (target && target.health > 0) {
          const char = content.characters[target.characterId];
          const maxHp = char ? char.stats.maxHealth : 100;
          if (pickup.kind === "health" && target.health >= maxHp) {
            pickup.homingPlayerId = undefined;
            pickup.vel.x = 0;
            pickup.vel.y = 0;
          } else {
            const dx = target.pos.x - pickup.pos.x;
            const dy = target.pos.y - pickup.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.4) {
              if (pickup.kind === "flux") {
                target.flux += pickup.amount;
              } else if (pickup.kind === "health") {
                target.health = Math.min(maxHp, target.health + pickup.amount);
              }
              destroyed = true;
            } else {
              const speed = 15;
              pickup.vel.x = (dx / dist) * speed;
              pickup.vel.y = (dy / dist) * speed;
              pickup.pos.x += pickup.vel.x * DT;
              pickup.pos.y += pickup.vel.y * DT;
            }
          }
        } else {
          pickup.homingPlayerId = undefined;
          pickup.vel.x = 0;
          pickup.vel.y = 0;
        }
      }

      if (pickup.homingPlayerId === undefined) {
        pickup.vel.y += 15 * DT;
        const nextX = pickup.pos.x + pickup.vel.x * DT;
        const nextY = pickup.pos.y + pickup.vel.y * DT;
        const radius = 0.25;

        const hitX = pickupHitsWorld(
          state,
          map,
          pickup.pos.x,
          pickup.pos.y,
          nextX,
          pickup.pos.y,
          radius,
          pickup.vel.y,
        );
        if (hitX) {
          pickup.vel.x = 0;
        } else {
          pickup.pos.x = nextX;
        }

        const hitY = pickupHitsWorld(
          state,
          map,
          pickup.pos.x,
          pickup.pos.y,
          pickup.pos.x,
          nextY,
          radius,
          pickup.vel.y,
        );
        if (hitY) {
          if (pickup.vel.y > 0) {
            pickup.vel.y = 0;
            pickup.vel.x = 0;
          } else {
            pickup.vel.y = 0;
          }
        } else {
          pickup.pos.y = nextY;
        }

        for (const p of state.players) {
          if (p.health <= 0) continue;
          const char = content.characters[p.characterId];
          if (char === undefined) continue;
          if (pickup.kind === "health" && p.health >= char.stats.maxHealth) {
            continue;
          }
          const hw = char.hitbox.w / 2;
          const hh = char.hitbox.h / 2;
          const inside = aabbOverlap(
            pickup.pos.x,
            pickup.pos.y,
            0.3,
            0.3,
            p.pos.x,
            p.pos.y,
            hw,
            hh,
          );
          if (inside) {
            if (pickup.kind === "flux") {
              p.flux += pickup.amount;
            } else if (pickup.kind === "health") {
              p.health = Math.min(char.stats.maxHealth, p.health + pickup.amount);
            }
            destroyed = true;
            break;
          }
        }
      }
    }

    if (destroyed) {
      state.pickups.splice(i, 1);
    }
  }
}

export function stepDroids(state: GameState, map: MapData, _content: ContentIndex): void {
  for (let i = state.droids.length - 1; i >= 0; i--) {
    const d = state.droids[i];
    if (!d) continue;

    if (d.health <= 0) {
      state.droids.splice(i, 1);
      continue;
    }

    if (d.attackCooldown > 0) d.attackCooldown -= 1;

    // AI: find closest enemy target (player, turret, or core)
    let targetPos: Vec2 | null = null;
    let targetHW = 0;
    let minDist = 15 * 15;

    for (const p of state.players) {
      if (p.health <= 0 || p.team === d.team) continue;
      if (Math.abs(p.pos.y - d.pos.y) > 4) continue;
      const dist2 = (p.pos.x - d.pos.x) ** 2 + (p.pos.y - d.pos.y) ** 2;
      if (dist2 < minDist) {
        minDist = dist2;
        targetPos = p.pos;
        targetHW = 0.4;
      }
    }

    for (let j = 0; j < map.entities.length; j++) {
      const data = map.entities[j];
      const dyn = state.mapEntities[j];
      if (!data || !dyn || dyn.dead || (data.type !== "turret" && data.type !== "core")) continue;
      const team = typeof data.params.team === "string" ? data.params.team : undefined;
      if (team === d.team) continue;
      if (Math.abs(data.pos.y - d.pos.y) > Math.max(4, data.size.h / 2 + 2)) continue;
      const dist2 = (data.pos.x - d.pos.x) ** 2 + (data.pos.y - d.pos.y) ** 2;
      if (dist2 < minDist) {
        minDist = dist2;
        targetPos = data.pos;
        targetHW = data.size.w / 2;
      }
    }

    for (const otherD of state.droids) {
      if (otherD.id === d.id || otherD.health <= 0 || otherD.team === d.team) continue;
      if (Math.abs(otherD.pos.y - d.pos.y) > 4) continue;
      const dist2 = (otherD.pos.x - d.pos.x) ** 2 + (otherD.pos.y - d.pos.y) ** 2;
      if (dist2 < minDist) {
        minDist = dist2;
        targetPos = otherD.pos;
        targetHW = 0.4;
      }
    }

    for (const c of state.creeps) {
      if (c.health <= 0) continue;
      if (Math.abs(c.pos.y - d.pos.y) > 4) continue;
      const dist2 = (c.pos.x - d.pos.x) ** 2 + (c.pos.y - d.pos.y) ** 2;
      if (dist2 < minDist) {
        minDist = dist2;
        targetPos = c.pos;
        targetHW = 0.4;
      }
    }

    // Walk forward if no target
    const speed = 2; // Slower
    let moveDir = 0;
    let jumpRequested = false;

    if (targetPos) {
      const dx = targetPos.x - d.pos.x;
      const dist = Math.abs(dx);
      if (dist > 2 + targetHW) {
        // Shorter attack range
        moveDir = Math.sign(dx);
      } else {
        // Attack!
        d.facing = (Math.sign(dx) as 1 | -1) || d.facing;
        if (d.attackCooldown === 0) {
          const dy = targetPos.y - d.pos.y;
          const distFull = Math.sqrt(dx * dx + dy * dy);
          const pSpeed = 5; // Slow range attack
          state.projectiles.push({
            id: state.nextEntityId++,
            team: d.team,
            pos: { x: d.pos.x, y: d.pos.y },
            vel: { x: (dx / distFull) * pSpeed, y: (dy / distFull) * pSpeed },
            radius: 0.2,
            damage: 20,
            ticksLeft: 30,
          });
          d.attackCooldown = 60; // 1 second
        }
      }
    } else if (d.pathTargetId) {
      const pathNode = map.entities.find((e) => e.id === d.pathTargetId);
      if (pathNode) {
        const dx = pathNode.pos.x - d.pos.x;
        const dy = pathNode.pos.y - d.pos.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 1.0) {
          moveDir = Math.abs(dx) > 0.1 ? Math.sign(dx) : 0;
          // Request jump if we are directly below the node
          if (Math.abs(dx) <= 0.5 && dy < -0.5) {
            jumpRequested = true;
          }
        } else {
          // Reached node! Pick next node
          let nextId =
            typeof pathNode.params.nextId === "string" ? pathNode.params.nextId : undefined;
          const branchId =
            typeof pathNode.params.branchId === "string" ? pathNode.params.branchId : undefined;

          if (nextId && branchId) {
            const [val, nextRng] = rand(state.rng);
            state.rng = nextRng;
            if (val > 0.5) {
              nextId = branchId;
            }
          } else if (branchId) {
            nextId = branchId;
          }

          d.pathTargetId = nextId;
          moveDir = d.facing; // Keep moving this tick
        }
      } else {
        moveDir = d.facing;
      }
    } else {
      // Just walk in facing direction
      moveDir = d.facing;
    }

    if (moveDir !== 0) {
      d.facing = moveDir as 1 | -1;
      d.vel.x = approach(d.vel.x, moveDir * speed, 20 * DT);

      // Jump if stuck
      if (d.grounded && Math.abs(d.vel.x) < 0.5) {
        jumpRequested = true;
      }
    } else {
      d.vel.x = approach(d.vel.x, 0, 20 * DT);
    }

    if (jumpRequested && d.grounded) {
      d.vel.y = -12; // Jump force
      d.grounded = false;
    }

    // Move (very simplified)
    d.vel.y += 30 * DT; // gravity

    // Use player move logic by creating mock player and char objects
    const mockP = {
      id: d.id,
      characterId: "",
      team: d.team,
      pos: d.pos,
      vel: d.vel,
      facing: d.facing,
      grounded: d.grounded,
      groundNX: 0,
      groundNY: 0,
      groundShapeId: d.groundShapeId,
      groundGlass: false,
      dropShapeId: "",
      dropTicks: 0,
      jumpsUsed: 0,
      jumpCutApplied: false,
      attackCooldown: 0,
      health: d.health,
      flux: 0,
      upgrades: { speed: 0, cooldown: 0, damage: 0, jump: 0 },
    };
    // biome-ignore lint/suspicious/noExplicitAny: valid
    const mockChar = { hitbox: { w: 0.8, h: 0.9 } } as any;

    movePlayer(state, map, mockP as PlayerState, mockChar, false);

    d.pos.x = mockP.pos.x;
    d.pos.y = mockP.pos.y;
    d.vel.x = mockP.vel.x;
    d.vel.y = mockP.vel.y;
    d.grounded = mockP.grounded;
    d.groundShapeId = mockP.groundShapeId;
  }
}

export function stepCreeps(state: GameState, map: MapData, _content: ContentIndex): void {
  for (let i = state.creeps.length - 1; i >= 0; i--) {
    const c = state.creeps[i];
    if (!c) continue;

    if (c.health <= 0) {
      // Find the den and start its cooldown
      const denIdx = map.entityIdToIndex[c.denId] ?? -1;
      if (denIdx !== -1) {
        const denDyn = state.mapEntities[denIdx];
        const denData = map.entities[denIdx];
        if (denDyn && denData) {
          denDyn.cooldown =
            typeof denData.params.respawnTimeTicks === "number"
              ? denData.params.respawnTimeTicks
              : 1200;
        }
      }

      spawnCreepDrops(state, c.pos);
      state.creeps.splice(i, 1);
      continue;
    }

    if (c.fleeTicks > 0) c.fleeTicks -= 1;

    // AI: find closest enemy target (player or droid)
    let dangerDir = 0;
    let minDist = 4 * 4; // reduced detection radius to 4 tiles

    for (const p of state.players) {
      if (p.health <= 0) continue;
      const dx = p.pos.x - c.pos.x;
      const dy = p.pos.y - c.pos.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < minDist) {
        minDist = dist2;
        dangerDir = Math.sign(dx);
      }
    }

    for (const d of state.droids) {
      if (d.health <= 0) continue;
      const dx = d.pos.x - c.pos.x;
      const dy = d.pos.y - c.pos.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < minDist) {
        minDist = dist2;
        dangerDir = Math.sign(dx);
      }
    }

    let speed = 1.0; // Slow walk
    let moveDir = 0;

    if (dangerDir !== 0) {
      // Flee from danger!
      c.fleeTicks = 30; // Flee for 0.5 seconds (reduced spook duration)
      moveDir = -dangerDir;
      speed = 2.5; // Quicker escape (reduced from 3.5)
    } else if (c.fleeTicks > 0) {
      // Keep fleeing in facing direction
      moveDir = c.facing;
      speed = 2.5;
    } else {
      // Just pace back and forth near origin
      moveDir = c.facing;
      if (c.pos.x > c.origin.x + 4)
        moveDir = -1; // Increased wander distance to 4
      else if (c.pos.x < c.origin.x - 4) moveDir = 1;
    }

    if (moveDir !== 0) {
      c.facing = moveDir as 1 | -1;
      c.vel.x = approach(c.vel.x, moveDir * speed, 20 * DT);

      // Jump if stuck (same as droids)
      if (c.grounded && Math.abs(c.vel.x) < 0.5 && moveDir === c.facing) {
        c.vel.y = -12; // Jump force
        c.grounded = false;
      }
    } else {
      c.vel.x = approach(c.vel.x, 0, 20 * DT);
    }

    c.vel.y += 30 * DT; // gravity

    // Use player move logic by creating mock player
    const mockP = {
      id: c.id,
      characterId: "",
      // biome-ignore lint/suspicious/noExplicitAny: valid
      team: "NEUTRAL" as any,
      pos: c.pos,
      vel: c.vel,
      facing: c.facing,
      grounded: c.grounded,
      groundNX: 0,
      groundNY: 0,
      groundShapeId: c.groundShapeId,
      groundGlass: false,
      dropShapeId: "",
      dropTicks: 0,
      jumpsUsed: 0,
      jumpCutApplied: false,
      attackCooldown: 0,
      health: c.health,
      flux: 0,
      upgrades: { speed: 0, cooldown: 0, damage: 0, jump: 0 },
    };
    // biome-ignore lint/suspicious/noExplicitAny: valid
    const mockChar = { hitbox: { w: 0.8, h: 0.9 } } as any;

    movePlayer(state, map, mockP as PlayerState, mockChar, false);

    c.pos.x = mockP.pos.x;
    c.pos.y = mockP.pos.y;
    c.vel.x = mockP.vel.x;
    c.vel.y = mockP.vel.y;
    c.grounded = mockP.grounded;
    c.groundShapeId = mockP.groundShapeId;
  }
}
