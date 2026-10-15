# T136 — The web save layer

**M034 · after T134, in parallel with T135 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md). Its fixed choices bind this task: new code
  goes in `apps/web/src/g2/save/`, and nothing in today's entry imports it; server authority, local first, one lane.
- T134's contract, built as `@racer/domain/save-g2` and written up in [rework/13](../rework/13-removals-and-plan-changes.md)
  §6 (D352: rows, wire, `commitOperation`, `initialSave`, `toSaveState`), and the
  [T135](T135-api-generation-2.md) spec (what each status means: 409, 426, 503, the purge).
- [rearchitecture/01](../rearchitecture/01-target-architecture.md) §4.2–§4.3, [rearchitecture/07](../rearchitecture/07-data-reset.md)
  §2–§4, [rework/02](../rework/02-check-ins-and-notifications.md) §8–§10 and [rework/09](../rework/09-racing-rewards-and-exchange.md) §8.
- Today's web save, to learn from: `game/db.ts` (Dexie, the outbox), `game/runtime.ts` (boot, `schedule`, the online
  and visibility handlers, sync state), `game/persistence.ts` (adopting a snapshot), `game/sync.ts` (every change
  accounted for) and `api/client.ts` (the token provider). Keep: the outbox is the truth, a mutation persists before
  the store publishes it, and one flush runs at a time. Drop: lanes, migrations, cutovers, grants and recoveries.
- uma-rpg's `apps/web/src/save/{db,game,reconcile}.ts` on `origin/main`, read only: the 1.5 s debounce, and syncing on
  visible and online.

## Goal and fixed scope

The device keeps generation 2 in its own database, plays on it at once, offline too, and agrees with the server.

1. **Dexie `uma-racer-g2`, schema version 1** (rearchitecture/01 §4.2): one table per kind and the outbox. There are no
   device-only tables: the minigame and Puzzle journals that §4.2 names are gone (rework/13 §1).
2. **One Zustand store over the rework state.** No other store holds game state (rearchitecture/01 §4.2).
3. **A tap is one operation.** It is applied at once with the domain's rule and queued, and the server's answer
   reconciles it (02 §8–§9).
4. **One sync lane:** a 1.5 s debounce, a flush when the app is hidden, and a flush and pull when it is visible or
   back online (02 §8: "flushes the outbox and pulls the other device's changes").
5. **Local-first boot** (rearchitecture/01 §4.3). A database with a save opens at once. An empty one pulls
   `GET /api/save`, and creates the initial save only if the server is empty too.
6. **The first-boot wipe, then the purge call** (07 §2–§3).
7. **Plain words** (02 §9). No code, number or protocol word reaches a screen.

## Implementation contract

**Files** in `apps/web/src/g2/save/`: `db.ts`, `api.ts`, `wipe.ts`, `boot.ts`, `fold.ts`, `store.ts`, `actions.ts`,
`sync.ts`, `words.ts`, `env.ts` and `index.ts`, with tests beside them. They import `@racer/domain/save-g2`,
`@racer/domain/rework/*`, today's `content/` runtime, Dexie and Zustand. They import nothing from `game/`.

**The database** (`db.ts`): `class SaveDb extends Dexie`, named `uma-racer-g2`, with a single `version(1).stores()`.

| Table | Key and indexes | Holds |
|---|---|---|
| `profile`, `umas`, `buildings`, `work`, `items`, `badges` | `id` | T134's `EntityRow`, as the server sent it |
| `ledger` | `id, at, data.reason` | T134's `LogRow` |
| `itemLedger`, `flairEvents`, `operations` | `id, at` | `LogRow` |
| `raceResults` | `id, at, data.umaId` | `LogRow` |
| `outbox` | `++seq, &key` | `{ seq, key, change, queuedAt }` |

