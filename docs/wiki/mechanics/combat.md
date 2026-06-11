# Combat & Attacks

Combat in Cosmonauts revolves around the interplay between basic attacks, active abilities, and spatial control.

## Abilities vs Auto-Attacks

- **Auto-Attacks:** Every Awesomenaut has a basic attack that costs no resources. The rate at which this attack fires is dictated by the character's **Attack Speed**.
- **Active Abilities:** Characters typically have two unique active abilities. These provide high-impact effects (damage, mobility, crowd control) but are limited by **Cooldowns** (measured in simulation ticks or seconds).

## Ability Mechanics

- **Cooldowns:** The standard limiting factor for ability usage. Once used, an ability cannot be cast again until the cooldown timer resets.
- **Charges:** Some specific abilities can store multiple "charges." This allows a character to cast the ability back-to-back multiple times before the ability goes on its full cooldown sequence.
- **Range & Area of Effect (AoE):** 
  - **Projectiles:** Ranged attacks rely on projectiles which have a defined speed and a set `lifetimeTicks` (or range).
  - **Melee & Explosions:** Close-range attacks and explosive abilities utilize AoE overlaps. This is calculated using Axis-Aligned Bounding Box (AABB) intersections or circular radius checks against enemy hitboxes.
- **Damage Numbers:** The game renders floating damage numbers for clear feedback during combat, which is hooked directly into the rendering client.
