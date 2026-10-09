# T119 — Additive Farm records and atomic semantic sync

**M031 · after T118 merges · release off.** Read AGENTS/README/index, [M031](M031-farm-kitchen-rework.md),
[design §§15–16](../design/farm-kitchen-rework.md), the complete
[technical contract](../technical/farm-kitchen-implementation.md), T118's pinned rules and latest architecture.
Inspect the real `puzzle-sync.ts`/operations/local+Firestore adapters, `save.types.ts`, web DB/adoption/outbox,
legacy `reconcileFarmEvidence` and their tests. Mirror the transaction pattern, not Puzzle gameplay or limits.

## Goal and fixed choices

Add strict v3 Farm persistence and one semantic economic lane. A recipe's ingredients, station, output/EXP and
receipt must commit/reject together; unrelated last-write-wins stack uploads are not sufficient. Normal accounts
keep the existing Farm/Extra path unchanged. No cutover is invoked and both new application capabilities are false.

The technical §3 collections are fixed: `farm/main` v3, independent `farmWorkers`, `farmRecipes`, `farmExtra`,
immutable `farmOperations`, protected cutover control/pages, existing `items`/`itemLedger`, device-only pending/
recovery. No new Uma/profile schema is needed and no 65-node array is forced into the old Extra parser.

## Deliverables and protocol

1. Add domain records/parsers/operations/resolver modules under `farm/kitchen/`, explicit API standalone mirror
   under `save/farm-domain/`, and parity fixtures. Exact key sets, generation/id agreement, timestamps, node/
   preset bounds, family/block/worker checks, safe integers, bounded strings and serialized bytes everywhere.
2. Extend SaveSnapshot/entity/log unions on domain+API, load/export/import/adoption, local/Firestore repositories,
   additive Dexie tables and outbox kind. Preserve legacy shapes and versioned history; next actual free Dexie
   version, no legacy-row upgrade or reset in its `upgrade` callback. Missing new rows are legitimate empty views.
3. Extend `/api/sync` with optional `farmProtocolVersion:1` / `farmOperations` and complete typed responses.
   Payloads are technical §4's assign/remove/start/claim/energy/buy-node/set-active/grant-energy/claim-legacy.
   The resolver validates expected reads, dependencies and phase, derives awards itself and returns exact
   immutable receipts. Reject same-ID/different-payload; return identical receipts before stale-version checks.
   Claim checks all registered recipe-block rows against the resulting level, not only the claimed recipe's
   block; include this bounded set in locks/transport tests, including already-over-threshold workers.
4. A job terminal guard prevents double claims with **different** operation IDs; a purchase guard prevents
   paying one target twice across scenarios/distances/devices. An already-bought target returns its existing
   purchase result with no additional spend/activation. Retry identity cannot shift to the next node/job.
5. Write input debit evidence on Start, output/12 EXP and milestones/cookbook on Claim, zero Item movement for
   activation. Frozen jobs persist exact recipe/quantity/inputs/rules/worker/deadline. Acceleration is separate
   and never mutates planted/start time. Claim-legacy uses original cycle history, yields old output only.
6. Compute exact static reference sets, including implicit cutover/Puzzle control guards, ownership, input/
   output stacks, receipts and target/job evidence. Enforce unchanged 16 groups/256 KiB/200 references and shared
   lower ceilings; sender partitions by their union. Farm and Puzzle semantic requests are separate batches.
   Firestore reads precede writes; local-file replacement runs the identical pure resolver result atomically.
7. Protect v3 projections/new evidence/Farm-prefixed items from ordinary sync. Always read cutover control
   when legacy Farm/Extra writes or Uma writers could resurrect retired fields. During/after reset, reject new
   legacy Farm/Extra mutations visibly; identical historic facts stay idempotent. Compose Puzzle protection
   and Farm protection without changing either game's rewards/CL/preservation. Old clients cannot omit a
   protocol field to bypass guards, nor upload v2 over v3.
8. Implement domain/runtime adoption contracts that distinguish canonical snapshots from pending predictions.
   Pending economic state never becomes an ordinary `items` upsert. Accepted receipts update all canonical
   entities/logs and pending markers once; re-read versions so lost/stale replies cannot overwrite newer rows.
   T121 owns the user-facing host/replay queue, but its storage/response contract must be usable here.

The existing API Puzzle mirror imports legacy Farm helpers. Keep those old dependencies valid; do not repurpose
`puzzle-domain/farm` as an incompatible new Farm model. Do not edit Puzzle preservation content under D291.
Add an API mirror parity/source test so future rule changes cannot silently drift between browser/server.

## Required tests

| Area | Cases |
|---|---|
| Parsers | Every record/payload/receipt, unknown keys/version/family/scenario, wrong row IDs/generation, node bounds, unsafe XP/amount/time, future schemas preserved visibly |
| Atomicity | Failure after each station, worker, stack, evidence, milestone/map, receipt and outbox write; zero partial debit/award |
| Idempotence | Same Start/Claim/Energy/Buy retry, changed payload, distinct-ID same-job Claim, distinct-ID same-node Buy, cross-device replay/lost reply |
| Economics | Insufficient one of ten inputs rejects all; quantity 4 banquet exact debit; no split-stock slot; pending outputs not canonical; wrong-block/processed-as-raw errors |
| Ownership |30 station uniqueness, idle move, busy/ready refusal, unavailable outfit, no character collapsing, no all-worker authority scan |
| Versions | Fresh/old row, deleted required row, missing lock/version refs, out-of-order dependencies, duplicate dependency, rejected ancestor, newer local edit during acknowledgement |
| Guards | Old v2 writer, ordinary new Farm item/evidence upload, stale nonempty legacy Extra on an Uma, unrelated valid race/card/RPG/Puzzle writes, active/resetting control even when request omits it |
| Adapters | Local file and fake Firestore same full result, read-before-write ordering, rollback, authenticated route and no credential/network requirement |
| Transport | Four banquets/ten stacks, 30 claims, 16 max commands, overlapping and disjoint refs, exact/over 200 and 256 KiB boundaries, large roster/fourteen units/four presets, single oversized command rejected not split |
| Adoption | GET save/bootstrap/cloud restore round trip, unknown future rows retain recoverable error, no legacy EXP evidence entering v3 progress, no duplicate upload of predicted items |

Record actual maximum document/receipt/batch sizes and reference counts in technical §5. Tests must include new
Items plus another subsystem's ordinary writes; a new Farm parser cannot make existing global inventory fail.

## Verification and completion

Run lint/test/build, both new Farm sims, legacyFarm/constellation/career and Puzzle/RPG regressions relevant to
parser/sync joins. Report startup gzip ≤ 180 KB. Keep all normal feature flags false, no owner read/write or migration.
Update technical §§3–5 with actual types/version/read sets, design persistence, architecture planned boundaries,
decision/index/M031 statuses. Delete this spec in the completing PR (D104). One task/PR/merge before T120.

## Out of scope

No live reset/archive/prepare call, UI or production host installation, release enablement, manual account JSON,
infra/workflows/env/credentials, changed sync limits, deps, private datasets or other game economy.
