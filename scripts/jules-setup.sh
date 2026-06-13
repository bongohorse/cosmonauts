#!/usr/bin/env bash
# Canonical environment setup + validation for Cosmonauts.
#
# Paste the commands below into Jules -> repository Configuration -> "Setup script"
# (or run this file locally / in any agent VM). The repo is cloned automatically,
# so no clone command is needed. These steps mirror CI (.github/workflows/ci.yml);
# if they pass, the branch is ready for a PR.
#
# This is a pnpm-only monorepo and pins its pnpm version via package.json
# "packageManager". Do not use npm/yarn/bun here.
set -euo pipefail

# Honor the pinned pnpm version. Required: agent images often ship an older pnpm
# (e.g. 10.x) while this repo pins 11.x; corepack fetches the pinned one.
corepack enable pnpm

pnpm install --frozen-lockfile

# Validation gate — every step also runs in CI; a PR that fails any will not merge.
pnpm run lint        # Biome: lint + formatting (run `pnpm lint:fix` to auto-fix)
pnpm run typecheck   # tsc --noEmit across all packages
pnpm run test        # Vitest
pnpm run build       # client production build
pnpm run sim:bench   # headless sim smoke-run / benchmark
