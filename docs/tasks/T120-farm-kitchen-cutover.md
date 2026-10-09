# T120 — Protected Farm/Extra reset, recovery archive and legacy jobs

**M031 · after T119 merges · implement dormant, never execute on the owner account.** Read AGENTS/README/index,
[M031](M031-farm-kitchen-rework.md), [design §16](../design/farm-kitchen-rework.md),
[technical §§3–6](../technical/farm-kitchen-implementation.md), actual T119 records/guards and existing backup/
adoption patterns. Read D287–D291 for safety precedents, not permission to alter Puzzle preservation.

## Goal and exact reset scope

Author and rehearse one generation-based, server-acknowledged migration. When T124 eventually enables it,
every owned outfit returns to Farm Lv 1/EXP 0 and every old scenario/preset Extra purchase/active selection clears.
The replacement starts with all thirty spots open, no expertise, blank new maps/recipes/cookbook and retained
old stock/jobs. Reinstall/retry/second device cannot reset twice or resurrect progress from historical evidence.

**Preserve:** owned outfits/cards/global stars/card sets, racing EXP/levels/goals/results, all scenario units,
CL/aptitudes/skills/SP/lineage assignments, Inspiration slots/golds/tokens/debts, RPG/Puzzle parties/progress/
pending journals and backups, unrelated global Items, old Produce stock and all historical ledgers. No coupons,
meals, free nodes, new scenario or outfit/card deletion. Distinct outfits of one character reset independently.

## Implementation steps

1. Extend SaveRepository/controllers with one authenticated protected Farm preparation/advance path, parallel
   to existing generation operations. Request/response parsers, local-file adapter and fake-testable Firestore
   adapter share the pure T119 reset resolver. Keep matching capabilities false and reject owner execution.
2. Precondition new-client persistent storage/online and drained legacy Farm/Extra economic queues. Defer during
   race/CL/scenario/promotion/redemption commits. An unresolved old offline spend is retained/recoverable; no
   startup callback quietly discards it. Allow a retry after normal sync acknowledgement.
3. Capture a private **whole-account** device-local/exportable archive before destructive work. Include canonical
   rows/history, account/build/schema metadata, local pending operation/journal intents and a digest. Use a
   separate Farm recovery record, never replace a Puzzle archive. Verify write/read/identity/digest before
   prepare; failed/oversize storage blocks migration. Tests use invented account JSON only.
4. Validate source revisions against the archive acknowledgement; freeze one authoritative cohort of owned
   outfits/all scenario units plus legacy station assignment/job facts. Use max 32 outfits per page, ≤ 4096 cohort
   and current byte/doc caps; no giant snapshot or rereading the changing roster on Retry. Stale pre-freeze
   source requests need refreshed archival proof. Malformed/out-of-bound rows fail before any reset step.
5. Advance one bounded outfit transaction at a time: clear its retired Extra shared counts and all four active
   lists across **every** unlocked scenario; write worker EXP 0/new generation and empty new map ownership;
   append exact step receipt. Patch current authoritative non-reset fields, not a frozen full Uma object.
   Update control progress atomically. A lost reply returns the existing step; acquisition after freeze starts
   at the new zero default, not another cohort reset. Do not touch Constellation/Inspirations/debt.
6. Finalize only after every frozen step verifies. Convert old slots 1–6→Garden, 7–12→Orchard, 13–18→Barnyard;
   keep workers and original legacy jobs/deadlines/cycleIDs/attempt floors, with Workshop/Kitchen empty.
   Strip legacy crop suggestions from new recipe defaults. All thirty stations remain available. Control,
   schema 3 Farm, zero recipes/new maps and final receipt agree before active status is returned.
7. Adopt accepted local changes transactionally, preserve unrelated newer edits and block old evidence
   reconciliation from generating new EXP/maps. A fresh device with active control adopts without invoking
   reset. Never re-run Inspiration advance/Puzzle preservation, migrate RPG classes or alter their backups.
8. Add `claim-legacy`: mapped running job remains claimable once after its exact old deadline, giving only its
   one old crop output, no new Farm EXP/recipe/cookbook. Both old cycle evidence and a target guard prevent
   two different requests paying twice. Historical already-claimed jobs do not reappear; busy legacy station
   cannot start a new job until claimed. Old stock remains Legacy Items, never converted into new meals.
9. Recovery/export exposes preparing/resetting/active and failed step with Retry/Export. Do not automatically
   clear/archive malformed rows or restore old progress. Compatible forward repair is the default after a
   partial/active reset; a whole-account restore requires a separately explicit owner request.

## Synthetic rehearsal matrix

- Empty new account; old farm absent; v1/v2 Farm; all 18 old slots; one ongoing job per valid legacy duration;
  idle/ready workers; owned unassigned/never-farmed outfits; two outfits sharing a character; sparse old worker map.
- Each of 14 scenarios × four presets with different old bought/active counts. Exact before/after whitelist
  comparison proves only Farm EXP/levels and Extra state change. Cards/presets/lineage/goals/debts/items byte-equal.
- Capture failure, archive read/digest/account mismatch, unknown future save, oversized cohort/page, stale source
  revisions and interrupted prepare **before reset**: no destructive changes and actionable recovery.
- Failure after each outfit and before/after finalize; repeat identical requests and missing acknowledgements.
  The cohort/count/digest/step IDs stay fixed, no additional reset or recipe/XP grant.
- Device B offline on v2; old queued Farm/Extra writer after prepare/active; newer valid non-Farm Uma edit during
  a reset step; acquisition/scenario opening around freeze; uninstall/new-device active adoption. No resurrected
  legacy Extra, deleted outfit or whole-object overwrite.
- Legacy harvest accepted before freeze versus claimed after active, same/different request IDs, preserved old
  evidence and round-trip recovery archive. Claims yield zero new EXP regardless of old level/future worker progress.
- Existing Puzzle control active/preparing and Inspiration bank coexist unchanged. In-flight old race completion
  is deferred/drained, not rerolled; historical race inputs remain intact.

Use fake IndexedDB/local/fake Firestore repositories, explicit clocks and fault hooks. Create aggregate-only
`docs/research/farm-kitchen-cutover-rehearsal.md`: cases, counts, digests, pass/fail and limitations, no owner JSON.
Normal CI/migrations must not call protected preparation on real startup while capabilities are false.

## Verification / done

Lint/test/build, both new Farm sims and relevant sync/Puzzle/RPG regression suites pass. Startup ≤ 180 KB gzip;
archive/cutover adapters lazy. Technical§6 records actual version/generation/receipt shapes, migration phases,
archive retention/export policy and old-client safeguards. Append decision, update M031/index and delete this
spec (D104). Task complete means the reset is implemented **and safely rehearsed**, not activated in production.

## Not authorized here

No owner save/content read, real prepare/reset, grant, release flag, private publication, credentials, infra,
workflow/env change, bulk deletion, auto-restore or removal of legacy stock/history. T124 owns guarded activation.
