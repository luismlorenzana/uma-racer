# T077 — Minigame engines live in the domain

**Goal:** pure minigame rules have one home, `packages/domain/src/minigames/<id>/` (D185), so every engine is tested,
simulated and imported the same way. A move, not a rewrite: replays and rewards stay byte-identical.

Depends on merged T073; coordinate with T076 (either order works, but not in parallel on the same files). Read the
[Minigame kit](../design/minigame-kit.md) (sections 3–4). Branch from current `main`; open a PR; never push to `main`.

## Scope

- Move `apps/web/src/game/minigames/spark-rival/` (types, board, combat, rng, recipes, content selection, engine, fixtures
  and their tests) to `packages/domain/src/minigames/spark-rival/`, beside the tuning constants in
  `packages/domain/src/spark-rival.ts` (fold those in or re-export them). Nothing in it may import web code.
- Move Friendship Training's `packages/domain/src/friendship-{rules,setup,engine,bot}.ts` and its tests to
  `packages/domain/src/minigames/friendship/`.
- Export both through `packages/domain/src/index.ts`; update the web app, `scripts/sim/spark-balance.ts` and
  `scripts/sim/training-balance.ts` to import from `@racer/domain` (the sims may keep the relative `packages/domain/src`
  import style they use today).
- Keep `apps/web` to presentation, the journal adapter and screens. Add a test (or lint rule) that fails if a file under
  `packages/domain/src/minigames/` imports React, PixiJS, Dexie or browser globals.

## Tests

- Every moved test passes where it lands. A fixed seed and action list replays to the same state hash before and after the
  move (record the hashes in the PR).
- `pnpm sim:spark` and `pnpm sim:training` print the same results as before the move.

## Acceptance

- No minigame rule module remains under `apps/web/src/game/minigames/`.
- The Minigame kit's table and section 4 name the new paths; the "moving, T077" notes are removed.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; the main bundle is unchanged within 1 KB.

## Out of scope

Any rule, number or behaviour change; the journal (T076); screens (T075).
