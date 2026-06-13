# Jump Pads (Jumpers)

Jump Pads (referred to as `jumper` entities) are trigger volumes that provide rapid vertical or directional mobility across the map.

## Mechanics

- **Impulse on Touch:** Whenever a hero touches a `jumper` volume, they are instantly launched in a specific direction.
- **Configurable Velocity:** The launch force is governed by two parameters:
  - `direction`: The angle of launch in degrees. Unlike standard platforms, a jumper's launch direction is *fully rotatable* (e.g., straight up, 45-degree angle, or horizontal).
  - `strength`: The magnitude of the launch impulse applied to the character's velocity.
- **Cooldown:** Jumpers typically have a short cooldown to prevent players from getting stuck in an infinite bounce loop if they land perfectly on it.

## Usage

Jump pads are crucial for quickly traversing vertical distance, escaping pursuers, or navigating between top and bottom lanes.
