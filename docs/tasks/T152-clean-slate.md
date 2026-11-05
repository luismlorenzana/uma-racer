# T152 — The clean slate: generation 3's foundation

> **M036, part 1 of 8.** Everything else builds on it. Domain, API, web and docs. Claude takes this one. Decision
> **D381**.

## Why

The restart rebuilds the game layer ("rebuilt, not trimmed", [v3 §5](../research/drawing-board/README.md#5-what-stays-and-what-goes)).
This part:
- deletes the retired game;
- cuts the kept modules loose from it;
- lays generation 3's save and operation registry with **every record shape and operation name the slice needs**,
  so the parallel parts T153–T156 only fill in rules, in files of their own;
- extends the master adapter to the real card effects;
- leaves a green build: sign in → a Hub with Town Hall → Account.

## Context

The seams, as mapped on `c592ccd`:
- **Operations live in a deleted area:** `check-in/once.ts` holds the `OPERATIONS` union (28 names), `OperationEnv`
  and `runOnce`. `save/commit.ts`'s `commitOperation` dispatches through `save/inputs.ts`'s `OPERATION_INPUTS`.
  `SaveState` is the work engine's `WorkState`.
- **The stamps:** `save/kinds.ts` has `SAVE_GENERATION = 2` and `SAVE_PROTOCOL = 2`, and `wire.ts` the `*V2` types.
- **The API:**
  - `apps/api/src/save/save.controller.ts` answers 426 on a stale stamp;
  - `firestore-save.repository.ts` uses `collection('saves')`;
  - `save.module.ts`'s `DEFAULT_LOCAL_SAVE_FILE` is `.data/save-g2.json`;
  - `resolve.ts` calls `initialSave` and `commitOperation`.
- **The web:**
  - `save/db.ts` has `SAVE_DB_NAME = 'uma-racer-g2'` and the outbox;
  - `sync.ts` has `PULL_KEY`;
  - `app/kit.ts` has `DEVICE_PREFIX = 'uma-racer:g2:'`;
  - `app/game.ts` has the `G2Game` port;
  - the router has `G2_ROUTES`;
  - about 50 files use `G2*` names, and 47 use `data-g2`.
- **Kept modules that import deleted ones,** and what to cut:

  | Kept file | Imports from deleted modules |
  |---|---|
  | `opponents.ts` | constellation's caps and node values |
  | `tiers/scaling.ts` | constellation's `CAP_PROFILES`, `TREE_BUDGET_SHARE` and `capProfile`; training's `treeCardNodesAt`; state's types |
  | `tiers/rivals.ts` | `starNodePct`, `fairShare` and `treeCardNodesAt` |
  | `tiers/map.ts` | state's types |
  | `scenario-goals.ts`, `career-shapes.ts`, `content.ts` | badges' flair series (`FlairSeriesTag`, legs) |
  | `master/flair.ts`, `master/card-focus.ts` | the root barrel |
  | `hub/view.ts`, `hub/words.ts`, `hub/places.ts` | farm, check-in, work and tiers advance |
- **Clean already:** `race-catalog`, `course-layout`, `race-skills`, `card-focus`, `cards`, `types`, `scenarios`,
  `scenario-buffs`, `race-pack`, `skill-tags`, `derived`, `career-stages`, `master/adapter`, `master/overlays`,
  `hub/docs`, `packages/race`, and `apps/web/src/scenes/race`, `places/racing/run/{RaceFeed,labels,art}`.
- **The live manual:** `packages/domain/src/docs/render.ts`'s `AREA_BLOCKS` and `docs/docs.test.ts` check
  `docs/game/*.md` and `docs/rework/*.md`.
- The size check is `scripts/check-size.mjs`.

## Do

1. **Delete, domain:**
   - `farm`, `items`, `work`, `check-in`, `planner`, `economy`, `training`;
   - `constellation*`, `lineage`, `inspiration`;
   - `progression.ts`, `badges`, `badge-preferences`, `trainer-achievements`, `flair*`;
   - `sim/` (all), `state/`, `builds/`;
   - `tiers/{advance,promotion,expedition,career,racing,roster,ledger,refusals}`;
   - the generation-2 `save/` (rewritten in step 4), `generation-2-flair.test.ts`, and the fixtures they used.
   
   **Move what is kept:**
   - flair's series tags and legs → `race-series.ts`;
   - `raceAttemptSeed`, `raceAttemptId`, `progressionFieldSize`, `bestStrategy` and the `RaceRun` shape →
     `race-attempt.ts`;
   - the cap profiles → `tiers/scaling.ts`;
   - the rival constants → `tiers/rivals.ts`, frozen with a note that T154 re-tunes them.
   
   **Trim:**
   - `scenario-goals.ts` to the generator (`careerProfile`, `planScenarioCareer`, its goal types);
   - `career-shapes.ts` to `SkillUnlock`, `RacePreferences` and `SAVE_ID_PATTERN`;
   - `scenarios.ts` to `SCENARIOS` and `eraOf`, with the 15th as **Goshiki Shuntaisai** (JP 2026-10-26).
   
   The package's exports become `.`, `./master`, `./save`, `./tiers` and `./hub`, plus **`./account`** (new).
   T153–T155 add `./build`, `./career` and `./stages`. Drop the `uma-work` dependency.
2. **Delete, web:**
   - every place except `account`, which step 7 rewrites;
   - `places/racing/*` except `run/{RaceFeed,labels,art}` → move these to `apps/web/src/race/`, for T158;
   - `ui/work`, `src/dev` (the seeds; the owner wants no dev-preview step), and the device prefs for retired systems.
   
   Rename the `G2*` identifiers to neutral names (`RacerGame`, `ROUTES`, `createRouter`, `ContentContext`) and
   `data-g2` to `data-racer`, so no later generation has to rename again. Drop the racer's `uma-kit/work` imports and
   `uma-work`.
3. **Delete, API:** the generation-2 save code that step 5 replaces. **Docs:** see step 9.
4. **The generation-3 save** (`packages/domain/src/save/`):
   - **`kinds.ts`:** `SAVE_GENERATION = 3`, `SAVE_PROTOCOL = 3`.
     - Entities: `account`, `umas`, `cards`, `careers`, `bonds`.
     - Logs: `raceResults`, `operations`.
     - No device-written kinds.
   - **`records.ts`:** every record shape and parser:
     - **account** `{ createdAt, umaTickets, cardTickets }`;
     - **uma** `{ unlockedAt }`;
     - **card** `{ unlockedAt }`;
     - **career:**
       - `{ umaId, T, startedAt, season }`;
       - `objectives[]` `{ raceId, stage, season, status, wonAt? }`;
       - `finale` `{ step, won }`;
       - `deck[]` (≤ 6) and `posts` (card → branch);
       - `pips` (per branch, 0–20) and `camps[2]`;
       - `skills[]` and `spSpent`;
       - `wallet` `{ drills: Stats5, bond, sp }`;
       - `completedAt?` and `racingBuild?`;
     - **bond** `{ umaId, tier, cardId, value, hints }`, with the id `uma:tier:card`;
     - **raceResult** (what a replay needs, per `race-attempt.ts`).
   - **`operations.ts`:** a registry, `defineOperation({ name, parse, apply })`.
     - `commitOperation(state, envelope, env)` dispatches through it with today's guarantees: the id is chosen before
       the tap, a retried id returns its first receipt, refusals are in plain words, and the operations log row is
       written.
     - **Implemented here:** `create` (20 Uma Tickets, 24 Card Tickets), `unlock-uma`, `unlock-card`, and `dev-grant`
       (tickets; only with `env.dev`).
     - **Declared for the later parts,** each with a parser stub and an `apply` that refuses "not built yet":
       - `start-career`, `run-race`, `next-season`, `run-finale` (T154);
       - `set-deck`, `post-card`, `buy-pips`, `pour-bond`, `buy-skill` (T153);
       - `settle-stage` (T155).
     - Each later part replaces its stubs in its own `*/ops.ts` and registers them with one import line.
   - **`wire.ts`, `rows.ts`, `parse.ts`:** today's format without the `V2` suffixes, stamped 3/3.
   - **`env.ts`:** `buildOperationEnv(packs)`, with the content maps the rules need (Umas, cards with effects, races,
     courses, skills) and `dev`.
   - Tests: round trip, purity (no clock reads, no I/O) and every implemented operation.
5. **The API:**
   - the stamp is 3/3, and anything else is 426;
   - Firestore's root collection is **`g3`** (`g3/{uid}/{kind}/{id}`);
   - the local file is `.data/save-g3.json` (and in `.env.example`);
   - `resolve.ts` runs the new `initialSave` and `commitOperation`;
   - `app.module.test.ts` keeps exactly the five routes.
6. **The web save:**
   - Dexie **`uma-racer-g3`**: one table per kind, the outbox, and a device-only **`stageJournal`** table for T155.
   - **On boot, the full wipe:** delete the `uma-racer-g2` database and every `uma-racer:g2:*` localStorage key, once,
     before opening g3.
   - `DEVICE_PREFIX` and every key become `uma-racer:g3:`. The content runtime's snapshot key moves too, but the
     content cache name stays.
   - Sync is today's lane on the new stamp.
7. **The minimal app:**
   - Sign-in, then the session boot on g3, then the kit's Hub with the **Town Hall** page and one place, **Account**.
     Account shows sync status, Appearance, App build and Content, sign-out, and its dev section (`dev-grant`).
   - The top bar shows Uma Tickets and Card Tickets.
   - `hub/*` (domain and web) is cut to that: two page ids reserved (`town` and `career`), place ids for what T157 will
     add, and no farm or work.
   - The router's routes go with the deleted places.
8. **The master adapter** (`master/adapter.ts`, `content.ts`):
   - `SupportCardTemplate.effects` becomes the card's **real level-50 value per effect id** (05 §1), replacing
     `effectProfile`;
   - it gains `uniqueEffect { level, effects: { type, value, params }[] }`, `hintOthers` and `eventSkillIds` (Global
     first, as today);
   - the values come only from the private pack at runtime;
   - tests use `syntheticMasterData()` and hand-made cards with invented numbers.
9. **The docs:**
   - **Delete** the manual pages of retired systems: `02-check-ins-and-notifications`, `03-uma-progression`,
     `05-training-hub`, `07-farm`, `08-item-catalogue-and-recipes`, `09-racing-rewards-and-exchange`,
     `12-economy-and-pacing`, and `docs/design/badges.md`.
   - **Keep, for their parts to rewrite:** `04` (T154), `06` (T153), `11` (T157 and T158), `racing.md`,
     `scenarios.md` and `architecture.md`. Rewrite now the architecture's save section and its domain-exports list.
   - **Rewrite `docs/game/README.md`** as the new manual's map: each page and the part that writes it.
   - Add an "archived by D380" banner to `docs/rework/*` and `docs/rearchitecture/*`, and take them out of
     `docs.test.ts`.
   - Trim `AREA_BLOCKS` to the areas that remain, and run `pnpm docs:update`.
   - **D381:** the slate, the generation-3 records and stamps, the registry, the neutral names, and the wipe-on-boot.

## Done when

- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass on `restart/g3`, within the 180 KB budget.
- [ ] Nothing imports a deleted area. `grep` for `check-in`, `constellation`, `uma-work`, `WorkState`, `G2` and `g2:`
      in `apps/` and `packages/` finds no live code. The race grade `'g2'` is fine.
- [ ] Tests:
  - [ ] the save round trip at 3/3;
  - [ ] `create`, `unlock-uma`, `unlock-card` and `dev-grant`;
  - [ ] the stubs refuse;
  - [ ] the API at 426 for 2/2, at `g3/` paths, and with `save-g3.json`;
  - [ ] Dexie g3 and the g2 wipe-on-boot;
  - [ ] the app boots to Town Hall → Account in a component test;
  - [ ] the adapter's real-effect shape on synthetic data.
- [ ] `pnpm docs:update` leaves no diff, and the docs link check passes. D381 is written.

## Deliver

Branch `feat/t152-clean-slate` from `restart/g3`, a PR into `restart/g3`, merged by Claude. Delete this file in it.
