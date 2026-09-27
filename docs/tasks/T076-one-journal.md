# T076 — One journal for every minigame

**Goal:** every minigame saves its frozen inputs and actions the same way. Friendship Training moves onto the generic
replay journal Spark introduced (D171), and the journal port becomes engine-agnostic, so a new minigame plugs in an
engine instead of writing new storage.

Depends on merged T073. Read the [Minigame kit](../design/minigame-kit.md) (section 2), D168, D171, D177 and
`apps/web/src/game/{db.ts,minigame-host.ts,minigame-journal.ts,minigame-runs.ts}`. Branch from current `main`; open a PR;
never push to `main`.

## Today

- Friendship Training rows carry `setup?: FtSetup` and `actions?: FtAction[]`, written through `MinigameHost.loadRun` and
  `saveProgress` (D168). `saveProgress` replaces the whole action list.
- Spark rows carry `sparkSnapshot` and `journal: { format: 1, engine: 'spark-rival-v1', actions }`, written through
  `MinigameJournal.loadSpark`/`appendSpark`, which append one action under an expected count in one transaction.
- `ReplayJournalV1` already declares a `friendship-training-v1` variant that nothing writes.

## Scope

- A generic port: `load(runId)` and `append(runId, expectedActionCount, action)` returning a read-only view (ticket, frozen
  inputs, actions, replayed state), dispatched by the row's `journal.engine` to a registered engine adapter
  (`parse inputs`, `parse action`, `replay`, `isTerminal`, `stateHash`). Spark registers `spark-rival-v1`; Friendship
  Training registers `friendship-training-v1`.
- Friendship Training appends each choice through the port (one transaction, expected count), like Spark. Its frozen setup
  becomes the row's snapshot for that engine.
- A Dexie migration (next free version) moves open Friendship Training rows' `setup`/`actions` into the snapshot and
  journal, preserving id, ticket, seed and every action; completed rows stay verbatim. Old fields are read for migration
  only, then no longer written.
- `commitRun` for Friendship Training replays the journal like Spark does (claim: action count and state hash) instead of
  trusting a screen outcome. Keep the stored outcome/reward shapes readable for history.
- Remove `loadRun`/`saveProgress` from `MinigameHost` once nothing calls them; keep the test double in step.

## Tests

- Migration: an open run mid-week and mid-encounter resumes to an identical state (same hash) after upgrade; a completed
  row is byte-identical; a malformed row stays and shows the recoverable error.
- Port: stale expected count loses; an invalid action leaves the row unchanged; terminal runs refuse appends; unknown
  engines are a visible error.
- Commit: Friendship Training clear and loss replay to the stored reward exactly once; a stale claim is rejected.
- All existing Friendship Training and Spark tests pass.

## Acceptance

- One storage shape and one port for both games; `db.ts` has no game-specific journal fields beyond the snapshot union.
- A local save with an open Friendship Training run from before the change resumes exactly after update (verify in the
  preview with a run started on the old build).
- The Minigame kit's section 2 note about two storage shapes is replaced by the single contract.
- `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm sim:training`, `pnpm sim:spark` pass.

## Out of scope

Engine rules, balance, screens (T075), moving engines (T077), syncing runs across devices, the cloud save schema.
