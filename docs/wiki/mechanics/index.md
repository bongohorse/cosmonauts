# Mechanics

The core simulation mechanics govern how the game operates at a fundamental 60Hz tick rate. These rules must be completely deterministic across client and server.

## Categories

### 1. Combat & Damage
- **Damage Types:** Direct ability damage, Area of Effect (AoE), and Damage over Time (DoT).
- **Lifesteal:** Percentage of damage returned as health to the attacker.
- **Shields:** Damage mitigation and absorption barriers.
- **Collision:** Hitbox and hurtbox intersections using AABB (combat) and capsule-based world collision (terrain).

### 2. Movement & Physics
- **Velocity & Acceleration:** Driven by integer ticks, heavily influenced by base movement speed.
- **Jumps & Gravity:** Standard jumping vs hovering vs flying (e.g. Yuri).
- **Status Effects:** Slows, stuns, snares, and knockbacks.

### 3. Economy & Progression
- **Solar:** The primary currency. Earned globally over time, by killing droids, enemy Awesomenauts, or neutral creeps.
- **Upgrades:** Purchased from the shop using Solar.
- **Experience (Levels):** Team-wide levels that scale base health and damage.
