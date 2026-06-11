# Cosmonauts (Awesomenauts) Knowledge Base

This document serves as the central game design and mechanics knowledge base for **Cosmonauts**, our open-source 2D MOBA based on the hit game *Awesomenauts*. 

---

## 1. Gameplay & Mechanics

### Map Elements
- **Droids:** Team-based minions that march down lanes. (See detailed section below)
- **Creeps:** Neutral entities found in the jungle areas. (See detailed section below)
- **Structures (Turrets & Solar Drill):** The core static targets. They have **no health regeneration or healing**—all damage dealt to them is permanent. Their current health is constantly visible on the minimap.
  - *Damage Mitigation:* Structures take reduced damage (usually 50% or 75%) from the vast majority of Awesomenaut abilities and attacks.
  - *Turrets:* Massive defensive structures that block lane progression and fire heavily on enemies. Maps have either 3 or 4 turrets total.
    - *Stats:* Front Turrets have 7650 HP; Back Turrets have 11900 HP. (Map specific exceptions: Sorona outer-bottom has 5300 HP. 404 front has 10200 HP, back has 7650 HP).
    - *Combat:* Damage per bullet: 40 (DPS: 267). Attack Speed: 400 (6.7 shots/sec).
    - *Invulnerability:* Turrets are **invulnerable** when not shooting (1-second delay after they stop shooting before shield returns). They also become invulnerable if they shoot for 3 seconds without hitting any targets.
    - *Targeting Priority:* 1. Summons (Lonestar's Bull, Skree's Totem, etc). 2. Droids. 3. Enemy 'Nauts. (Exception: 'Nauts are prioritized if they are actively walking into the turret).
    - *Destruction:* Grants 20 XP. Grants 30 Solar to the team, plus 70 extra to the killer. If a Droid gets the last hit, the 70 bonus goes to the 'Naut who attacked it last. Destroying a Turret instantly spawns a Super Droid for the attacking team.
  - *Solar Drill (Base/Core):* The ultimate objective, guarded by inner turrets.
    - *Stats:* Exactly 12,000 HP. Like turrets, takes reduced damage from most abilities.
    - *Vulnerability:* Can only be attacked after one or more inner turrets (varies by map) is destroyed. Some large AoE skills (like Clunk's Explode) can hit it from above. Destroying it instantly wins the match.
    - *Announcer Hooks:* The Announcer triggers specifically when: 1. A base is entered by an enemy 'Naut or droid. 2. The drill is under attack. 3. The drill drops to 1/3 health (4000 HP) or lower.
- **Energy Walls (Team Barriers):** Transparent, team-colored barriers that block enemy units and neutral creeps but allow allied units to pass freely. 
  - *Base Walls:* Permanent walls that protect the spawn/shop area. These can never be destroyed.
  - *Map Walls:* Temporary walls placed around the map to give defenders safe flanking routes or access to jungle creeps. These are structurally linked to specific turrets; when a linked turret is destroyed, the energy wall drops, opening a new path for the attackers.
- **Hide Areas:** Foreground foliage or shadows present on most maps (except AI Station 404 & 205).
  - *Vision Mechanics:* Hides units completely from enemies outside. The only way to reveal the contents is if a friendly unit ('naut, minion, or droid) enters the area, or if a vision-granting ability/summon is deployed inside.
  - *Minimap / UI:* Hidden enemy units do not show up on the minimap, and their health bars and names are completely hidden from the HUD.
  - *Player Feedback:* Players inside their own hide area see a yellow/orange outline showing the exact bounds.
  - *Map-Specific Tells:* Entering a hide area on Ribbit IV causes leaves to fall. On Sorona, dust falls (very subtle).
  - *Traps:* Mines and snares can be hidden inside, but they still emit faint beeping sounds to warn attentive players.
- **Healthpacks:** Pickups scattered across maps that provide vital sustain.
  - *Map Healthpacks:* Placed statically in the map. Heal for 400 HP. Takes exactly 2 minutes (120 seconds) to respawn.
  - *Creep Healthpacks:* Dropped by slain creeps. Heal for 200 HP. The Solar Boss drops a 100% full-heal healthpack.
  - *Scaling:* Both map and creep healthpacks scale their healing by +4% per team level.
  - *UI Indicators:* Appear as green dots on the minimap. Vanish when collected, reappear when respawned. Allied units near creeps also reveal moving green dots.
  - *Hero-Generated:* Certain hero abilities (e.g. Genji's Cocoon, Lonestar's Bull) can spawn team-exclusive healthpacks.
- **Jump Pads & Platforms:** Essential 2D platforming elements for vertical mobility.
  - *Platforms (Glass Platforms):* Semi-solid terrain that players can jump onto.
    - *Drop Through:* Players can drop through a platform by pressing **Jump + Down** simultaneously.
    - *Flying Characters:* Characters like Yuri, or Ayla (in Rage mode), completely ignore platform collision when moving up or down—they don't need the drop-through command.
    - *Vinnie & Spike:* Unique interaction where simply holding the 'Down' key makes them completely ignore platform collision.
    - *Projectile Interactions:* Most projectiles pass through, but some specific abilities like Derpl's Cat Shot treat platforms as solid walls and bounce off. Gnaw's Aggressive Acid upgrade allows his Acid Spit to uniquely pierce and drip down through them.
  - *Jump Pads (Boosters):* Propel the player forward in the direction the pad is facing. Crucially, hitting a jump pad **resets the player's double-jump**, allowing them to jump mid-air to immediately arrest momentum or change direction.
  - *Base Jump Pads:* Every map has a jump pad at the top exit of the bases. These are team-colored and **only usable by the defending team**.
  - *Map Jump Pads:* Often used to instantly transition between lanes (e.g., Ribbit IV's bottom-to-top jungle pad, Sorona's creep-area boosters, or Aiguillon's vertical boosters).
- **Zork's Mega Shop:** The in-game store located safely behind each team's indestructible Base Energy Wall. 
  - *Healing:* Standing in the shop area rapidly refills a player's health.
  - *Accessibility:* Can be accessed while dead (before the respawn mini-game). Enemies are physically blocked from entering.
  - *UI & Upgrades:* Players spend Solar on character-specific upgrades and utilities. A yellow progress bar under each upgrade indicates its current tier.
  - *Undo Feature:* An upgrade purchased by accident can be immediately refunded via an "undo" button, provided the player hasn't closed the shop or bought another upgrade yet.
  - *Recommended Builds:* A yellow banner in the top-right corner of upgrades guides new players through preset build paths. Players can choose between "new" and "pro" preset builds.

### Solar (Economy) & Experience System
- **Solar:** The core currency and team experience metric.
  - *Coins:* Silver Solar = 1, Gold Solar = 5.
  - *Starting/Map Solar:* Players start with 270 Solar and can collect more during the initial drop pod sequence. Natural map Solar cubes respawn strictly every 6 seconds.
  - *Passive Generation:* Players gain exactly 1 Solar every 2 seconds (30/minute). This passive drip halts entirely while dead.
  - *Death Penalty:* Players lose 25 Solar upon death (Bots lose 15).
  - *Bounties & Drops:*
    - Normal Droids: 5 Solar
    - Super Droids: 10 Solar
    - Enemy Players: 30 Solar distributed to the entire team, plus a 40 Solar bonus strictly for the killer. (Bot bounty is 5 to team, 25 to killer).
    - Killing Spree Bonus: Extra 40 Solar for ending an enemy's streak.
    - Neutral Creeps: 3 Solar
    - Solar Boss: 20 Solar distributed to each team member.
    - Enemy Turrets: 30 Solar distributed to each team member, plus an extra 70 Solar for the killer.
  - *Solar Upgrades:* Includes the Piggy Bank (+100 instant Solar for a utility slot), Solar Krab Burgers (healing upon collecting coins), and specific hero mechanics like Vinnie & Spike dealing bonus damage if holding >150 unspent Solar.
- **Experience System:** A global team leveling mechanic to smooth out power curves and reduce snowballing.
  - *Scaling Buffs:* Every time the team levels up:
    - Awesomenauts gain +3% Damage, +4% Health, and +3% Regeneration.
    - Droids gain +3.5% Damage and +3.5% Health.
    - Healthpacks & Creeps gain +4% Healing power.
  - *XP Acquisition (Proximity vs Direct):* XP is gathered globally if a player directly secures a kill (e.g. from a DoT across the map), or locally if any player is in proximity to an enemy/neutral entity dying. The proximity reward does not duplicate if multiple teammates are nearby.
  - *Rubberbanding (Level Difference Math):* To prevent snowballing, XP yields are modified dynamically. You gain -4% XP for each level your team is *higher* than the victim, and +4% XP for each level your team is *lower* than the victim.
  - *XP Requirements:* Level 1 starts at 0 XP. Level 2 requires 153 XP. Level 3 requires 171 XP, climbing by +18 XP for each subsequent level. (Formula: `135 + (Level - 1) * 18`).
  - *XP Bounties (Base Values):*
    - Enemy 'Nauts: 40% of the *enemy team's* current level requirement (e.g., if enemy is Level 10, requirement is 297, payout is 118.8 XP).
    - Droids: Sawblade/Hummingbird = 5 XP. Superdroids = 15 XP.
    - Creeps: Small = 5 XP. Solar Boss = 50 XP.
    - Structures: Turrets = 25 XP.
    - *Note:* There are strictly NO XP bonuses for first blood or kill streaks.

### Creeps & Neutral Entities
Creeps are neutral units featured on every map. They wander a preset path back and forth. Players or their minions (Droids, Weedlings) can kill these creatures.
- **Stats:** Health: 120 | Speed: 2.2
- **Drops:** 3 Solar, 5 XP, and a small Healthpack (restores 200 Health).
- **Spawn Rules:** First spawn is at 0:20 (0:30 on AI Station 404). After being killed, they respawn in exactly 20 seconds.
- **Variations by Map:**
  - *Small Beasts:* Lush jungle areas of Ribbit IV.
  - *Small Worms:* Top of Sorona (accessed via Boosters).
  - *Service-bots:* Top of AI Station 404 and 205.
  - *Solar Krabs:* Multiple areas of Aiguillon.
  - *Starstorm Robot (Sscreep):* Patrol Starstorm Station.

### Solar Boss
The Solar Boss is a special high-value neutral creep featured on Ribbit IV (spawns on both sides).
- **Stats:** Health: 2500 | Speed: 0.8 | Health Regen: 1200 HP/Minute (if out of combat/no Nauts nearby).
- **Combat:** Attacks with 5 bullets per barrage. Each bullet deals 100 damage. Attack cooldown is 1.2 seconds.
- **Drops:** 60 Solar (20 to each team member), 50 XP to all team members, and restores 5000 Health to the player who dealt the killing blow.
- **Spawn Rules:** First spawn is at 2:00. Respawns 120 seconds after being killed.

### Droids
AI-controlled minions belonging to the RED or BLU teams. They march down lanes until they encounter an enemy, are CC'd, or destroyed. A global limit of 48 droids exists for performance; oldest are destroyed if exceeded. **Lane Droids level up** alongside the team, gaining 3.5% health and 2% damage per level.
- **Sawblade Droids:** The standard melee Droids. They take reduced damage from turrets (shielding) to protect players.
  - *Stats:* Health: 850 | Damage: 72 | Attack Speed: 54.54 | Range: 2.7 | Movement: 4.6
  - *Regen:* 1800 HP/Minute
  - *Drops:* 5 Solar, 5 XP (+4% per level)
  - *Spawn:* Spawn in packs of 2 (or 4). Initial spawn at 30s. Respawns every 20s.
- **Hummingbird Droids:** Flying/ranged Droids. Only naturally generated on AI Station 404/205 by pressing a button, or summoned by specific heroes (Raelynn, Genji).
  - *Stats:* Health: 400 | Damage: 60 (homing energy bursts) | Range: 12.6 | Movement: 7.2
  - *Drops:* 5 Solar, 5 XP (Hero-summoned versions drop no Solar).
- **Super Droids:** Heavy siege units that spawn instantly when a team destroys an enemy Turret. They carry a ranged rocket launcher with AoE. They do not level up.
  - *Stats:* Health: 1500 | Damage: 400 (AoE) | Range: 11 | Explosion Size: 3 | Movement: 3
  - *Regen:* 300 HP/Minute
  - *Drops:* 10 Solar, 15 XP

---

## 2. Combat & Status Effects

### Attack Mechanics
- **Abilities vs Auto-Attacks:** Each character has a basic attack (auto-attack) and usually two unique active abilities. 
- **Attack Speed & Cooldown:** The rate of auto-attacks is dictated by attack speed. Abilities are governed by Cooldowns (measured in ticks/seconds).
- **Charges:** Some abilities can store multiple charges, allowing back-to-back usage before going on full cooldown.
- **Range & Area of Effect (AoE):** Projectiles have a set lifetime/range. Melee and explosive attacks use AoE (usually Axis-Aligned Bounding Box or circle overlaps) to hit multiple targets.

### Effects Mechanics
- **Buffs:** Positive status effects (e.g., *Haste* for movement speed, *Shield* for damage reduction, *Heal-over-time*).
- **Debuffs:** Negative status effects applied to enemies.
  - *Snare / Root:* Prevents movement.
  - *Slow:* Reduces movement speed.
  - *Stun:* Prevents movement and attacking.
  - *Blind:* Obscures the player's screen or hides the UI.
  - *Silence:* Prevents the use of abilities.
- **Lifesteal:** Returns a percentage of damage dealt as health to the attacker.
- **Time Modifier:** Abilities that alter the flow of time locally (e.g., slowing down projectiles and enemies in a specific bubble).

---

## 3. Movement & Physics Mechanics

- **Collision & Mass:** The game uses velocity-based movement with capsule/AABB collision. Characters with higher mass are less affected by knockback and crowd-control physics.
- **Movement Speed:** Base horizontal speed. Can be modified by upgrades (Boots) or buffs/debuffs.
- **Flight & Mobility:** Most characters have a double jump or a hover mechanic. Some characters (like Yuri) have free flight (jetpack), ignoring standard gravity.

---

## 4. Heroes (Cosmonauts) & Roles

Characters are generally divided into roles: **Tank**, **Fighter**, **Support**, **Assassin**, **Harasser**, and **Pusher**.

### Notable Characters (To be implemented)
*Note: This is a representative list mapped from the Awesomenauts roster.*
- **Sheriff Lonestar (Pusher/Fighter):** Blaster auto-attack, throws dynamite (AoE damage), summons a mechanical Bull to push enemies and tank turrets.
- **Froggy G (Assassin):** High mobility. Splash Dash (passes through enemies and stuns), Tornado (AoE damage around him).
- **Clunk (Tank):** High health, slow. Rocket launcher, Bite (Lifesteal), Explode (massive AoE damage around himself at the cost of his own health).
- **Coco Nebulon (Harasser):** Shoots a ball of lightning that can be detonated remotely through walls. Leaves a trail of slowing plasma.
- **Voltar the Omniscient (Support):** Heals allies with a wave. Summons combat drones that shoot enemies and can be commanded to explode.
- **Leon Chameleon (Assassin):** Melee slash. Can cloak (turn invisible). Uses a tongue pull to drag enemies to him.
- **Derpl Zork (Defender):** Can deploy into a stationary siege mode with a high-damage gatling gun and nuke. Places snare traps.
- **Yuri (Support/Area Control):** Flies with a jetpack. Drops high-damage space mines. Can create a time-warp bubble that heals allies and speeds them up.
- **Raelynn (Sniper):** Deploys a laser sniper rifle for massive long-range damage. Throws a time-rift device that drastically slows enemies.
- **Ayla (Brawler):** Enters a rage state, dealing continuous AoE damage around her while draining her own health. Throws an Evil Eye that deals more damage the lower her health is.
- **Gnaw (Area Control):** Spits acid (Damage over Time). Cultivates weedlings (mini-turrets) that control the map.

*(All other Awesomenauts like Swiggins, Skølldir, Penny Fox, Nibbs, Ksenia, etc., will follow their standard kit designs).*

---

## 5. Maps & Game Modes

### Standard Maps
There are 6 official maps. 5 are in the ranked matchmaking rotation, while 1 (AI Station 404) is relegated to Custom/Practice.
- **Ribbit IV:** A classic 2-lane swamp map. The top lane is distinctly shorter than the bottom lane. Features a central jungle containing 4 Small Beast Creeps. Contains two Solar Bosses (one on each side) that spit acid. The middle features a massive bottom-to-top jump pad, and exactly 3 Hide Areas (two interconnected at the bottom, one at the top). Aerial space is relatively limited.
- **Starstorm Station:** A sprawling derelict battle station heavily favoring fliers. Features 6 teleporters (3 entry, 3 exit) that conserve player momentum upon exiting. The bottom lane features a massive waste disposal shaft with a bottomless pit (instakill), 1 Hide Area above it, and a unique golden Solar cube (5 Solar). Uniquely, the inner top turrets are exposed from the start, and destroying just one completely disables the Drill's protective energy wall, bypassing the normal lane pushing requirements. Contains 4 Creeps.
- **AI Station 205:** A 2-lane map uniquely separated by an "Inferno Device" making lane transitions difficult. The Inferno Device activates with a 2s warning, firing for 8s (dealing 400 DPS) before resting for 21s. A healthpack resides inside the flames. The top lane contests the jungle which contains 3 "Service-Bot" creeps. Each team has a Droid Releaser button placed right next to their top turret (spawns up to 3 Hummingbird Droids, restocks every 15s). **Zero hide areas.**
- **Sorona:** A large 2-lane wasteland map with a massive central open area favoring fliers (with bumpers and platforms). The middle of the bottom lane has a button that opens a shaft to a Giant Sandworm. The worm stays exposed as long as the button is held, and instantly kills any Awesomenaut or Droid that touches it (forcing them to drop their Solar). A large central Hide Area sits above the button, granting strategic access to both lanes and a healthpack. Contains 4 worm creeps (two on the left, two on the right above the turrets). Contains a central jump pad (boosters).
- **Aiguillon:** A stealth-focused map containing a unique Stealth Orb. The orb grants 20s of invisibility and respawns every 60s. Features many Hide Areas (one large one on top with a healthpack, one on bottom with a healthpack, one in front of each outer bottom turret, and one behind each team wall). Cramped lanes, glass platforms, moving platforms, and jump pads make navigation tricky. Contains 6 "Solar Crab" Creeps (one behind each team wall, two in front of each team wall).
- **AI Station 404:** (Custom/Practice Only) A very short 1-lane map. Features a massive central Anti-Gravity field that affects both player jump height and projectile physics. The upper jungle area contains 4 Neutral Creeps. Each team has a Droid Releaser button next to their top turret that spawns Hummingbird Droids (up to 3 max, restocks every 10s). These Hummingbirds uniquely attack the inner bottom turret. **Zero hide areas.**
### Game Modes
- **Battle (Ranked with Party):** Ranked mode allowing parties (LAN, Steam friends, or split-screen) before queuing. Matches are selected randomly and affect leaderboard rankings. Bots fill empty slots but can be replaced mid-match by players queuing via Quick Match.
- **Quick Match (Solo Queue Ranked):** The standard matchmaking mode for solo players. Puts players into active lobbies or creates a new one as host. Maps are random. Affects leaderboards.
- **Bot Match (Offline/Practice):** Completely offline mode (though local split-screen is allowed). Hitting the menu pauses the entire simulation. Has 6 difficulty levels (0-6 bars) set at the start. Players can manually select the map. Does not affect leaderboards.
- **Custom Match:** Unranked matches with four sub-types (Traditional, Team Deathmatch, Randomnauts, Instagib). The host has extreme granular control over the simulation rules, including:
  - Disabling turrets or base mechanics.
  - Modifying physics (friction/slipperiness, damage-to-knockback).
  - Modifying economy (starting Solar, XP multipliers, custom respawn curves).
  - Match rules (frag limits, super droids instead of normal bots, exploding on death, etc.).
- **Tutorial:** A heavily scripted mode using Sheriff Lonestar on a simplified Ribbit IV map, with instructor prompts from Blabl Zork to teach core mechanics.
- **Split Screen:** Allows up to 3 players locally on the same machine. Can be played in Battle or Bot Matches. Alters the UI/camera rendering slightly to accommodate multiple views.

---

## 6. Character Archetypes & Roles

While roles are not absolute and characters can perform well in multiple functions, Awesomenauts are generally categorized into five primary classes:

- **Assassin:**
  - *Traits:* Lower than average health. Adept at chasing, escaping, and killing isolated or vulnerable targets.
  - *Examples:* Froggy G, Leon Chameleon, Penny Fox, Vinnie & Spike.
- **Fighter:**
  - *Traits:* Average health pool. Excels at dueling. More effective at melee or short-range engagements.
  - *Examples:* Admiral Swiggins, Ayla, Chucho Krokk, Dizzy, Jimmy & the LUX5000, Rocco, Sheriff Lonestar, Skølldir, Smiles, Ted McPain.
- **Harasser:**
  - *Traits:* Long range, relatively short cooldown abilities. Wears down enemy health from a safe distance to force retreats or set up kills. Kits usually include tools designed to keep enemies away.
  - *Examples:* Coco Nebulon, Nibbs, Gnaw, Max Focus, Raelynn, Skree, Sentry X-58.
- **Support:**
  - *Traits:* Better at indirect combat. Requires teammate protection. Brings teamfight-changing abilities and helpful utility tools. Typically scales very well into the late game.
  - *Examples:* Deadlift, Genji, Ix the Interloper, Professor Yoolip, Voltar the Omniscient, Yuri.
- **Tank:**
  - *Traits:* Very large health pool. Kits designed to mitigate or nullify incoming damage. Dangerous to engage directly, and excels at protecting vulnerable teammates.
  - *Examples:* Clunk, Derpl Zork, Scoop of Justice, Sentry X-58.

---

## 7. Editor & AI Architecture

### Coordinate Limits
Because of multiplayer rollback logic, coordinates in the game have strict absolute boundaries. The center of the map **must** be `(x:0, y:0)`. A map cannot be larger than `60x60` simulation units total (bounds of `x: -30 to 30` and `y: -30 to 30`). If a player exceeds these coordinates, their position stops being transmitted over the network and they will appear stuck to other players.

### AI Pathing Graph
Bots and Droids rely on an invisible node-based pathing graph overlaid on the map.
- **AI Nodes:** Placed at points of interest. Must be named specifically so the state machine knows their purpose. Examples: `REGENHOME_0` (Shop), `UPPERLANE`, `BOTTOMLANE`, `FINALSTAND_0` (In front of Base), `solarboss_0`, `upperFirstTower_0`.
- **Path Edges:** Connect AI Nodes to tell bots that a path exists. Edges can be filtered by `direction`, `allowed Teams`, or `classes` (e.g. creating flight-only paths).
- **Named Areas:** Rectangular volumes that trigger bot state changes when entered. Examples: `STARTAREA` (Droppod), `HEALAREA`, `NOFLYZONE` (Forces flyers down), `GOUPJUMP` (Forces droids to jump onto a platform).

### AI Behavior Trees
All bot logic runs as a Behavior Tree evaluating Conditions (IF/ELSE) and Actions.
- **Tick Rate:** The AI Engine ticks precisely **10 times per second** (10 Hz). This is to save performance while maintaining adequate reflexes.
- **Inputs:** AI scripts control their characters by emitting standard player inputs (e.g., `PressButton` for skills, `PressStick` for movement). Because the AI only updates every 0.1s, continuous movement requires holding the stick input for slightly longer than the tick duration (e.g., `0.14` seconds) to avoid stuttering.
- **Structure:**
  - **GeneralAI:** The root shared logic block that handles global pathfinding (chasing, pushing lanes). Traditionally referred to as `VeankoAI`.
  - **Class Behavior Trees:** Overrides loaded per-character (e.g. `Assassin` or `Dasher`) to add specific upgrade paths and skill usage.
  - **Movement Bools:** The AI engine dictates movement by setting internal flags (`MoveAwayFromTarget`, `MoveTowardsTarget`, `CantMove`, `DontMove`, `DownJump`) which the `Handle Movement` block then translates into raw stick inputs.
  - **Skill Usage:** Triggered by outputting `FACE_LEFT` (LMB), `FACE_RIGHT` (RMB), or `FACE_TOP` (MMB) for a specific duration (typically `0.1` seconds). Difficulty constraints are often checked here to prevent lower-difficulty bots from perfectly spamming skills.
  - **Ground Lock Fix:** A known quirk is bots getting stuck on the floor attempting to jump. The internal fix is sending a `FACE_DOWN` for `0` seconds to forcefully release the jump bind, coupled with a `0.59s` timeout before allowing another jump.
- **Standard API Blocks:** The engine exposes specific commands to the behavior trees:
  - *Operators:* `And`, `Or`, `Sequence`.
  - *Actions:* `adjustCharacterValue` (modify health/solar), `aimStickAtTarget`, `buyUpgrade`, `lockPlayerInput`, `pressButton`, `pressStick`, `selectTarget`, `spawnCharacter`, `triggerSkill`.
  - *Conditions:* `checkCharacterValue`, `checkCounter`, `directionToEnemyBase` (returns true if facing enemy base), `hasTarget`, `isCharacterInArea`, `isInNamedArea`, `isOnGround`, `isTargetInSkillRange`, `timer` (freezes if the sub-tree isn't ticked every frame).
- **Player Attachment:** Custom AI logic can be explicitly attached to human players using the `extraAIToAddToPlayerCharacters` setting. This allows map creators to script dynamic behavior for players (like taking damage in specific zones or automatically dropping buttons).
### Internal Naming Conventions
When referencing entity types in the code, use the internal class names:
- **Awesomenauts:** `Cowboy` (Lonestar), `Dasher` (Froggy G), `Tank` (Clunk), `Chameleon` (Leon), `Summoner` (Voltar), `Heavy` (Derpl), `Jetter` (Yuri), `Blazer` (Coco), `Brute` (Skølldir), `Maw` (Gnaw), `Vampire` (Ayla), `Hunter` (Raelynn), `Captain` (Swiggins), `Shaman` (Skree), `Bird` (Vinnie & Spike), `Commando` (Ted McPain), `Assassin` (Penny), `Spy` (Sentry), `Paladin` (Scoop).
- **Droids:** `CreepDroidMelee` (Sawblade), `CreepDroidFlying` (Hummingbird), `CreepDroidSuper` (Super Droid).
- **Creeps:** `CreepCritterRibbit4` (Small Beast), `CreepCritterSorona` (Worm), `CreepCritterAIStation404` (Service-bot), `CreepSolarboss` (Solar Boss).
