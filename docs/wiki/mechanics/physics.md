# Physics & Movement

Cosmonauts runs on a fixed-timestep 60Hz velocity-based physics simulation. This ensures cross-engine determinism, which is essential for the networking model.

## Core Physics Rules

- **Deterministic Simulation:** The engine relies exclusively on integer ticks (60Hz) to drive durations and velocities. It avoids all non-deterministic math (e.g., `Math.random`, `Date`, standard `Math.sin`/`Math.cos`). 
- **Collision:** The game lacks a rigid-body physics engine like Matter.js. Instead:
  - **World Collision:** Level geometry uses line segments evaluated via capsule-based collision.
  - **Combat Collision:** Hitboxes and hurtboxes use standard Axis-Aligned Bounding Box (AABB) intersections.

## Movement Mechanics

- **Velocity & Acceleration:** Movement is governed by base `moveSpeed`, `groundAccel`, and `airAccel` parameters. The exact time from a keypress to maximum run speed is meticulously tuned to mimic the arcade feel of the original game.
- **Mass & Knockback:** Characters with a higher mass are significantly less affected by physics-based knockbacks and crowd-control effects.
- **Jumping:** Vertical movement is governed by `jumpVelocity`, `gravity`, and `maxFallSpeed`. 
  - *Jump Cut Factor:* Releasing the jump key early applies a cut factor, arresting upward momentum for shorter, controlled hops.
  - *Double Jumping:* The `maxJumps` parameter allows for mid-air jumps. Hitting a Jump Pad instantly resets this counter.
- **Flight & Hovering:** Some characters break standard gravity rules:
  - Characters like Yuri or Ayla (in Rage mode) possess free-flight mechanics, allowing them to ignore platform drop-through requirements entirely.
