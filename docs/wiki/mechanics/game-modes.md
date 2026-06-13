# Game Modes

Cosmonauts supports several game modes tailored for competitive, casual, and offline play.

## Standard Modes

- **Battle (Ranked with Party):** The standard ranked mode. Players can form parties (LAN, Steam friends, or split-screen) before queuing. Matches are randomly selected from the official pool and affect leaderboard rankings. Bots fill empty slots but will be hot-swapped mid-match if players queue via Quick Match.
- **Quick Match (Solo Queue Ranked):** The standard matchmaking mode for solo players. Puts players into active lobbies or creates a new one as host. Affects leaderboards.
- **Bot Match (Offline/Practice):** A fully offline mode (local split-screen allowed). Pressing the menu pauses the entire simulation. Players manually select the map and the AI difficulty (0-6 bars). Does not affect leaderboards.

## Custom & Sandbox Modes

- **Custom Match:** Unranked matches with extreme granular control over the simulation rules. The host can modify parameters via a global `MatchConfig` object. Options include:
  - Disabling turrets (`turretsEnabled: false`).
  - Modifying physics (`frictionMultiplier`, damage-to-knockback ratios).
  - Modifying the economy (`droidXpMultiplier`, custom respawn curves, starting Flux).
  - Specialized rule sets like Team Deathmatch, Randomnauts, Instagib, or enabling `explodeOnDeath`.
- **Tutorial:** A heavily scripted, simplified version of Ribbit IV designed to teach new players the core mechanics.

## Split Screen
Allows up to 3 players locally on the same machine. Can be utilized in Battle or Bot Matches. The rendering engine alters the UI and camera to accommodate multiple viewports on a single screen.
