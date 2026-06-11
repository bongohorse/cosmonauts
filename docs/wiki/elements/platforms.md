# Platforms

Platforms form the core geometry and collision framework of any Cosmonauts map. They dictate where players can walk, jump, and fall.

## Types of Platforms

Platforms in Cosmonauts are implemented as geometry solidity types (rectangles, polygons, etc.) rather than trigger volumes.

### Solid Geometry
- The standard terrain. Characters cannot pass through it in any direction.

### Glass Platforms
- A one-way platform that provides vertical flexibility.
- **Behavior:** Players can jump *up* through a glass platform from below, and they will land and stand on top of it.
- **Dropping Down:** Players can choose to drop *down* through a glass platform they are standing on by pressing `Down` (or `Down + Jump`).

### Moving Platforms
- Platforms that travel along a predefined waypoint loop.
- The `movingPlatform` entity allows designers to set the `path`, `speed`, and `mode`.
- Currently, players riding a moving platform inherit its velocity, allowing for dynamic puzzles and traversal challenges.

## Composition

Complex structures are built by composing basic platforms with other entities. For example, a base entrance might consist of a glass platform wrapped inside a `teamBarrier` (Energy Wall). This allows defenders to drop in and out freely, while attackers are walled off until the barrier is downgraded.
