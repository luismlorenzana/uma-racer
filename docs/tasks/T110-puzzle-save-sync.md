# T110 — Additive saves and atomic background operation sync

**Depends on T106–T109 contracts.** Read the [implementation contract §§2–8](../technical/uma-puzzles-implementation.md),
architecture, current `save.ts`, API `save.types.ts`/repositories, Dexie migrations/runtime and D256/D260/D263.
This is the protocol gate before the real host/UI, not permission to cut over the owner account.

## Deliverable

Implement additive versioned Puzzle entities/logs, device-only pending/journal/archive tables, explicit API parsers,
snapshot loading/adoption and a bounded optional Puzzle operation group in normal `/api/sync`. Cover local-file and
Firestore repository behavior with parity tests. Implement the release capability **off** and typed preparing/active
guards. No Home entry, live bank creation, destructive old-table migration or per-drag server request.

## Records and parser contract

Use semantic records in implementation §3. Publish exact interfaces, ids/indexes/schema versions and storage ownership
in the living technical page before this task merges; downstream T111 must not invent missing fields. Define:

- Outfit enrollment/source snapshot, PL/remaining EXP/selected kit/first entry and projection revision.
- Five nullable ordered party slots, names/leader/loadout, foreground chapter and revision; incomplete parties can be
  saved but cannot reserve. One outfit per preset and across presets, explicit atomic transfer outside open battles.
- Party/scenario checkpoint, reached/cleared facts, per-node attempt ordinals, one open encounter descriptor with
  owner epoch/device id/frozen input/version/content identity. Open battle locks relevant members/loadout/leader edits.
- Terminal result receipt and operation receipt: payload identity, exact frozen result identity, canonical before/
  after changes and gross/debtPaid/net material vector. Different payload under one id is an error, not first-copy success.
- Protected Constellation bank/cohort header and bounded per-unit cutover evidence; preparing is resumable, active
  immutable cohort remains after balance reaches0. Support an empty owned cohort without an endless preparing state.
- Device-only journal/pending operation/archive rows. These must not leak into snapshot serialization or sync logs.

Strict object/array/id/version validation, finite safe integers, unique five ids, source-A membership, chapter/scenario
identity, derived EXP/reward bounds and negative-bank range. No `any` to bypass parsers. Add symmetric domain/API
fixtures for all new types and source unions. Existing API packaging does not execute source-TS domain imports;
keep independent API adapters or prove a small compatible packaging change without editing Docker/infra.

## Operation protocol — required semantics

Extend request/response compatibly with optional `puzzleOperations` and per-operation canonical status/receipt/rows.
Typed operations: enroll/correct, save/transfer/equip party, reserve encounter, settle terminal battle, CL spend,
exchange. Protected prepare/takeover have their own explicit authenticated account boundary. All routes remain behind
AuthGuard; no cloud credentials. Preparation's implementation is T115, but reserve its validated interface now.

Each group identifies operation id/digest, dependencies, relevant projection/economic revisions and semantic payload.
Do not submit arbitrary writable-entity vectors as the public mutation API. Compute exact projections from current
rows and frozen inputs; reject cross-account/mismatched id/unsupported source. Keep unrelated ordinary upserts working.
Use bounded limits documented in the contract: maximum **16 groups**, **256 KiB encoded Puzzle payload** and **200
distinct referenced documents per sync transaction**. Validate before reads/writes; integration must also respect any
stricter existing total request limit. Partition ordered queues without splitting a single atomic economic operation.
These are transport protections, not gameplay inventory/level caps.

Receipt check comes first: same id/digest returns canonical receipt even if expected revisions are now old. New
operation validates dependencies and current state, then writes all related projections/evidence/ledger/receipt or
none. No accepted append beside a rejected inventory debit. Firestore resolves all read dependencies before writes;
local-file repository serializes and atomic-renames the equivalent result. All response statuses account for request
operations exactly once; no unknown/duplicate/missing receipt acknowledgment.

Reward settlement verifies open battle id/epoch/input hash and absence of prior terminal receipt, computes the frozen
five EXP awards and gross drop vector from the accepted input, applies them to current progression and matching debt,
and closes the attempt once. The web host proves terminal state by replay; API validates semantic result boundaries,
not a UI-provided ticket count. No claim of server streaming/anti-cheat replay, no silently synced gesture journal.

CL/exchange cannot use ordinary entity last-write-wins. Canonical receipts own their CL/item/bank changes. An incoming
ordinary racing/configuration row must preserve receipt-owned CL and post-cutover cleared EXP while retaining its
valid unrelated updates. Stale old-client TL/EXP writes receive explicit update/recovery errors. Existing Farm/RPG/
Inspiration Items retain their established evidence paths; do not let new Puzzle stack protection block those modes.

## Local optimistic projection and reconciliation

Add an ordered pending queue with dependency ids. Persist a local operation's projection and rollback/rebase metadata
atomically, mark it pending and schedule normal background sync; no Submit/Accept UI. Canonical receipts are adopted
as a group, then valid unacknowledged operations replay in order. Conflict rejects the group, retains diagnostic input,
restores all its projections and blocks invalid dependents. User copy must explain changes rather than silently erase
configuration. Rejected CL cannot continue supplying locked-node stats; preserve that build for recovery instead of
deleting the user's cards/presets. Do not overwrite racing/Farm/RPG edits while repairing a Puzzle projection.

Gross result is stable; canonical repayment can change after a competing accepted reward. Recompute net inventory
and debt together from canonical evidence and show pending→synced adjustment. Keep an accepted win's fixed EXP award
additive; max-level/last-write-wins outfit replacement loses parallel wins and is forbidden.

## Takeover and migration scaffolding

Takeover only acknowledges online after comparing owner epoch and absence of terminal receipt; increments epoch but
preserves frozen input/seed/battle id. No lease timeout that silently rerolls. Old-epoch settlement rejects; if result
accepted first, takeover returns that result. Reserve never changes an existing open input. First entry locks correction.
All actual cutover code remains off; version/readiness guards must be testable with synthetic active/preparing banks.

## Test matrix and acceptance

Domain/API parser parity, future/old/malformed records, bounds/ids/prototype keys, empty cohort; additive Dexie upgrade
preserves every existing table/row/outbox and does not migrate real training; snapshot adopts all new kinds.
Repository tests: successful group, duplicate retry, reused-id conflict, rollback, missing dependency, stale spend,
same battle competing claims, reserve versus party edit, settlement versus takeover, input/debt tampering, old-client
progress guard, response mismatch, request partition/bounds and local-file/Firestore atomic equivalence.
Web reconciliation tests: two offline spends cannot both use one stack; accepted reward plus stale pending spend,
two additive wins, same result duplicate, changed canonical debt split, rejected dependent group, reload queue and
unrelated racing/Farm/RPG edits survive. Firestore fake/emulator-style tests need no production credentials.

Run lint/test/build + sim:puzzles; report startup gzip. Record exact protocol/versions, newly bounded limits and decision
in living docs. Delete spec/update M030/index. **Do not move on to T111 with unresolved economic LWW or silent restart.**
No live preparation, content publish, infrastructure edits, replacement of RPG sync or release gate activation.
