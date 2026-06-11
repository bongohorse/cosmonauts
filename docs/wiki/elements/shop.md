# Zork's Mega Shop

The Shop (often referred to as Zork's Mega Shop) is where Awesomenauts spend their hard-earned Flux to purchase stat modifiers and ability upgrades.

## Mechanics

- **Location:** The shop is integrated into the `base` entity. This zone serves as the team's spawn point, health regeneration area, and shop access all in one.
- **Upgrades:** Players buy upgrades from a per-match loadout. These upgrades modify the stats of their 3 core abilities (e.g., adding damage, reducing cooldowns, granting lifesteal, or altering utility like adding an extra dash).
- **Currency:** Upgrades cost Flux (replacing Solar).

## Implementation Details

- The shop interface relies on the upgrade data structured in the `UpgradeDefSchema`.
- Pre-match loadout selection (choosing which 3 of the 6 available upgrades per ability to bring into the match) is a feature planned for later milestones, but the foundation exists in the data definitions.
