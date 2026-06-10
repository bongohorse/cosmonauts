import { aabbHitsSolid, aabbOverlap, isOnGround, moveAxis } from "./collision";
import { DT, DUMMY_HEIGHT, DUMMY_RESPAWN_TICKS, DUMMY_WIDTH } from "./constants";
import type { CharacterData, ContentIndex, MapData } from "./content-types";
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
  const hw = char.hitbox.w / 2;
  const hh = char.hitbox.h / 2;

  // Horizontal: approach target speed; separate ground/air accel is the air-control lever.
  const accel = p.grounded ? stats.groundAccel : stats.airAccel;
  p.vel.x = approach(p.vel.x, input.moveX * stats.moveSpeed, accel * DT);

  if (input.jump && p.jumpsUsed < stats.maxJumps) {
    p.vel.y = -stats.jumpVelocity;
    p.jumpsUsed += 1;
    p.jumpCutApplied = false;
  }

  // Variable jump height: releasing while rising cuts the jump short, once per jump.
  if (!input.jumpHeld && p.vel.y < 0 && !p.jumpCutApplied) {
    p.vel.y *= stats.jumpCutFactor;
    p.jumpCutApplied = true;
  }

  p.vel.y = Math.min(p.vel.y + stats.gravity * DT, stats.maxFallSpeed);

  // Aim direction controls facing, independent of movement (Awesomenauts-style).
  if (input.aimX > 0.01) p.facing = 1;
  else if (input.aimX < -0.01) p.facing = -1;

  const rx = moveAxis(map, p.pos.x, p.pos.y, hw, hh, p.vel.x * DT, "x");
  p.pos.x = rx.pos;
  if (rx.hit) p.vel.x = 0;

  const ry = moveAxis(map, p.pos.x, p.pos.y, hw, hh, p.vel.y * DT, "y");
  p.pos.y = ry.pos;
  if (ry.hit) p.vel.y = 0;

  p.grounded = p.vel.y >= 0 && isOnGround(map, p.pos.x, p.pos.y, hw, hh);
  if (p.grounded) p.jumpsUsed = 0;

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

function stepProjectiles(state: GameState, map: MapData): void {
  const dummyHw = DUMMY_WIDTH / 2;
  const dummyHh = DUMMY_HEIGHT / 2;

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const pr = state.projectiles[i];
    if (pr === undefined) continue;
    pr.pos.x += pr.vel.x * DT;
    pr.pos.y += pr.vel.y * DT;
    pr.ticksLeft -= 1;

    let dead = pr.ticksLeft <= 0;

    if (!dead && aabbHitsSolid(map, pr.pos.x, pr.pos.y, pr.radius, pr.radius)) {
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
        const thw = 0.4; // M2: players share a generic hit size; real hitboxes come with content lookup in M3
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
