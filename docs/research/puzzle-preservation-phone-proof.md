# Uma Puzzles preservation — synthetic rehearsal (T115 / D287)

2026-10-08. **Dormant migration code and desktop browser proof at phone sizes**, not physical-iPhone acceptance or
production activation. Both release flags remain false. No owner account was read, migrated, credited or restored;
no private rows/art were committed, and no content publish or infrastructure change was made. T116 and the
owner-pinned permitted PAD originals remain release gates.

## What runs

DEV-only `/dev/puzzles-preservation-proof` uses the same preservation reducer and startup panel with40 invented
outfits in memory. Its intentionally simple CL4/EXP700 fixture demonstrates immutable preview, freeze,16-unit
batches, interrupted Retry and separate final activation. It produces120 materials of legacy debt, pools28,251
unapplied EXP and preserves3 original universals plus23 credited ones. No auth, API, owner Dexie store or imported
content is involved. Reload resets only this in-memory demonstration, not a real cutover.

The independent `pnpm sim:puzzles:preservation` rehearsal uses varied synthetic levels and EXP:40 units,180 debt,
15,983 raw EXP,12 full tickets plus one983-EXP account fraction,3 original stock →16 total universals, and5 originally
paid daily tickets refunded once. It verifies interrupted retry, restoring the whole pre-freeze backup and restoring
the completed backup without a second credit. Different fixture totals are intentional, not a balance change.

## Screenshots

All images are original UI and invented data. Browser dimensions match390×844 and375×667; no horizontal overflow
was observed and all three controls measured48px high. These are viewport captures, not full-page composites.

| State | 390×844 | 375×667 |
|---|---|---|
| Write-free authoritative preview | [JPEG](puzzle-preservation/preview-390x844.jpg) | [JPEG](puzzle-preservation/preview-375x667.jpg) |
| Frozen cohort, first16 units complete | [JPEG](puzzle-preservation/preparing-390x844.jpg) | [JPEG](puzzle-preservation/preparing-375x667.jpg) |
| Interrupted connection; receipts retained | [JPEG](puzzle-preservation/retry-390x844.jpg) | [JPEG](puzzle-preservation/retry-375x667.jpg) |
| Active,40/40 preserved | [JPEG](puzzle-preservation/active-390x844.jpg) | [JPEG](puzzle-preservation/active-375x667.jpg) |

## Automated evidence

`pnpm lint`, `pnpm test` (**1,462 tests across six packages**) and `pnpm build` pass on main's latest RPG changes.
Eight pure preservation, five legacy Spark, fifteen API repository and ten client coordinator tests cover:

- Exact levels, source-A preference/fallback, CL1→0/CL10→9 debt and one unit rather than one debit per preset/style.
- Distinct four-preset cards, lineage, Inspiration, crops, skills and unrelated earned/history rows preserved.
- Empty/zero-debt units, old migration ordering, future-unit exclusion, safe-size refusal, unavailable sources and
  frozen replacement-hash verification before any guessed mutation.
- JSON-file and read-before-write Firestore transaction semantics, failed freeze/batch/refund rollback, duplicate
  requests, original paid costs and stable cross-device refund evidence above the daily storage cap.
- Lost freeze/batch/final replies, database reopen, canonical reconciliation without erasing unrelated local work,
  atomic future-outfit schema16 stamping, unchanged Friendship journals and explicit recovery of unknown old runs.
- Retired cached-client rejection, protected canonical CL on valid new racing edits and strict zero-EXP save16.

`pnpm sim:puzzles` passes600 campaign battles with unchanged exact kind/colour/PL/hash envelopes. Existing known
T116 balance gaps remain. `pnpm sim:spark` passes900 runs:77% clears, mean Drive60, style gap4%, paid TL1→10 median6
and p908. `pnpm sim:training -- --content=/Users/luismartinez/workspace/uma-racer/content/data` passes240 seeds per
row, foundation93/78/74% and scenario twists77–84%; only aggregate output was inspected.

Production gzip measurements below are individual chunks, not their dependency sums. DEV proof routes and invented
fixture strings are tree-shaken; Firebase and Pixi remain lazy. Startup is below180KB.

| Chunk | gzip KB |
|---|---:|
| Startup entry | 153.30 |
| Dormant preparation coordinator | 3.68 |
| Retained legacy Spark screen | 18.17 |
| Puzzle battle screen | 8.41 |
| Shared Pixi entry | 85.30 |

## Recovery and remaining gates

The [living preservation contract](../technical/uma-puzzles-implementation.md#t115-implemented-preservation-v2-d287)
records bounded transport limits, strict save16 adaptation, owner-run **synthetic whole-account** backup/restore steps
and forward recovery. Never clear app data to retry. Keep frozen pages, paid journals and receipts. An unknown terminal
Spark journal arriving after another device froze the account is not automatically refunded or paid EXP.

This proof does not establish physical finger occlusion, PWA safe-area behaviour, VoiceOver, sustained60/120Hz,
real private-content readiness or live migration correctness on the owner's account. T116 must separately verify
those release gates and backup/activation procedure. Deploying T115 alone does not invoke preparation or replace Spark.
