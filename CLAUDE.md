# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cosmonauts is an open-source, browser-based 2D action-platformer MOBA whose gameplay feel
recreates Awesomenauts (Ronimo Games, 2012). All IP — characters, world, art, music, maps —
is original. Geometric placeholder art is used until gameplay is proven.

Design documents live in `docs/` (start with `docs/01-analysis.md`). No source code exists
yet; Milestone 1 is the documentation set, Milestone 2 is a local game-feel sandbox.

## Decisions (do not relitigate without the maintainer)

- **Stack:** TypeScript (strict) + Pixi.js, custom engine. No Phaser/Godot/etc.
- **Netcode target:** authoritative server + client-side prediction. The simulation is
  built transport-agnostic from day one.
- **Physics:** velocity-based AABB only, like the original. No rigid-body physics engine.
- **Planned layout:** pnpm monorepo — `packages/sim`, `content`, `protocol`, `client`,
  `server`. Hard rule: `sim` is pure TS and imports nothing from other packages, no DOM,
  no Pixi, no Node APIs (it runs identically in browser and server).

## Repository Status

When code is added to this repository, update this file with:
- Build, lint, and test commands (including how to run a single test)
- High-level architecture notes that aren't obvious from reading individual files
