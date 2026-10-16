# SC5 — uma-racer on `@luismlorenzana/uma-work` and `uma-kit/work`

**uma-racer · Either · L · Needs: SC1 and SC2 released · Part of sibling Phase C.**

## Why

Phase C gives both games one work engine and one set of work screens. Both started from this repo's
`packages/domain/src/work/` and `apps/web/src/ui/work/`: SC1 generalized the engine, SC2 the screens. uma-racer swaps
its own copies for the packages. Its kinds (gather, craft, cook, session), Farm Level, check-ins and planner stay its
own.

## Context (read first)

- uma-platform: `docs/sibling/phases.md` § Phase C; `packages/work/README.md` (SC1's `WorkEnv` hooks and the per-game
  adapter sketch); `packages/kit/README.md` § `/work`.
- **This repo:**
  - **the engine:** `packages/domain/src/work/*` (types, kinds, timeline, state, settle, collect, activity,
    operations, refusals, and their tests);
  - **its callers:** `packages/domain/src/farm/` (`jobs.ts` with the gather, craft and cook kinds; `level.ts`;
    `buildings.ts`), `training/sessions` (the `session` kind), `check-in/*`, `planner/*`, `tiers/ledger`,
    `items/catalogue`;
  - **the screens:** `apps/web/src/ui/work/*`; the job sheet `places/farm/job-sheet/*`; the building page
    `places/farm/building/*`;
  - **the manual:** `docs/game/07-farm.md` (§2 the rules, §10 the screens), `05-training-hub.md` §2 and §9, and
    `02-check-ins-and-notifications.md`.

## Decisions made

- **The engine comes from the package.**
  - `packages/domain/src/work/` keeps only uma-racer's adapter: its `WorkEnv` (`buildings` from its tables, `tickets`
    as the Speed Ticket item, `exp` as Farm Level, `ledger` writing its ledger) and `collectBeforeRace`.
  - The kinds move to `packages/domain/src/work/kinds/` (`gather.ts`, `craft.ts`, `cook.ts`, `session.ts`), the
    layout both games share.
- **The state shape is unchanged:** SC1 kept uma-racer's `{ items, buildings, work }`, so there is no save migration.
  If SC1 renamed a field (`farmExp` → `exp` in entries), migrate on read and note it under Decisions.
- **The screens come from the kit:** `SlotRow`, `QueueChips`, `SpeedUpControls`, `RecallSheet`, `SizeChips` (by
  duration), `StoppedQueueCard`, `FacilityHeader`, `TargetsStrip` and `JobSheet`. The Pantry's and Kitchen's pickers
  go in the job sheet's "what" step. Delete `apps/web/src/ui/work/*` except words or helpers that are uma-racer's only.
- **Stays here:** check-ins, suggestions, Speed Up All, the planner and Needs.

## Do

1. Pin `@luismlorenzana/uma-work` and the kit version with `/work`.
2. Swap the engine:
   - delete the moved files;
   - write the adapter and the kind files;
   - fix the imports across `farm/`, `training/`, `check-in/` and `planner/`.
   Every existing domain test must still pass. Move the engine's own tests out only if SC1 ported them.
3. Swap the screens on the Farm's buildings, the job sheet, the side panel's rows and Training's rows.
4. **Docs:** `docs/game/architecture.md` (the packages), `07-farm.md` and `05-training-hub.md` where code paths are
   named; run `pnpm docs:update`; log a D-decision.
5. **Check it** in the iOS Simulator's Home Screen app:
   - every Farm building and Training: start, queue 3, collect, repeat, speed up, finish, recall, upgrade;
   - a stopped queue;
   - check-ins and Speed Up All, unchanged.

## Done when

- [ ] `pnpm lint && pnpm test && pnpm build` pass, including `sim:loop` if it's part of the checks; the startup budget
      holds.
- [ ] `packages/domain/src/work/` holds only the adapter and kinds, and `apps/web/src/ui/work/` only uma-racer-only
      helpers.
- [ ] The Simulator check was done and described. The docs and D-decision are in. Deployed and green.

## Deliver

- Claude: commit to `main`, `refactor: work on @luismlorenzana/uma-work and uma-kit/work (SC5)`.
- ChatGPT: branch `sib/sc5-racer-work`, a pull request with the same title.
- **Flag it done:**
  - delete this file;
  - add a Done row to `docs/handoff/README.md`;
  - set SC5 to Done in uma-platform's queue.
