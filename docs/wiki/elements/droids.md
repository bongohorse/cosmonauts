# Droids

Droids are the map/lane creep units that push objectives and engage in combat for their respective teams. 

## Role & Mechanics

- **Pushing & Tanking:** Droids block enemy pushes and, most importantly, tank damage from enemy Turrets. Turrets prioritize droids over Awesomenauts, making them essential for sieging bases.
- **Pathing:** They spawn and automatically walk along predefined waypoints in their lane, attacking enemies they encounter via melee.
- **Spawners:** Droids spawn from a `droidSpawner` entity on a fixed interval per lane.

## Droid Types

There are three distinct types of droids:

1. **Small Droid**
   - The standard wave unit.
   - Spawns in pairs of **2 per lane** on a set interval.

2. **Super Droid**
   - A heavy, rocket-launcher equipped droid with significantly more health and damage.
   - **Unlock condition:** Granted to the team that destroys an enemy turret. The Super Droid joins that lane's next wave, acting as a snowball reward for objective play.

3. **Flying Droid**
   - Released from a `droidContainer` via an activation button.
   - Flies along a predefined path, dropping bombs or attacking from above.
