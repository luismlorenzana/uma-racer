# T058 — The real minigame host

**Owner:** ChatGPT. This is also the standing reference for anything minigame-related.

Spark Match and Bond Recall are fully built and fully inert. They run against a test double, so a player
finishes a run, sees a convincing result screen, and gains nothing. This task makes them load-bearing.

## Read first

| Doc | What it settles |
|---|---|
| [Minigames](../design/minigames.md) | Both games' rules, scoring, board sizes, costs |
| [Constellations](../design/constellations.md) | What a Training Level unlocks, what a limit break is worth |
| [Training](../design/training.md) | Uma Level vs Training Level, ticket costs |
| [Support Cards](../design/support-cards.md) | Limit breaks per scenario, shared across Umas |
| [Economy](../design/economy.md) | Ticket sources and sinks |
| [decisions.md](../decisions.md) | **D120** minigames replace the turn loop · **D121** per-scenario state, derived stats · **D127** limit breaks belong to a scenario |

## The problem, precisely

`apps/web/src/game/minigame-host.ts` ends with:

```ts
const previewHost = new MinigameHostTestDouble()
let installedHost: MinigameHost = previewHost
```

Nothing calls `installMinigameHost`, so production runs the double. It does not fail loudly — it fails
convincingly:

| The result screen says | What happens |
|---|---|
| "5 tickets spent" | The balance does not move |
| "Now Training Level 4" | `trainingLevelBefore` is hardcoded to `1`; the save is untouched |
| "Unlocked: First Light, Rising Arc" | Invented names; no constellation has those nodes |
| Bond Recall "LB0 → LB1" | Hardcoded; no limit break is written |

Four gaps follow from that, and this task closes all four.

## 1. Implement the real host

Build `apps/web/src/game/minigame-runs.ts` exporting a `MinigameHost` backed by the save, and install it from
`GameRuntime.start` the way the other integrations are wired.

The interface is already defined and **must not change shape** — the screens are written against it:

```ts
beginRun(kind, target): Promise<RunTicket>     // { runId, seed, attemptIndex }
commitRun(runId, outcome): Promise<RunReward>
```

### `beginRun`

One atomic transaction:

1. Validate the target exists and is legal — the Uma is owned and her scenario is started; the card is owned,
   its era ≤ the tier, and it is not already LB4 **in that tier**.
2. Check and spend tickets: `SPARK_MATCH_TICKET_COST` (5) or `BOND_RECALL_TICKET_COST` (10). Too few tickets
   rejects before anything is written.
3. Append the spend to the ledger — reason `training` for Spark Match, `card-limit-break` for Bond Recall.
4. Return a deterministic seed and the attempt index.

**Reuse an open run.** If a run is already open for that target, return the same ticket rather than charging
again. A player who backs out mid-board and returns must land on the same board, not a fresh charge.

### `commitRun`

One atomic transaction, and **idempotent on `runId`** — a retry returns the first reward and grants nothing
twice:

- **Spark Match:** `addTrainingExp(run.trainingLevel, run.trainingExp, score)` on the Uma's *active*
  `ScenarioTraining`, writing back `trainingLevel` and `trainingExp`.
- **Bond Recall:** on `cleared`, `advanceCardLimitBreak(card, tier)`; append `+TICKETS_PER_CARD_LIMIT_BREAK`
  (5) with reason `card-level`, and on `couponGranted` a card coupon with reason `card-max`. On a loss, write
  nothing but close the run — the ticket was already spent at `beginRun`.
- Close the open run, queue outbox work for every entity touched, and return the populated `RunReward`.

## 2. Real node names

`nodesUnlocked` must come from the domain, not from a list of invented names:

```ts
nodesUnlockedBetween(constellationTemplate(tier), levelBefore, levelAfter)
```

It returns the actual `ConstellationNode`s that opened, so the summary can name what the player can now go and
fill. Node ids are not player-facing — render them as `Card node`, `Stat node`, `Parent node` with a position
hint, or link straight into the constellation.

## 3. Replay stability must survive a refresh

[Minigames](../design/minigames.md) promises a reload restores the same board and cannot reroll a friendlier
one. The double keeps attempt index and open runs in in-memory `Map`s, so today a refresh silently rerolls.

