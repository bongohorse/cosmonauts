# Energy Walls (Team Barriers)

Energy Walls (referred to as **Team Barriers** in the Cosmonauts engine) are stateful colliders that restrict or allow movement based on team affiliation.

## Mechanics

- **Filtering:** A Team Barrier acts like "glass" (pass-through) for the owning team, but fully blocks the enemy team.
- **Placement:** They can be placed horizontally or vertically at any rotation.
- **Downgrading:** Barriers are often wired to an objective (like a Turret's `onDestroyed` event). When disabled, the barrier **downgrades**:
  - `glass`: Becomes a glass platform that *everyone* can pass through.
  - `gone`: Disappears entirely.

## Strategic Use

A classic composition is a glass platform at a base entrance wrapped in a Team Barrier. Defenders can drop in and out freely, but attackers are walled off until they destroy the outer turret, at which point the barrier downgrades and opens the base.