- The kind tables hold what the server has confirmed. `badges` and `flairEvents` also hold the device's own writes.
- Rows are read back through T134's parsers. A row that fails to parse puts the store in `error`; nothing deletes it.
- A later schema change that must keep data adds a version (uma-rpg's rule). Until then there is one.

**The outbox.** Keys: `create`; `op:<id>` for an operation, with its envelope; `badges/<id>` for a badge, coalesced
(the data and `baseVersion` are read at flush); and `flairEvents/<id>`. A badge written while its row is in flight
bumps `queuedAt`. An answer removes a row only if `queuedAt` is unchanged, so the newer data goes in the next batch.
A batch is the first 100 rows by `seq`, so the create always leads. A row leaves the outbox only when its answer comes.

**The fold** (`fold.ts`): `fold(rows, outbox, env) → { state, receipts, pendingLogs }`.
1. It starts from `toSaveState` of the confirmed entities, the rule ledger rows (by `data.reason`), and the confirmed
   `operations` rows whose ids are in the outbox. So an operation the server already ran, whose answer was lost, folds
   as `repeated` and is never applied twice. With no profile row and a create first in the outbox, it starts from
   `initialSave(createdAt).state`.
2. It applies each queued operation with `commitOperation`, at the envelope's own `at`.
3. An operation that refuses or throws during a fold is skipped and stays queued: the server answers it.
4. `pendingLogs` are the log rows the queued operations made, such as an offline race's result.

The same rows, outbox and content give the same state after a reload.

**The store** (`store.ts`): `useSave`, read through selectors.
- `lifecycle` is `booting`, `ready` or `error`, with `words` for the error.
- `state` is the fold's `SaveState`; `badges` the badge rows' data.
- `receipts[opId]` is `{ local, server? }` for the latest 100 operations, so a summary can show the server's answer.
- `pendingLogs` come from the fold.
- `sync` is `{ status, pending, oldestQueuedAt, lastSuccessAt, words }`, where `status` is `idle`, `pending`,
  `syncing`, `offline` or `error`.

The store publishes only after Dexie commits (today's rule).

**Actions** (`actions.ts`):
- `run(name, input, busyKey?) → Promise<Answer>` builds `{ id: crypto.randomUUID(), name, input, at: Date.now() }` and
  calls the domain's `recheck` on the store's state, which is 02 §9's stale-screen rule:
  - `done`: one Dexie transaction adds `op:<id>` to the outbox; then the store publishes the state and the local
    receipt, and sync is scheduled;
  - `ask` or `say`: nothing is written, and the answer goes back to the screen.

  While a `busyKey` is being written, a second tap with that key is ignored: a double tap does nothing (02 §9).
- `writeBadge(id, data)` and `appendFlair(event)` write the row and its outbox key in one transaction, as today.
- Read helpers such as `raceResults(umaId)` and `ledgerRows()` merge Dexie rows with `pendingLogs`. Logs other than the
  rule ledger are never loaded into the store at boot.
- `env.ts` builds `operationEnv(content)` with T134's `buildOperationEnv` from today's content packs, cached per
  content version.

**The API client** (`api.ts`) is its own small fetch, following `api/client.ts`: `VITE_API_BASE_URL`, a
`setSaveTokenProvider`, the stamp on every call (query parameters for `GET`, the body for POSTs), and T134's
response parsers. It reports failures as `offline`, `auth`, `upgrade`, `no-save`, `unavailable`, `server` or
`invalid`.

**Sync** (`sync.ts`): one lane, one flush at a time. A trigger during a flush runs one more after it.
- **Triggers:** a write (1.5 s after the last one); the app hidden (flush now); visible or online (flush, then pull);
  after the save opens; and after a flush that wrote.
- **Flush:** one batch goes to `POST /api/sync`. Then one Dexie transaction:
  1. puts each returned entity row whose version is at least the local one, and each returned log row;
  2. takes a conflict's server copy for its badge;
  3. removes every answered outbox row.

  Then the store refolds and publishes. A `refused` operation becomes a notice in its refusal's words, and an
  `invalid` one says "That didn't work. Try again.". The server's receipt replaces the local one. A response that
  doesn't answer every change, in order, applies nothing, and the status is `error` (today's `acknowledgedSequences`).
- **Pull:** `GET /api/save` from `since` = the last pull's `serverTime` − 60 s, every page, adopted with the same rule.
  The time and the cursor are kept in `uma-racer:g2:pull`, and an empty database always pulls from 0.
- **Failures:**
  - offline → `offline`;
  - `auth`, `server`, `unavailable` and `invalid` → `error`, retried after 5 s, 30 s and 2 minutes, then every 5
    minutes while the app is visible and the outbox isn't empty;
  - `upgrade` (426) → `error`, with no retry until the app restarts;
  - `no-save` (409) → the device drops its save and outbox and boots as a new device.
- **The Sync chip** reads `sync`: amber when `oldestQueuedAt` is over a day old, red on `error` (02 §9).

**Boot** (`boot.ts`) runs in this order:
1. **The wipe** (`wipe.ts`), unless `uma-racer:g2:wiped` is set:
   - `Dexie.delete('uma-racer')`;
   - in dev builds, every database named `farm-kitchen-proof-*` or `puzzle-proof-*`;
   - every localStorage key that starts with `uma-racer:` and not `uma-racer:g2:`;
   - `caches.delete('racer-content')`.

   Then it sets the marker. Each step tolerates absence, so a repeat is harmless. It never reads old data (07 §4).
   Firebase's own databases and the Workbox precache stay (07 §2).
2. **The purge**, unless `uma-racer:g2:purged` is set: `POST /api/legacy/purge` in the background once signed in.
   `purged` or `already` sets the marker. A failure retries at the next boot or when back online. It never blocks play.
3. **Open.**
   - **A save on the device** (a profile row, or a create in the outbox): fold, `ready` at once, then flush and pull.
   - **Empty:** pull every page from 0. With rows, the store opens once the pages reach the kinds after `operations`;
     the rest of the history keeps loading in the background. With none, `initialSave(now)` is queued as the create,
     and the store opens.
   - **Empty and offline:** the device creates the save too. A later `exists` adopts the server's save and pulls from 0.

**Words** (`words.ts`) take every string from rework/02 §9 through `CHECK_IN_WORDS`, `say` and `fill`: `offline`,
`unexpected` and `already-collected`. A refusal says `fill(say(reason, data))`.

## Tests

`import 'fake-indexeddb/auto'`, a fake `fetch` and fake timers, as `game/persistence.test.ts` does. Synthetic content.
- **Schema.** `uma-racer-g2` opens at version 1 with the tables above and nothing else.
- **Boot.** A device with a save is `ready` before any network call. An empty device pulls and opens. An empty device on an
  empty server queues the create with 20 Uma Tickets. An empty device offline creates too, then adopts on `exists`.
- **The wipe.** A fake `uma-racer` database, the proof databases, `uma-racer:` keys and a `racer-content` cache are
  gone. `uma-racer:g2:` keys stay. A second boot doesn't wipe again.
- **The purge** is called once. Its marker stops later calls, and a failure retries without blocking boot.
- **Taps.** `run` writes one outbox row and publishes after commit. A refusal or question writes nothing. A held
  `busyKey` ignores the second tap. A reload folds to the same state and receipts.
- **Reconcile.** Each result: `applied`, `repeated`, `refused` with its notice, `invalid`, a badge `conflict`, and an
  incomplete response that applies nothing. A badge rewritten in flight is sent again.
- **One lane.** Mixed badges, flair and operations reach the server in outbox order, 100 at a time.
- **Timing.** The 1.5 s debounce, the flush on hidden, the pull on visible and online, the backoff steps, no retry
  after a 426, and a fresh boot after a 409.
- **Plain words.** Every string in `g2/save` passes `hasBannedWord`, and every failure maps to a sentence of 02 §9.

## Acceptance

- [ ] `apps/web/src/g2/save/` holds this contract, and `git grep "g2/" apps/web/src` outside `g2/` finds nothing.
- [ ] `pnpm lint && pnpm test && pnpm build` are green. The PR states the gzip size `g2/save` and its domain imports
      would add to startup, for T143's budget check.
- [ ] The Decided here rows go into rework/02 §11 (the lane and boot also into rearchitecture/07 §3), with one
      decisions.md entry, and this spec is deleted (D104).

## Out of scope

Every screen and the Sync chip itself (T137–T142). The shell (T137); the Sign in button on Account (T138); mounting the auth provider when `g2/` becomes the entry (T143). Making `g2/` the entry, its startup
budget, and deleting `game/` and today's database code (T143). Removing the purge call (the release after the owner
confirms it ran, 07 §6). Push (phase 4).