Persist them in a **device-local Dexie table**, following `albumPrefs` (D112): a new `minigameRuns` store, a
`db.version(8)` bump, never synced and never part of the save. It is device state, not save state — a run in
flight is not something the cloud needs.

The seed must be derived, not random. Mirror `raceAttemptSeed` in `apps/web/src/game/racing.ts`: hash
`profile.createdAt`, the content manifest version, the target (uma id, or card id + tier) and `attemptIndex`.
No `Math.random`, anywhere.

## 4. Spark Match has no entry point

The route `minigames/spark-match/:umaId` exists and **nothing links to it**. Bond Recall got its entry point
from the Cards album's *Bond by scenario* strip; Spark Match needs the equivalent:

- The **constellation screen** is the natural home — it already shows `TL n` and how many nodes are locked.
  A "Raise Training Level" action there, disabled at TL10 or with a short ticket balance.
- The **Uma profile** action bar is the second place a player will look.

Both should state the cost before committing.

## The transaction pattern to copy

`promotePersistentCard` in `apps/web/src/game/cards.ts` is the closest existing shape: read rows, validate,
check the ledger ids for idempotency, write profile + entity, append ledger rows, queue outbox, reconcile
badges and the Trainer, all inside one `db.transaction`. Follow it.

Ledger ids are the idempotency key. Use stable, collision-free ids, for example
`spark-match:<umaId>:<tier>:<attemptIndex>` and `bond-recall:<cardId>:<tier>:<attemptIndex>`.

## Domain APIs you need

All exported from `@racer/domain`:

| API | For |
|---|---|
| `activeScenario(uma)` | The run a Spark Match result applies to |
| `addTrainingExp(level, exp, gained)` | `{ trainingLevel, trainingExp, levelsGained }` |
| `trainingExpToNext(level)` | `1000 + 350 × (level − 1)`, for progress display |
| `MAX_TRAINING_LEVEL` | 10 |
| `constellationTemplate(tier)`, `nodesUnlockedBetween(t, from, to)` | Which nodes opened |
| `cardLimitBreak(card, tier)` | A card's break in one scenario; absent means 0 |
| `advanceCardLimitBreak(card, tier)` | Returns the new `CardSave` plus reward facts |
| `SPARK_MATCH_TICKET_COST`, `BOND_RECALL_TICKET_COST`, `TICKETS_PER_CARD_LIMIT_BREAK` | 5 · 10 · 5 |

Save shapes: `ScenarioTraining.trainingLevel` / `trainingExp` live on the Uma's active scenario;
`CardSave.limitBreaks` is `Record<tier, number>` where an absent tier means LB0.

## Tests

- `beginRun` rejects on too few tickets, an unowned target, a later-era card, or a card already LB4 in that
  tier — with **zero writes** in every case.
- `beginRun` twice for one target returns the same ticket and charges once.
- Seeds are deterministic: same inputs, same seed; a different attempt index gives a different seed.
- A persisted open run survives a simulated reload and returns the same board.
- `commitRun` twice with one `runId` grants exactly one reward and appends each ledger row once.
- Spark Match crossing two levels reports both, and `nodesUnlocked` matches `nodesUnlockedBetween`.
- Bond Recall: a clear advances only the named tier and leaves the others untouched; a loss advances nothing
  but still consumed its ticket; reaching LB4 grants the coupon exactly once across every scenario.
- `pnpm lint`, `pnpm test`, `pnpm build` pass, main bundle ≤ 180 KB gzip.

## Acceptance

- Playing a Spark Match run moves tickets and Training Level in the save, and the summary names real nodes.
- Clearing Bond Recall raises that card's limit break **in that scenario only**, and every Uma racing there
  sees it.
- Refreshing mid-run restores the same board; it cannot be rerolled.
- Nothing in the app still reaches `MinigameHostTestDouble` outside tests.
- Verified in the browser preview at 390×844, with the before/after ticket and level values stated in the PR.

## Out of scope

Board rules, scoring, and visuals — those are settled and shipped. Do not change `MinigameHost`'s shape, the
save schema, or the constellation engine. If something here cannot be built as written, say so in the PR
rather than adjusting the design to fit.
