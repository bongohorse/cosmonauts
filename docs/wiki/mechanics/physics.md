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

## Coordinate System & Map Bounds

The simulation uses a fixed world coordinate system with strict bounds, driven by the netcode/rollback model:

- **Origin:** The center of every map is `(x: 0, y: 0)`.
- **Maximum size:** A map may not exceed `60 × 60` simulation units — bounds of `x: -30 … 30` and `y: -30 … 30`. Positions outside these bounds are not guaranteed to replicate over the network, so geometry and spawns must stay inside.
- **Units:** Content is authored in tiles/seconds and compiled to sim units/ticks by the content loader; the sim itself only ever sees these world units.
