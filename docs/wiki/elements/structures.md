# Structures

Structures are the primary stationary objectives and defensive points on the map. They form the core of the MOBA gameplay loop: defending yours while destroying the enemy's.

## Turrets

Turrets are massive, high-damage defensive structures that block lane progress. 

- **Targeting:** They prioritize attacking Droids over Awesomenauts. To siege a Turret effectively, a team must push a wave of their own Droids into its range to tank the damage.
- **Wiring & Events:** Turrets fire an `onDestroyed` event when their health reaches zero. This is crucial for map flow, as destroying a turret will often trigger a `teamBarrier` to downgrade, opening up the next section of the map or granting access to the enemy base.
- **Rewards:** Destroying an enemy Turret unlocks the **Super Droid** for the attacking team. The Super Droid joins that lane's next wave, providing a powerful snowball effect for objective play.

## The Base Core

The Base Core is the ultimate win condition of the game.

- **Objective:** Destroying the enemy's Base Core wins the match.
- **Defenses:** Cores typically have high health and may have regeneration (`regen` parameter). They are usually protected by the final layer of Turrets and Team Barriers.
- **Events:** Destroying the Core triggers the final `onDestroyed` event that immediately ends the game.
