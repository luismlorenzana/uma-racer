# T115 — Rehearsed preservation migration and safe Spark retirement

**Depends on T106–T114, including usable real rewards and CL spending.** Read design §8, implementation §8,
D177/D211–D214/D255–D256, current schema migrations, training EXP bank/ticket host and protected Inspiration advance.
This task implements and rehearses **dormant** cutover code. T116 authorizes/enables production activation separately.

## Preservation outcome

One authoritative frozen cohort creates scenario/style debt from existing CL, preserves every earned level/build,
converts remaining unapplied EXP to preserved universal stock and retires paid Spark attempts with exact-once refunds.
There is no free raise to10, new scenario unlock, outfit/card deletion, preset multiplication, Inspiration advance,
RPG reset or farming migration. Existing account progress remains playable before activation.

## Preparation state machine

Implement protected, authenticated API preparation and client startup coordination with states unavailable / needs
sync / preparing / active / recoverable-error. Off release capability never invokes it. Verify real compatible content
and replacement UI first. Sync/migrate authoritative owned Uma/profile rows and resolve outgoing old Spark commits
before freezing; pending or malformed data shows actionable recovery, not a guess or silent erase.

During preparing, lock conflicting old training/EXP/universal spends and new Puzzle economic settlement, not unrelated
racing/Farm/RPG. Explain preparation and Retry. Do not mark an account active before every preservation receipt is
complete. New scenario/outfit mutations during preparation must either be outside the frozen cohort or delayed safely;
never silently resnapshot the cohort after a retry. Freeze accepted authoritative versions, not a stale local export.

Freeze a stable cutover id/catalogue version and current owned outfit/scenario list with exact levels, preferred
source-A style or Front/Pace/Late/End fallback, partial EXP, account EXP bank and legacy stock. Source grades come
from verified Uma templates, not lineage/old default guesses. Current saved preference is `racePreferences.strategy`
(verify actual field on latest main); null/non-A falls back. Record exact choice/CL−1 debit per unit once. Unknown source
or scenario fails visibly before any guessed debit. Empty cohort can complete without debt.

Process bounded per-unit batches with exact receipts; final account conversion/activation is a separate idempotent
step. Validate cohort bytes/documents against Firestore limits, using bounded receipt rows rather than an oversized
single document. Local-file and Firestore implementations must have the same resumable semantics. No cloud credentials.

## Exact legacy conversion

Preserve all existing universal `training:level-up-ticket` quantities and evidence. Pool only **unapplied** unit
`trainingExp` and profile `trainingExpBank` after older migrations/settlements; each full1,250 adds one universal CL
ticket and the final positive fraction rounds once per account. Raw total/remainder/compensation and original stock
are in final receipt; clear transferred fields and write credit together. Already converted overflow is not recounted.
No per-unit round-up and no remaining spendable EXP bank that can convert again. Migration credit bypasses new debt.

Debt equals preserved CL−1 per unit, including levels earned by any old legitimate method, but not a second debit
from old history. Preserved universals can later raise CL in unlocked scenarios; spending never expands/redebits the
frozen cohort. New outfits/scenarios after freeze have no legacy debt. Zero balances retain their migration receipt.

## Old runs and client safety

Distinguish completed/committed, terminal-but-pending and unfinished paid Spark rows using versioned parsers/evidence.
Resolve legitimate pending terminal result before cohort freeze; unfinished paid run closes/refunds original daily
ticket once using D177 `minigame-refund` semantics, including its existing cap treatment. Never both apply uncommitted
EXP and refund it. Preserve finished histories/seed/action references and malformed rows for explicit recovery.
Other devices' old reservations must use the same idempotent retirement evidence on reconnect, not fresh timestamps
as refund identity. Friendship/global card stars are not retired and paid old Friendship journals remain valid.

Updated active clients refuse old Spark reserve/commit; old routes redirect to Hub with a clear explanation, not a
secret auto-enrollment. Keep old engine/parser dispatch needed for historical result/retirement validation, lazy/dev
only where possible. Do not delete it until no restore/validation path needs it. After active cutover, old cached
clients' scenario TL/EXP/profile bank writes are rejected with explicit Update/recovery, while valid new racing/config
updates preserve receipt-owned CL. Test an offline older client reconnect; it cannot overwrite newer schema or re-credit.

## Rename and targeted documentation sweep

Change active UI/domain vocabulary to CL without changing shared formula values. Choose/document next schema version
from actual main; whether storage fields rename or adapt must be explicit in parser/migration tests, not aliases
silently accepted forever. Remove only training-game launch controls from Profile/Training/Constellation; preserve
configuration, three Training visualizations, independent Inspiration/Extra stats and race presets/defaults.
Keep global card stars/era scaling and node assignments/loadouts exactly intact. Fully Trained CL10 fact remains;
earned Spark/trainer/flair facts remain historical and are not reevaluated to disappear.

Update overview, Uma progression, Training, Constellations, Minigames/kit, Economy/Items, Scenarios/badges, architecture,
save/implementation pages, README and guide terminology. Current `max(base,50×TL)` prose must match shipped fixed-base
projection, not reintroduce a stat floor. Correct touched scenario-local-card text to D255; don't rewrite Claude's
current RPG combat/maps under unrelated cleanup. Historical decisions/ledger ids are append-only, not retroactively renamed.

## Rehearsal and acceptance

Synthetic old-schema saves with four presets, several units/levels, stock/remainders, old overflow, Inspiration/Extra
stats/cards/skills/badges/races and open/finished/malformed runs. Test exact before/after preservation, 1→0 debt / 10→9,
multi-A single style, future-unit exclusion, old migration ordering, interrupted batch/finalization/reinstall/retry,
empty account, unavailable source, write-failure rollback, oversized cohort refusal, final fraction once and no second
credit. Test every old-run status, refund idempotency/storage cap, another-device late retirement and old-client refusal.

Provide dry-run aggregate debt/EXP/stock/refund summary and an owner-run backup/restore rehearsal using **synthetic**
data. No real account row export in git/logs. Record recovery actions and completed receipts in living technical docs;
do not promise a simple frontend rollback after money/debt mutation—only forward recovery from receipts or explicit
owner-authorized restore through existing tooling.

Run lint/test/build + sim:puzzles + sim:spark + sim:training; report startup/retained legacy and Puzzle chunks.
Screenshots show preparing/retry/preview/active synthetic result at390×844 and375×667. Delete spec/update M030/index
once dormant code/tests/docs are complete. **No live migration, enabled capability, content publish or infra edit here.**
