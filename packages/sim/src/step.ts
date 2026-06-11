import { movePlayer } from "./capsule";
import { aabbOverlap } from "./collision";
import { DROP_IGNORE_TICKS, DT, DUMMY_HEIGHT, DUMMY_RESPAWN_TICKS, DUMMY_WIDTH } from "./constants";
import type { CharacterData, ContentIndex, MapData } from "./content-types";
import { spawnDroppedPickups, spawnPlayerDrops, stepMapEntities, triggerTargets } from "./entities";
import { closestSegSeg } from "./geometry";
import { NEUTRAL_INPUT, type PlayerInput } from "./input";
import { approach } from "./math";
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
    stepPlayer(state, player, inputs[player.id] ?? NEUTRAL_INPUT, char, map);
  }

  stepProjectiles(state, map);
  stepMapEntities(state, map, content);
  stepPickups(state, map, content);
  stepDummies(state);

  state.tick += 1;
}

function stepPlayer(
  state: GameState,
  p: PlayerState,
  input: PlayerInput,
  char: CharacterData,
  map: MapData,
): void {
  const { stats, attack } = char;

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
  } else if (input.jump && p.jumpsUsed < stats.maxJumps) {
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
    const next = approach(along, input.moveX * stats.moveSpeed, stats.groundAccel * DT);
    p.vel.x = tx * next;
    p.vel.y = ty * next;
  } else {
    p.vel.x = approach(p.vel.x, input.moveX * stats.moveSpeed, stats.airAccel * DT);
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
    state.projectiles.push({
      id: state.nextEntityId++,
      ownerId: p.id,
      pos: { x: p.pos.x, y: p.pos.y },
      vel: { x: dirX * attack.projectileSpeed, y: dirY * attack.projectileSpeed },
      radius: attack.projectileRadius,
      damage: attack.damage,
      ticksLeft: attack.lifetimeTicks,
    });
    p.attackCooldown = attack.cooldownTicks;
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
    const entityIndex = map.entities.findIndex((e) => e.id === seg.shapeId);
    if (entityIndex !== -1) {
      const data = map.entities[entityIndex];
      const dyn = state.mapEntities[entityIndex];
      if (data && dyn) {
        if (data.type === "door") {
          // An enabled door blocks projectiles; a disabled door does not.
          if (!dyn.enabled) continue;
        } else if (data.type === "teamBarrier") {
          // teamBarrier never blocks shots
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
      for (const target of state.players) {
        if (target.id === pr.ownerId || target.health <= 0) continue;
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

function stepPickups(state: GameState, map: MapData, content: ContentIndex): void {
  const isSolid = (x: number, y: number) => {
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return true;
    return map.solid[Math.floor(y) * map.width + Math.floor(x)] === true;
  };

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];
    if (pickup === undefined) continue;

    pickup.ticksLeft -= 1;
    let destroyed = pickup.ticksLeft <= 0 || pickup.pos.y > map.height + 5;

    if (!destroyed) {
      if (pickup.homingPlayerId !== undefined) {
        const target = state.players.find((p) => p.id === pickup.homingPlayerId);
        if (target && target.health > 0) {
          const dx = target.pos.x - pickup.pos.x;
          const dy = target.pos.y - pickup.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.4) {
            if (pickup.kind === "flux") {
              target.flux += pickup.amount;
            } else if (pickup.kind === "health") {
              const char = content.characters[target.characterId];
              const maxHp = char ? char.stats.maxHealth : 100;
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

        if (isSolid(pickup.pos.x, nextY)) {
          if (pickup.vel.y > 0) {
            pickup.pos.y = Math.floor(nextY);
          }
          pickup.vel.y = 0;
          pickup.vel.x = 0;
        } else {
          pickup.pos.y = nextY;
        }

        if (isSolid(nextX, pickup.pos.y)) {
          pickup.vel.x = 0;
        } else {
          pickup.pos.x = nextX;
        }

        for (const p of state.players) {
          if (p.health <= 0) continue;
          const char = content.characters[p.characterId];
          if (char === undefined) continue;
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
