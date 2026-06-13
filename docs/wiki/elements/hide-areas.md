# Hide Areas (Hide Zones)

Hide Areas (referred to as `hideZone` entities in the Cosmonauts map format) are specialized trigger volumes that provide stealth and ambush opportunities for heroes.

## Mechanics

- **Stealth:** Heroes standing inside a `hideZone` are completely hidden from the enemy team's vision. They cannot be seen on the main screen or the minimap.
- **Breaking Stealth:** The stealth effect is broken the moment a hero inside the zone performs an action (such as attacking or casting a spell).
- **Vision Limitations:** While inside a hide area, a player's vision radius is typically restricted to the area itself and a small radius outside, although this can vary by map design.

## Map Design

- Hide areas are placed directly onto the map using the `hideZone` entity type.
- They are typically placed in strategic chokepoints or off-lane "jungle" areas to facilitate ambushes and ganks.
