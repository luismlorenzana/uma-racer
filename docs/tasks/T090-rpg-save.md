# T090 — RPG save schema and atomic command protocol

**Outcome:** per-outfit, per-preset and per-chapter state round-trips safely, and a rejected checkpoint cannot leave
an EXP or Item log behind. Depends on T089 and the **latest merged save versions**, not a number reserved here. Read
[M028](M028-uma-rpg.md), [implementation contract](../technical/uma-rpg-implementation.md),
[Architecture](../technical/architecture.md), D219/D223 and current save/API/Dexie modules.

## State and parser deliverables

1. Add separate synchronized RPG outfit, preset and checkpoint entity kinds plus bounded result/promotion evidence
  log kinds, including a durable grouped-command receipt, in `packages/domain/src/save.ts` and
  `apps/api/src/save/save.types.ts`. A preset has five ordered nullable
  slots and may save incomplete; entry requires five distinct owned outfits. Outfit state freezes selected class,
  weapon, enrollment inputs, tier/EXP/current tree and bounded active legacy choices. Promotion history is an
  append log, not an unbounded profile array. Checkpoint has versioned chapter/attempt, last cleared node, status,
  expected revision and optional frozen entry. See the shared contract for ownership and keys.
2. Update `apps/web/src/game/db.ts`, `persistence.ts`, `sync.ts` and relevant boot/adoption paths. Add current-version
  migration that leaves existing Umas/cards/Farm/Items untouched and creates **no invented enrollments**. API and
  client exact-key parsers reject unknown/newer schema, invalid ids, duplicate slots, impossible nested counts and
  unsafe numbers. Client must not silently discard RPG rows when adopting a cloud snapshot or older client syncs.

## Atomicity deliverable

The current normal `/api/sync` appends logs even if an associated upsert conflicts. Add a **conditional grouped RPG
mutation** to the authenticated save protocol (or a separate authenticated command with equivalent semantics):
command id, expected versions of every touched row, entity changes, log appends, and one applied/duplicate/conflict
receipt. Both `firestore-save.repository.ts` and `local-save.repository.ts` accept all members or none in one
transaction. Duplicate command id and identical payload hash returns the original receipt; reuse with different
payload rejects. A stale version returns authoritative rows/versions
without any associated append. Keep non-RPG sync backwards-compatible; do not alter infrastructure or workflows.
The web outbox cannot treat a conflicted RPG group as acknowledged. Offline commands remain pending and their
rewards unavailable until accepted. Define stable encounter/seed from account+preset+chapter+attempt+node identity,
and freeze content hash/party/enemy kit at entry. A free loss retry increments only retry ordinal and result claim
id, never seed/kit; a takeover changes lease/revision, not those frozen bytes.

## Mandatory adversarial tests

First demonstrate the ordinary-sync orphan-log hazard in a test, then prove the grouped path prevents it. Test both
repositories and fake IndexedDB for: empty→current migration, old cloud snapshot, corrupt/oversized row, two paused
chapters, simultaneous begin, duplicate group, stale checkpoint plus result log, stale Item stack plus ledger append,
result before begin, takeover and generic sync regression. Every rejection leaves zero grouped writes/logs. Local JSON
API and Firestore behavior must match. `pnpm lint`, `pnpm test`, `pnpm build` pass; update architecture and remove this
spec in its PR (D104).

**Out of scope:** player battle actions, maps, visible UI and actual RPG EXP/token grants. T092 uses the command
protocol; T096/T098 fill its reward payload.
