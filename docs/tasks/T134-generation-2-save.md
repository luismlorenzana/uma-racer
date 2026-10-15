# T134 — The generation-2 save

**M034 · first, in parallel with T137 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md). Its fixed choices bind this task: build beside
  in `@racer/domain/save-g2`, server authority with local first, one lane.
- [rework/13](../rework/13-removals-and-plan-changes.md) §5–§6, [rearchitecture/01](../rearchitecture/01-target-architecture.md)
  §4.2–§4.3 and §5, [rearchitecture/07](../rearchitecture/07-data-reset.md) §4–§5,
  [rework/02](../rework/02-check-ins-and-notifications.md) §8–§11, [rework/09](../rework/09-racing-rewards-and-exchange.md)
  §8–§9, [rework/07](../rework/07-farm.md) §12 and [rework/05](../rework/05-training-hub.md) §9.
- [The rework modules](../game/architecture.md#the-rework-modules) and their code: `rework/types.ts`,
  `rework/work/types.ts`, `rework/check-in/once.ts` (`OPERATIONS`, `runOnce`, `recheck`), `rework/tiers/roster.ts`
  (`newAccount`), `rework/work/state.ts` (`newWorkState`), `rework/tiers/racing.ts` and `rework/exchange/race-prize.ts`.
- Today's `packages/domain/src/save.ts` for the parser style (exact keys, `T | null`, request parsers `T | string`), and
  the parsers reused here: `parseScenarioJourney`, `parseBadgeState`, `parseFlairEvent` and `parseRaceResultRecord`'s
  parts. uma-rpg's `packages/domain/src/save/save.ts` on `origin/main`, read only: one module owns the whole save.
- The T135 and T136 specs. Both build on this contract and restate none of it.

## Goal and fixed scope

One pure module owns generation 2: what is stored, how it is checked, how it maps onto the rework state, and what
crosses the wire. It has no migrations, no legacy constants and no cutover rows. Nothing in today's app imports it.

1. **Eleven kinds, and only these** (13 §6). Entities: `profile/main`, `umas/{outfitId}`, `buildings/{id}`,
   `work/{outfitId}`, `items/{itemId}`, `badges/uma:{outfitId}` and `badges/trainer`. Logs: `raceResults`, `ledger`,
   `itemLedger`, `flairEvents` and `operations`. `cards`, the `puzzle*` and `farm*` kinds and every RPG kind are refused.
2. **The new account** (13 §5, 07 §5): 20 Uma Tickets with the ledger row `initial-uma-tickets`, 0 Uma Shards, 0 Prize
   Money, no Umas, no work, an empty Warehouse (so 0 Speed Tickets) and all 14 buildings at Lv 1. The purse is empty on
   1970-01-01, the Exchange stocks grade 1, targets are automatic, check-ins are 08:00, 13:00 and 22:30, and Repeat
   keeps the size. These are `newWorkState(newAccount(now))`'s values. This task restates none of them.
3. **Every change to the account is an operation** (13 §6, 02 §9): an `OPERATIONS` entry run through `runOnce`, so a
   retried id returns its first receipt. Only badges and flair events are written as rows by the device, as today
   (M034: badges and flair records stay as they are).
4. **Sync v2** (rearchitecture/01 §4.3, 07 §4): `protocol: 2` and `generation: 2` on every request and response. One
   ordered lane of changes. Entities are versioned, logs are first write wins, operations are re-run, and a missing
   document accepts only a create.

## Implementation contract

**Files** live in `packages/domain/src/save-g2/`, re-exported by `index.ts`: `kinds.ts`, `rows.ts`, `parse.ts`,
`inputs.ts`, `initial.ts`, `state.ts`, `commit.ts`, `wire.ts` and `env.ts`. `package.json` gains `./save-g2`: `require`
→ `./dist/cjs/save-g2/index.{d.ts,js}` and `default` → `./src/save-g2/index.ts`, like `./farm`. The module is pure: no
I/O, `Date.now`, `Math.random` or browser globals.

**Constants.** `SAVE_GENERATION = 2` and `SAVE_PROTOCOL = 2`. `KIND_SCHEMA = 1`: one schema version per kind
(rearchitecture/01 §5). `ENTITY_KINDS` and `LOG_KINDS` list the eleven kinds. `KIND_ORDER` is profile, buildings, umas,
work, items, badges, ledger, operations, flairEvents, itemLedger, raceResults. `DEVICE_KINDS` is `badges` and
`flairEvents`; every other kind is written only by an operation or the create.

**Rows.** These are what the API stores and the wire carries:
- `EntityRow<K> { kind, id, generation: 2, schema: 1, version, savedAt, data }`. `version` starts at 1 and rises by one
  for each committed sync that changes the row. `savedAt` is the server's time of that commit.
- `LogRow<K> { kind, id, generation: 2, schema: 1, at, savedAt, data }`. `at` is when it happened, in the device's time.
  A log row never changes once written.
- `EntityDraft` and `LogDraft` are the same without `version` and `savedAt`. Only the writer stamps those.

| Kind | Id | `data` |
|---|---|---|
| `profile` | `main` | `AccountProfile`: all eleven fields, `generation: 2` |
| `umas` | her outfit id, equal to `data.outfitId` | `UmaState` |
| `buildings` | a `BUILDING_IDS` id | `{ level }`, 1 to 3. Slots are read from the work rows (07 §12) |
| `work` | her outfit id, equal to `data.outfitId` | `WorkRow` |
| `items` | a catalogue item id, or `speed-ticket` | `{ count }`, a whole number from 0 |
| `badges` | `uma:{outfitId}` or `trainer` | `BadgeStateV1`, as today |
| `ledger` | `data.id` | `LedgerEntry` |
| `itemLedger` | `data.id` | `{ id, itemId, delta, reason, outfitId, opId, at }` |
| `raceResults` | the `finish-race` operation's id | `{ umaId, raceId, opId, at, tier, scenario, run, commit }` |
| `flairEvents` | as today | `FlairEventV1`, as today |
| `operations` | the operation's id | `OperationRecord { name, at, receipt }` |

**Parsers** follow today's style: exact keys, unknown keys refused, `T | null`.
- `parseEntityRow`, `parseLogRow`, and per kind `parseEntityData(kind, value)` and `parseLogData(kind, value)`. Each
  checks the id against the data as in the table, and whole numbers and ranges: tier 1–3, scenario 1–5, Racing and Farm
  Level 1–50, card nodes 0–28, Inspiration slots from `INSPIRATION_SLOTS`, 1–4 check-ins in ascending minutes 0–1,439,
  up to 5 unique targets, item grades 1–10, building levels 1–3, and a work entry's 1–10 items with matching array
  lengths, `collected` no more than its items and a queue of up to 3.
- Where a rework type holds today's shape, today's parser is reused: `parseScenarioJourney` for careers,
  `parseBadgeState` and `parseFlairEvent`.
- An `operations` row checks that `name` is an `OPERATIONS` key and that `receipt` is a JSON object within the row
  bound. Receipts are not re-checked field by field.

**Operation inputs.** `inputs.ts` holds `OPERATION_INPUTS`, one strict parser per operation:
`{ [N in OperationName]: (value: unknown) => OperationInput<N> | null }`. The mapped type makes a missing name fail
`tsc`. A malformed value is `null`. A rule (a busy Uma, short stock) stays the operation's refusal.

**The envelope and its commit.**
- `OperationEnvelope<N> { id, name, input, at }`. `id` matches `/^[A-Za-z0-9_-]{8,64}$/` and is chosen before the tap
  is written. `at` is the device's time and the operation's `now` (02 §8's trusted-device clock).
- `parseOperationEnvelope(value): OperationEnvelope | string` checks the shape and the name. `OPERATION_INPUTS` then
  checks the input.
- `commitOperation(state, envelope, env): Commit` runs `runOnce` and returns one of three results:
  - `{ status: 'applied', state, receipt, entities: EntityDraft[], logs: LogDraft[] }`;
  - `{ status: 'repeated', state, receipt, entities: [], logs: [] }`: the id had run, and nothing is written again;
  - `{ status: 'refused', refusal }`: nothing changes and nothing is stored (02 §11).

  It throws on a caller's bug: an id reused under another name, or an input a rule rejects as malformed. The caller
  answers that operation `invalid`.
- An applied commit's logs are the new `ledger` rows (by id, after against before), the receipt's `itemLedger` rows,
  the `raceResults` row for `finish-race`, and the `operations` row.
- `itemLedgerRows(opId, receipt, at)` keeps a receipt's `itemLedger` rows (buy, sell) as they are. Each of its
  `movements` becomes `{ id: '<opId>:m<n>', itemId, delta, reason, outfitId, opId, at }`, with *n* its index. `delta` is
  negative for `reserve`, `cost` and `ticket`, and positive for `return` and `output`. `ItemLedgerReason` widens to
  those five kinds (07 §12, 05 §9).

**`finish-race`** joins `OPERATIONS`, as 09 §9 allows ("it joins 13's list as `finish-race`"). T141 builds the race on
it. It lives in `rework/check-in/finish-race.ts` as `finishRace(state, input, now, env, id)`, with the input
`{ umaId, raceId, placement, localDay, board, run }`:
1. `collectBeforeRace` pays her finished unlocks first (01 §2: in the same tap);
2. the race's grade and distance come from `env.content.races`, and a race that isn't there throws;
3. `raceBonus` comes from `deriveUmaPreset` on the preset of the race's distance (D254);
4. `applyRaceFinish` runs with `resultId = id`, then `settleRacePrize` on the profile, with its ledger rows appended;
5. the receipt is `{ collect, finish, prize, grade, raceBonus }`.

`placement` is the race engine's result and `board` the featured board the screen showed. The server trusts both, as
it trusts the phone's clock (02 §8, 09 §8). `run` is today's race record without its progression fields:
`Pick<RaceResultRecord, 'engineVersion' | 'course' | 'contentVersion' | 'seed' | 'strategy' | 'startStats' | 'field' |
'accomplishmentFacts'>`. It is checked by a `parseRaceRun` that `progression-race.ts` exports, built from the parts
`parseRaceResultRecord` already uses. The `raceResults` row is `{ umaId, raceId, opId, at, tier, scenario, run,
commit: receipt }`, with the tier and scenario she raced in (badges are scenario-linked, D122).

**The mapping** (`state.ts`, `initial.ts`, `env.ts`).
- `SaveState` is `WorkState` with the full `AccountProfile`.
- `toSaveState(entities, logs): SaveState` needs `profile/main` and throws without it. Absent buildings are Lv 1. Work
  rows equal to `emptyRow` and zero item counts are left out. `ledger` keeps only the **rule rows**, those whose reason
  is in `RULE_LEDGER_REASONS` (`initial-uma-tickets`, `unlock-uma`, `uma-gate-shard`, `uma-shard-exchange`,
  `promotion-uma-ticket`), sorted by `at`, then id. Those are the only rows a rule reads (`hasLedgerEntry`, `payOnce`
  and the shard exchange's sequence). `operations` holds the rows it is given.
- `entityChanges(before, after): EntityDraft[]` gives every entity whose data differs, by deep equality. A work row
  that left the state is written as `emptyRow`, and an item that left is written with count 0. Generation 2 never
  deletes a row.
- `initialSave(now): { state, entities, logs }` gives the rows of `newWorkState(newAccount(now))`: `profile/main`, 14
  `buildings` rows and the ledger row `initial-uma-tickets`.
- `buildOperationEnv({ umas, races, cards, skills }): OperationEnv` turns the content packs into the maps `OPERATIONS`
  reads, so the web and the API build the same env.

**Sync v2** (`wire.ts`). Each type has a parser that returns `T | string`.
- `SyncRequestV2 { protocol: 2, generation: 2, changes: SyncChange[] }` is the device's outbox in order (one lane):
  - `{ type: 'create', createdAt }`: the initial save. At most one, and only first;
  - `{ type: 'upsert', kind: 'badges', id, baseVersion, data }`: `baseVersion` 0 creates;
  - `{ type: 'append', kind: 'flairEvents', id, at, data }`: first write wins;
  - `{ type: 'operation', operation: OperationEnvelope }`.

  An upsert or append of any other kind is refused: those kinds change only by operation.
- `SyncResponseV2 { protocol: 2, generation: 2, serverTime, results, entities, logs }`. `results` has one entry per
  change, in order: a create is `created` or `exists`; an upsert `applied` (with its version) or `conflict`; an append
  `appended` or `exists`; an operation `applied` or `repeated` (with its receipt), `refused` (with its refusal) or
  `invalid`. `entities` and `logs` are every row the sync wrote, plus the server's copy of each conflicted row, plus
  every entity of the save after `exists`.
- `SaveSnapshotV2 { protocol: 2, generation: 2, serverTime, entities, logs, cursor }` answers `GET /api/save` with the
  rows saved after `since`. Rows come in `KIND_ORDER`, then by `savedAt`, then by id, one page at a time; `cursor` is
  null on the last page. A pull leaves out `operations` rows older than `OPERATIONS_WINDOW_MS` (7 days).
- `PurgeRequest { protocol: 2, generation: 2 }` and `PurgeResponse { protocol: 2, generation: 2, status, at, counts }`,
  where `status` is `purged` or `already` and `counts` is `{ collections, documents }`.
- `isCurrentStamp(value)` reads `protocol` and `generation` before anything else. Anything other than 2 and 2 is the
  caller's 426.

**Bounds** (`SAVE_LIMITS`): 100 changes a request; a request of up to 2 MiB of JSON; one row or input of up to 512 KiB
(Firestore's document limit is 1 MiB); a page of up to 1,000 rows and 4 MiB; and ids of up to 160 characters of
today's id alphabet.

## Tests

- **The new account.** `initialSave(now)` has 20 Uma Tickets, the one ledger row and 14 buildings at Lv 1, and nothing
  else. `toSaveState` of its stamped rows equals `newWorkState(newAccount(now))`.
- **Round trip.** Scripted synthetic accounts (unlock, start, queue, collect, upgrade, buy, sell, a race, advance,
  promote) go to rows and back to an equal state, and survive a JSON round trip.
- **The rule ledger is enough.** The same script runs once on the full ledger and once on `toSaveState`'s rule rows,
  re-read after every operation. The profile, Umas, work rows, Warehouse and every receipt are equal at every step.
- **Parsers.** Each kind takes its fixture and refuses an unknown key, a wrong id, an out-of-range number,
  `generation: 1`, `schema: 2`, and a `cards` or `farm` row. Every `OperationName` has an input parser, which refuses
  an unknown key.
- **Commit.** A refusal writes nothing. A repeated id returns the first receipt and no rows. An id reused under another
  name throws. `itemLedger` signs follow the movement kinds.
- **`finish-race`.** Finished unlocks are collected first. A gate's Shard is paid once. The prize and the featured
  bonus land under `race:<id>:prize` and `race:<id>:featured`. A Farm job keeps running.
- **Wire.** Wrong stamps, a create that isn't first, a non-device upsert or append, and each bound are refused.
- **Purity**, as the rework areas' purity tests do: no `Date.now`, `Math.random`, I/O or browser globals.

## Acceptance

- [ ] `@racer/domain/save-g2` exports this contract, and `pnpm --filter @racer/domain build` emits
      `dist/cjs/save-g2/`. `git grep save-g2 apps` finds only T135's and T136's folders.
- [ ] `finish-race` is in `OPERATIONS`. rework/13 §6's operation list becomes a live block rendered from `OPERATIONS`,
      and rework/09 §9 names `finish-race` as built.
- [ ] `docs/game/architecture.md`'s export table lists `@racer/domain/save-g2`, marked "not in play until T143".
- [ ] `pnpm lint && pnpm test && pnpm build` are green, and the sims are unchanged.
- [ ] The Decided here rows go into rework/13 §8 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

The API and Firestore (T135). Dexie, the store and sync (T136). Screens (T137–T142). Moving the rework modules and the
save to their final homes, and deleting today's `save.ts` (T143; `rework/types.ts` still imports its `ScenarioJourney`
and `RacePreferences`). Dev grants are T134's too: one `dev-grant` operation (items, Prize Money, Uma Tickets, finished unlocks, a jump to her gate) that `commitOperation` refuses unless the env says `dev: true`; the API sets it only when `DEV_OPERATIONS=true`, never in production (M034). Expedition pools (phase 9 adds optional
fields to the Uma row).

## Decided here

| Choice | Why |
|---|---|
| A race commits as the operation `finish-race` | 09 §9 allows it and requires one atomic commit of the result, the Uma, the purse and the ledger; server authority needs an operation for that |
| Only badges and flair events are device-written rows; every other kind changes by operation or the create | 13 §6: every change is an operation. Badges and flair stay as today (M034) |
| The create carries only `createdAt`; the server builds the rows itself | Server authority: the device never uploads a balance |
| Rows carry `generation: 2` and `schema: 1` | rearchitecture/01 §5's one schema version per kind, without today's sniffing |
| No row is ever deleted: an empty work row, a zero count | Versions never restart, and promotion's dropped work row still syncs |
| The state holds only the rule rows of the ledger | Rules read only those, and they grow with the roster, not with play time |
| `itemLedger` rows come from each receipt's movements, with ids `<opId>:m<n>`; there is no "consume" row | 07 §12 lists every movement. A reserved dish has already left the Warehouse, so collecting it moves nothing (05 §9's "consume" is that reserve) |
| Ledger rows keep the domain's `LedgerEntry`, not 09 §9's `{ currency, balanceAfter, ref }` | It is the built shape (T125, T130), and its id already names the cause |
| Operations carry no base version | 02 §9: the server re-checks a tap against the latest state |
| Bond picks are not saved | 13 §6 saves no picks, and 02 §11 left the choice to phase 3 |
| Operation ids have no colons and are at most 64 characters | Derived ids such as `race:<id>:featured` stay within 160 and parse cleanly |
| The server trusts the placement and the featured board, as it trusts the clock | 02 §8: there is no anti-cheat, and the purse and `featuredPaid` still bound the pay. The board's draw needs `@racer/race`'s seeded RNG, which the CommonJS API can't import |
| A race's id is its operation's id | One tap is one race, and `runOnce` already makes the id once-only, so the server needs no per-Uma race count |
| A pull carries a week of operation receipts | The summary needs only recent receipts (02 §10), and older ones stay on the server for retries |
| The bounds above | Under Firestore's 1 MiB document and Cloud Run's response limits, with room for a 25-Uma Collect all |
