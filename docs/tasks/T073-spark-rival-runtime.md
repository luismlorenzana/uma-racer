# T073 — Spark Rival production runtime and cutover

**Goal:** replace the production adjacent-swap Spark Match with Rival Circuit, persist every accepted action locally, and
make the save host replay the journal before it applies real Training EXP. A refresh must resume the exact battle.

Depends on merged T071 and T072. Read [M022](M022-spark-rival-circuit.md),
[Minigames](../design/minigames.md#spark-match--rival-circuit), [Architecture](../technical/architecture.md) and D171.
Branch from current `main`; open a PR; never push to `main`.

## Scope

- Evolve the device-local Dexie minigame row into a generic versioned action journal.
- Snapshot the selected Spark encounter when a run is reserved.
- Add an atomic load/append port used by the screen and later reusable by M020.
- Change Spark's `RunOutcome` from trusted score/move totals to a replay claim and make `commitRun` authoritative.
- Replace `/minigames/spark-match/:umaId` with the lazy PixiJS/React scene, tutorial and progression result.
- Adopt open legacy Spark reservations without charging or rerolling; remove the old engine/screen after migration tests.

Do not change the synced save schema, domain constellation engine, Training EXP curve, card minigame behavior, infrastructure
or private authored rows.

## Dexie journal

Use the next free Dexie version on the branch. `MinigameRunRow` remains device-local and adds a parsed replay payload and,
for Spark, a complete normalized encounter snapshot:

```ts
interface ReplayJournalV1 {
  format: 1
  engine: 'spark-rival-v1' | string
  actions: readonly unknown[]
}

interface SparkRunSnapshotV1 {
  version: 1
  contentVersion: string
  encounter: SparkRivalEncounterV1
  source: 'authored' | 'fallback'
}
```

The implementation should use discriminated typed rows rather than leaving `unknown` after parse. Bond Recall rows remain
valid with no journal. Limit Spark journals to **64 actions**, drag paths to the T071 maximum and all serialized text/arrays
to explicit bounds. A malformed row becomes a visible recoverable minigame error; never delete it or refund silently.

The migration preserves completed rows verbatim. An open adjacent-swap Spark row is marked for lazy adoption: on first
load, resolve a T072 encounter from its existing seed/tier/target, write `spark-rival-v1` with an empty action list and keep
id, attempt index, ticket ledger, created time and seed. It receives no new ticket charge. An open Bond row is untouched.

No journal or encounter snapshot enters Zustand game state, the outbox, `/api/sync`, Firestore or the cloud save parsers.

## Journal port

Add a small installed runtime port beside `MinigameHost`, with an unavailable default and a fake for screen tests:

```ts
interface MinigameJournal {
  loadSpark(runId: string): Promise<SparkRunView>
  appendSpark(runId: string, expectedActionCount: number, action: SparkRivalAction): Promise<SparkRunView>
}
```

`SparkRunView` exposes ticket identity, seed, immutable encounter, immutable actions, replayed state/outcome and source
diagnostic. Do not expose mutable Dexie rows.

`appendSpark` uses one read-write transaction. It validates row/open status/engine/count, replays existing actions, validates
the proposed action against that state, appends, writes and returns a newly replayed view. Two calls with the same expected
count cannot both win. It does not mutate the synced save or call the network. A rejected append leaves the row byte-for-
byte unchanged.

Install/uninstall the real port from `GameRuntime.start/stop` beside the persistent host. Runtime teardown cannot leave a
stale service installed for tests or sign-out.

## Reservation and encounter snapshot

Keep `MinigameHost`'s two-method shape and existing Spark target. During `beginRun('spark-match', target)`:

1. Re-parse profile, owned Uma and active scenario in the existing transaction shape.
2. Reject TL10, short tickets or invalid target before any write.
3. Return an existing open target run without another charge.
4. For a new run, derive the existing stable attempt seed, select the T072 encounter, snapshot it and create an empty v1
   journal in the same transaction that spends one ticket and appends the ledger row.

The trainee's strategy aptitudes in the encounter come from the active derived constellation at reservation time. Later
constellation edits do not change an open battle. Rival names/art remain presentation joins by snapshotted template id; the
fallback stores enough semantic identity to render even if a later pack disappears.

Starting or finishing Spark does not toggle scenario state or create a Journey/race fact. Scenario Start already makes the
active scenario available to train and race; Spark only changes Training EXP/TL.

## Authoritative commit

Replace Spark's old `{ score, moves }` outcome with a bounded claim:

```ts
{ kind: 'spark-match'; engine: 'spark-rival-v1'; actionCount: number; stateHash: string }
```

The hash is a stable, documented digest of canonical terminal replay state. It detects stale UI and aids diagnostics; it
is not trusted as proof. Inside the existing all-or-nothing host transaction, `commitRun`:

1. Returns the stored reward immediately for an already completed run.
2. Loads/parses the open row, snapshot and journal; checks the claim engine/count.
3. Replays from snapshot+seed+actions and requires a terminal clear/loss and matching state hash.
4. Uses the engine's integer Training EXP—never a UI score—with `addTrainingExp` on the still-active matching scenario.
5. Gets opened nodes from `nodesUnlockedBetween(constellationTemplate(tier), before, after)` and returns structured
   `{ id, label }` entries so the screen can link/focus them. Labels use the real template node/kind/position mapping, not
   an invented celebration list.
6. Writes the Uma/outbox plus completed row/outcome/reward atomically, then publishes Zustand after commit.

A save change that makes the reserved Uma/scenario invalid rejects visibly and keeps the journal for diagnosis. A retry of
the same completed `runId` returns the same reward without applying EXP or Trainer reconciliation twice. Bond Recall's
existing branch and outcome remain unchanged.

## Production screen

Replace the component behind the existing lazy route; no new main-nav entry or eager Pixi import.

### Start and resume

- Resolve Uma/scenario/TL and return path. Missing/not-owned/TL10 states have explicit CTAs back to Training.
- A first-use, replayable three-panel tutorial runs on synthetic state and never calls `beginRun`.
- Paid start names three waves, current TL/EXP, possible node progress and **Begin · 1 ticket**.
- If `beginRun` returns an open run, load it and resume immediately at its exact action boundary. Leaving the scene pauses;
  it does not discard, commit, refund or reroll. There is no manual forfeit in v1 because terminal runs are bounded.

### Battle

- Implement the four UX zones in `docs/design/ux.md`: React HUD, rival stage, 6 × 5 Pixi board, safe-area thumb zone.
- Canvas pointer handling uses the T071 controller. During a drag only Pixi presentation objects and the timer overlay
  update. On release/timeout, call `appendSpark` with the displayed action count, then animate returned resolution steps.
- Disable pointer/Shift during append and resolution. On append conflict/error, stop animation, reload the authoritative
  view and explain that the run was restored.
- Rival intent is visible before a touch and all status persists for its lifetime. Strategy colour always has glyph/text.
- Backgrounding during a live drag cancels it with no action; backgrounding at an action boundary is safe. Returning loads
  the row before enabling input.
- Spark Shift is a ≥44 pt DOM control in the thumb zone. Accessible non-board controls have names, focus state and status
  announcements; the spatial drag has a concise accessibility explanation rather than a fake unusable keyboard game.

### Terminal and result

At engine terminal, call `commitRun` with the replay claim. While the local transaction is pending, no onward action is
enabled. A failed save offers Retry; a reload retries idempotently.

Show clear/loss reason, EXP earned, before/after bar and TL, each crossed level, then every structured opened node. A node
CTA returns to `/constellation/:umaId?node=<encoded id>` and the Training scene opens/focuses that node. **Done** uses the
validated return path; **Run again · 1 ticket** begins a fresh attempt only after the first reward is committed and only
below TL10.

## Cutover and deletion

- Delete the adjacent-swap engine/tests and all 7 × 8, 25-move, scenario-icon-tile and trusted-score code.
- Update the `MinigameHostTestDouble` to create a synthetic journal/replay reward; synthetic names such as “First Light”
  disappear.
- Remove stale imports/comments/fixtures but preserve completed local rows and historical outcome parsing required by the
  Dexie migration. Historical rows never replay or pay again.
- Update direct-route/service-worker refresh tests and every entry point from Profile/Training. The visible CTA remains
  **Spark Match** and returns to its caller.

## Tests

- Dexie migration for completed Spark, open Spark and open Bond rows; open Spark adoption preserves identity/charge/seed.
- Reservation transaction: new run, existing run, short tickets, TL10, rollback, fallback snapshot and authored snapshot.
- Journal parser/bounds, load, append, stale count race, invalid action rollback, terminal rejection, reload equality and
  unavailable/runtime teardown behavior.
- Host commit: clear, both loss reasons, zero/partial EXP, multiple TLs, TL10 clamp, real node ids/labels, stale claim/hash,
  nonterminal claim, active-scenario change, retry/idempotence and transaction rollback.
- Screen: tutorial never charges; paid start once; resume skips start; pointer release/timeout/cancel; Shift; append conflict;
  background restore; terminal retry; node/return links; TL10; missing content fallback diagnostic; reduced motion.
- No `Math.random`; fixed seed/actions state matches T071 fixtures through DB JSON round-trip.
- Browser at 390 × 844 and 375 × 667: no page scroll, board not occluded, safe areas and 44 pt controls.

## Acceptance

- A real local save loses one ticket on reservation, resumes the same board after hard refresh, then gains engine-derived
  Training EXP exactly once on clear and on loss.
- Newly opened nodes are real for that tier, named and focusable from the result.
- An old open Spark run adopts Rival Circuit with the same run id/seed and no second ledger entry.
- Existing Bond Recall behavior/tests pass unchanged.
- `pnpm sim:spark`, `pnpm lint`, `pnpm test` and `pnpm build` pass; PR states startup gzip size (≤ 180 KB) and lazy Spark
  chunk size. Attach 390 × 844 screenshots of mid-drag, cascade/attack and result.

## Out of scope

Final numeric tuning/device sign-off (T074), Friendship Training, cross-device in-progress sync, audio asset production,
new dependencies, new rival intents, cloud save/API schema changes and production infrastructure.
