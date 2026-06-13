# Progression & Experience System

To ensure smooth power curves and prevent extreme snowballing, Cosmonauts employs a **global team leveling system**. 

## Experience (XP) Rules

- **Global Scaling:** When a team levels up, the base stats of all units belonging to that team are permanently increased:
  - **Heroes:** +3% Damage, +4% Health, +3% Health Regeneration.
  - **Droids:** +3.5% Damage, +3.5% Health.
  - **Healthpacks & Creeps:** +4% Healing power (global).
- **XP Bounties (Base Values):**
  - **Enemy 'Nauts:** Grants 40% of the *enemy team's* current level requirement.
  - **Turrets:** 25 XP.
  - **Droids:** Standard (Sawblade/Hummingbird) yield 5 XP. Super Droids yield 15 XP.
  - **Creeps:** Small creeps yield 5 XP. The Boss Creep yields 50 XP.
- **Acquisition Range:** XP is gathered locally (if any allied player is in proximity to the dying entity) or globally (if an allied player directly secures the kill via a DoT or projectile from afar). Proximity XP does not duplicate if multiple teammates are present.

## Level Math & Rubberbanding

- **XP Curve:** Level 1 starts at 0 XP. The requirement for each subsequent level increases by 18 XP using the formula: `135 + (Level - 1) * 18`. For instance, Level 2 requires 153 XP, Level 3 requires 171 XP, etc.
- **Rubberbanding:** To allow for comebacks, XP yields are dynamically modified based on the level disparity between the teams:
  - If your team is *higher* leveled than the victim, you gain **-4% XP** per level difference.
  - If your team is *lower* leveled than the victim, you gain **+4% XP** per level difference.
- **No First Blood:** There are strictly no XP bonuses for first blood or ending kill streaks.
