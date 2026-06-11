# AI & Bots

Bots are AI-controlled heroes that fill player slots to ensure matches are always 3v3. They rely on an invisible node-based pathing graph overlaid on the map and a highly optimized Behavior Tree system.

## AI Engine & Performance

- **Tick Rate:** To save simulation performance, the AI Engine ticks exactly **10 times per second (10 Hz)**, translating to every 6th simulation frame.
- **Inputs:** AI scripts control their characters by emitting standard player inputs (e.g., `FACE_LEFT`, `PressJump`). Because of the 10Hz tick rate, continuous movement requires holding stick inputs for slightly longer than 0.1s (e.g., 0.14s) to prevent stuttering.

## Pathing Graph

Bots and Droids navigate the map using an A* Pathing Graph:
- **AI Nodes:** Placed at points of interest and named specifically so the state machine understands their purpose (e.g., `REGENHOME_0` for the Shop, `UPPERLANE`, `solarboss_0`).
- **Path Edges:** Connect AI Nodes to dictate valid routes. Edges can filter by `direction`, `allowed Teams`, or even `classes` (e.g., creating flight-only paths).
- **Named Areas:** Rectangular volumes that trigger specific bot state changes when entered (e.g., `NOFLYZONE` forces flyers down, `GOUPJUMP` forces droids to jump).

## Behavior Trees

Bot logic runs as a Behavior Tree evaluating IF/ELSE conditions and executing Actions.
- **GeneralAI:** The root shared logic block handling global pathfinding, chasing, and pushing lanes (traditionally known as `VeankoAI`).
- **Class Trees:** Character-specific overrides are loaded per-class (e.g., `Assassin`, `Tank`) to add specific upgrade paths and skill usage rules.
- **Movement Flags:** The AI engine dictates movement via internal flags (`MoveAwayFromTarget`, `MoveTowardsTarget`, `DownJump`), which the Handle Movement block translates into raw stick inputs.
- **Skill Usage & Difficulty:** Skills are triggered by outputting face button commands. Difficulty constraints are checked here to prevent lower-difficulty bots from perfectly spamming skills on cooldown.
- **Ground Lock Fix:** A known engine quirk is bots getting stuck on the floor attempting to jump. This is mitigated by sending a `FACE_DOWN` for 0 seconds to forcefully release the jump bind, followed by a 0.59s timeout before allowing another jump.

## Player Attachment
Map creators can attach custom AI logic explicitly to human players via the `extraAIToAddToPlayerCharacters` parameter, allowing for dynamic scripted behaviors like taking damage in specific zones.