## Decided here

| Choice | Why |
|---|---|
| Dexie holds what the server confirmed plus the outbox; the store is a fold of the outbox over it | A refused or changed answer rolls back by refolding (09 §8: "the local purchase rolls back"), and a reload rebuilds the same state |
| No device-only tables; the device's markers are `uma-racer:g2:` keys | The journals rearchitecture/01 §4.2 names left with the minigames and Puzzles |
| Debounce 1.5 s, flush when hidden, flush and pull when visible or online | uma-rpg's timing, with today's flush on hidden so a tap reaches the server before iOS suspends the app |
| Pulls overlap by 60 s, and rows are adopted by version | A commit can land just after a pull's `serverTime`, and adopting a row twice changes nothing |
| An empty device that is offline still creates the save | 02 §8: everything works offline. A later `exists` gives the server's save back |
| The purge runs in the background and never blocks the first session | It touches only `players/`, so it can run before or after the create (07 §3's order is kept when online) |
| A 409 drops the device's save and outbox | Only a deliberately deleted server save causes it (a dev reset, the rehearsal), and the taps it held were on that save |
| An operation that fails during a fold stays queued | The server is the authority; its answer settles the tap |
| The store keeps the latest 100 receipts, local and server | The summary compares them for "Already collected" (02 §9), and older ones stay in Dexie |
| An empty device opens once the rule kinds have arrived; history loads behind it | A second device plays at once, with no wait for months of race results |
| `racer-content` is deleted once and the service worker refills it | 07 §2, and the first boot needs a connection anyway, to sign in |
