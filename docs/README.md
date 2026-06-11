# Cosmonauts — Documentation

Welcome to the documentation folder for **Cosmonauts**. 

To streamline our architecture and project management, all technical design documents (formerly `01-09`) have been consolidated into a single, unified source of truth.

## The Core Documents

1. **[ROADMAP.md](./ROADMAP.md)**
   This is the central hub for the project. It outlines our overarching architecture, core design principles, and the active development milestones (M1 through M10).

2. **[Cosmonauts Knowledge Wiki](./wiki/index.md)**
   The Wiki contains the highly specific, detailed mechanics. While the Roadmap dictates *what* we are building and *when*, the Wiki dictates *how* it works (e.g., exact damage numbers, tick rates, collision mechanics, hero abilities).

3. **[KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md)**
   The raw initial brain-dump of the Awesomenauts cloned mechanics. (Its contents have been actively migrated to the structured Wiki, but it serves as a historical reference).

---

## Current Status (2026-06-10)

**Done:** The foundation (M1-M5) is complete. We have a deterministic simulation core, a Pixi.js renderer, segment-based collision, an in-game map editor, and all core map entities (Jumpers, Base Cores, Turrets, Creeps). 

**Current Focus:** We are currently in **Milestone 6: Abilities & Hero Framework**. The goal is to transition from generic capsules into specific, unique Cosmonauts with customized abilities and roles (starting with the Sheriff Lonestar and Froggy G archetypes).
