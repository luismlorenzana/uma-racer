# T111 — Real Puzzle host, local journal and recovery

**Depends on T110 and the pure/content contracts.** Read implementation §§4–8, current `rpg-local.ts`,
`minigame-journal.ts`, persistence/runtime scheduling and Items evidence reconciliation. Copy transaction discipline,
not RPG's automatic empty-journal restart or the ticketed host's target/64-action assumptions.

## Deliverable

Implement the real port under `apps/web/src/game/puzzles/`: account selectors, enrollment/party/loadout mutation,
checkpoint/reservation, journal compare-and-append, terminal replay/settlement, material previews/spend/exchange,
pending operation scheduling and recovery. Provide an explicitly isolated test double/in-memory proof adapter using
the same domain API, never the installed production default. No screen, live account migration or Home enablement.

## Account and reservation transactions

Enrollment verifies an owned outfit and a verified template, literal-A eligibility and selected element. Correction
re-reads first-entry state and relevant open battles. Party save/transfer reads both party revisions and open encounters;
reject stale/incomplete-for-entry/duplicate/equipped-locked skills. Confirmed transfer may leave source party incomplete
but never erase its map wins or move a member out of an open battle. Slot1 leader is explicit and frozen.

Opening a chapter creates/reuses party/scenario checkpoint and foreground view only. Begin re-reads five enrolled
owned entrants, full party, reachable node, Dark variant, active bank, release/content readiness and current revision.
Atomically freeze input, persist attempt ordinal/id/epoch/seed/open descriptor, create empty device journal, lock element
correction, enqueue semantic operation/evidence. Free entry never touches daily Training Tickets. Existing open
reservation returns itself; stale variant/party cannot create a new board. Attempt ordinal is persisted, never elapsed
time or `Math.random`; use account/preset/scenario/node/ordinal plus named streams.

## Journal and terminal commit

`loadBattle` parses frozen input/version and replays all accepted actions, returning current state/hash/result or a
typed visible recovery condition. `append(battleId, epoch, expectedCount, action)` re-reads descriptor/journal inside a
transaction, validates by replay/reducer, stores one action/count/hash, then returns the predecided event sequence.
Two stale tabs cannot append from the same count. Reject all invalid/terminal/overbound actions without writes.
No gesture preview, pause/guide/target tap or canceled path is persisted as a turn.

Commit accepts only id/epoch/expected-count/hash claim, replays the complete local journal and verifies terminal.
In one Dexie transaction, write:

1. five outfit EXP/projection changes on a win, preserving enrollment/loadouts;
2. checkpoint clear/attempt/terminal state and account exchange-edge fact if applicable;
3. stable terminal result receipt, even for no-reward loss/abandon;
4. one gross vector through matching debt into Items and exact itemLedger evidence;
5. operation/pending projection/outbox; archive/close the journal only after receipt persistence.

Receipt identity ensures retry after reload returns exact result rather than replay-paying again. Reused id with
different input/outcome is a typed conflict. Update Zustand/selectors and arm `gameRuntime.schedule()` only after
persistence. Do not check a possibly stale store pending-count before scheduling. Keep operation projection ownership
consistent with T110 canonical reconciliation and possible post-sync repayment adjustment.

## Materials port

Real CL preview/spend returns revision, eligible stocks, exact mixed input vector, CL before/after, actual
`nodesUnlockedBetween(constellationTemplate(tier), before, after)` ids/labels and derived stat/SP deltas. Re-read source
A/scenario/stocks before writing. Result links to the chosen outfit/scenario; no invented Spark node labels.
CL9/10 result explicitly reports SP-only gain. Include existing badge/trainer reconciliation and outbox in transaction.
Legacy universal input is separate from new style families and never becomes newly earned debt repayment.

Exchange port returns unlocked edge, exact positive input, gross/output repayment/net, after-stock/debt and expected
revision. Confirmation writes input debit + output grant/debt + paired evidence + receipt/pending/outbox atomically.
No partial success or screen-managed item mutation. Preparing bank blocks reward/exchange/spend with Retry/Return.

## Recovery policy

Same-device reload restores exact board/foes/HP/charge/turn/actions. Missing/corrupt/future journal never silently
starts empty. Foreign open descriptor offers read-only origin/resume info and explicit online takeover; accepted
takeover restarts same input/seed at turn0 under new epoch, without a new reward id. Displaced device archives its
journal and adopts canonical result/owner. If offline takeover cannot be acknowledged, encounter stays blocked;
other parties/modes still work. Never reset a frozen fight because its retained content is temporarily unavailable.

## Required tests

Use fake IndexedDB with tiny synthetic content and readiness adapters; no real account source rows. Test at least:
enroll/correct/lock; atomic transfer and open-party blocks; full-party/unknown node/variant/reservation retry;
fixed seed/ordinal across reload; compare-and-append conflict; canceled gesture represented by no append;
JSON/engine-version replay; terminal win/loss/abandon and repeated commit; exact five EXP awards and single loot vector;
−7/gross12 split; wrong debt family; exchange/spend retry/stale/rollback; zero-reward terminal receipt;
failure injection after each outfit/checkpoint/result/item/bank/ledger/queue write; scheduler runs after durable write;
canonical result adjustment; second-device takeover/old-epoch rejection and missing/corrupt journal recovery.

Run lint/test/build + sim:puzzles, report startup gzip. Publish real port/types and transaction boundaries in living
technical docs, append decision where needed, delete spec/update M030/index. Production never installs a double;
release guard remains off, with current Spark untouched. This host must work with genuine Dexie rows before UI tasks.
