import { movePlayer } from "./capsule";
import { aabbOverlap } from "./collision";
import { DROP_IGNORE_TICKS, DT, DUMMY_HEIGHT, DUMMY_RESPAWN_TICKS, DUMMY_WIDTH } from "./constants";
import type { CharacterData, ContentIndex, MapData } from "./content-types";
import { stepMapEntities } from "./entities";
import { closestSegSeg } from "./geometry";
import { NEUTRAL_INPUT, type PlayerInput } from "./input";
import { approach } from "./math";
import type { GameState, PlayerState } from "./state";

export type InputMap = Record<number, PlayerInput>;

/** Advance the world exactly one tick. Mutates `state` (doc 02 §10). */
export function step(state: GameState, inputs: InputMap, content: ContentIndex): void {
  const map = content.maps[state.mapId];
  if (map === undefined) throw new Error(`unknown map "${state.mapId}"`);

  for (const player of state.players) {
    const char = content.characters[player.characterId];
    if (char === undefined) throw new Error(`unknown character "${player.characterId}"`);
    stepPlayer(state, player, inputs[player.id] ?? NEUTRAL_INPUT, char, map);
  }

  stepProjectiles(state, map);
  stepMapEntities(state, map, content);
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

  movePlayer(map, p, char, jumpedThisTick);

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
  map: MapData,
  ox: number,
  oy: number,
  nx: number,
  ny: number,
  radius: number,
): boolean {
  const r2 = radius * radius;
  for (const seg of map.segments) {
    if (seg.solidity !== "solid") continue; // glass/team never block shots
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

    if (!dead && projectileHitsWorld(map, ox, oy, pr.pos.x, pr.pos.y, pr.radius)) {
      dead = true;
    }

    if (!dead) {
      for (const d of state.dummies) {
        if (d.health <= 0) continue;
        if (
          aabbOverlap(pr.pos.x, pr.pos.y, pr.radius, pr.radius, d.pos.x, d.pos.y, dummyHw, dummyHh)
        ) {
          d.health -= pr.damage;
          if (d.health <= 0) d.respawnTicks = DUMMY_RESPAWN_TICKS;
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
          target.health = Math.max(0, target.health - pr.damage);
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
