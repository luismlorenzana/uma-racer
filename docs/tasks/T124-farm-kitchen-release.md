# T124 — Complete Farm release, guarded reset and production acceptance

**M031 final task · T118–T123 merged.** Read AGENTS/README/index, [M031](M031-farm-kitchen-rework.md), complete
[design](../design/farm-kitchen-rework.md) and [technical contract](../technical/farm-kitchen-implementation.md),
actual balance/cutover/phone proof records and [release runbook](../technical/infrastructure.md#release-runbook).
Start latest main in a managed worktree; one release branch/PR. This spec defines the future implementation/
release task; authoring this file does not enable flags or authorize a manual owner-account mutation now.

## Release outcome

The **deployed** Home Screen app opens the complete real-host Farm/cooking loop and meal-funded Extra Stats.
Existing accounts receive the protected one-time Farm/Extra reset with private recovery export; other progress
is preserved. API/client/installed-PWA identity and ongoing canonical sync are visible. Do not stop at a local
preview or ask the owner to test a dormant feature unavailable in production.

## 1. Integrated acceptance before enabling

Run through actual code, not a screen test double, with an isolated invented account:

1. Empty/legacy account→whole-account archive→prepare/interrupted resume→active schema 3. Verify all 30 spots,
   idle outfitLv 1/0 and all old scenario-distance Extra empty, complete non-reset whitelist equality.
2. Assign persistent crew→raw→process→partial/full meals→global inventory→buy one pure/dual/Sun→activate a
   selected scenario/distance→pre-race derived stats change. Another distance/scenario/outfit stays unaffected;
   block 1 boughts available across 1–5; block 2 starts unbought and uses its own foods.
3. Refresh/background/offline at Start, Ready, Claim, Energy, Purchase and activation; original job/deadline/
   input/intent persists. Lose replies then retry; negative/duplicated/free stock or EXP is impossible. Same-
   device dependent pipeline settles in order; stale second-device spends reject/recover honestly.
4. 30 stations ready→Collect all split by actual refs/bytes/counts, partial failure/retry without repeat rewards.
   Kitchens supplied with the typical mix versus banquet bursts; new specialists do not require raw rotation
   once shared recipes open. Readiness/guide never calls a mutation.
5. Grant 50 Energy and spend 1 on just one worker; all others' deadlines unchanged, no output/XP until Claim.
   Old global time-shift absent from active UI. Legacy old job claims original crop once for 0 newEXP.
6. All 14 scenario ingredient rows/5 stat lanes visible with raw gates and legal same-block substitutions. No
   placeholders for missing food definitions; original SVG food/meal names match stored actual Item IDs.
7. All four distance builds, current card normalization/global stars/presets and race defaults retain their
   rules. New races use acknowledged proper-distance Farm stats, old races/replays/history unchanged. No
   accidental Inspiration/RPG/Puzzle reset, debt change, card/outfit deletion or lost backup.

Re-run the small deterministic production/stat matrices on **real T123 joins**. Compare pinned envelopes,
variant stock fragmentation, smaller crews/30 specialists, blocks 1–3, partial batch rounding and low/mid/max decks.
Keep 20 total/node and current caps unless evidence supports a documented owner-scope tuning change. A directional
stat target not reached is reported honestly; do not add thousand-point Farm gains or nerf cards to make it fit.
Any changed number updates design, `domain.test.ts`, sim envelope and a new decision in this PR.

## 2. Code entry and compatibility

- Enable matching **code-owned** API/web Farm rework capabilities only after the acceptance above passes.
  No env/workflow/infra/Dockerfile/Firebase changes. Do not change RPG/Puzzle release flags.
- Home's Farm card uses actual new-generation ready/assigned/next-finish counts and opens `/farm` directly;
  no aggregate/next-plot copy. A legacy account needing upgrade shows safe preparation/recovery, not fake
  zero-progress success. Offline unresolved preparation is deferred with Retry/Export, preserving local intent.
- `/farm`, old Section/crop routes, global Items, Training Extra links/Profile/pre-race and Settings diagnostics
  dispatch by active generation/version. Release selection must not fall back to v2 after reset. Fully installed
  code performs only the user-requested Farm/Extra reset and reveals exactly what changed/export location.
- Keep legacy parsers/history/replay/claim paths required for old stock/jobs. New clients accept old rollout
  reads; old clients cannot write v2/Farm crops/retired Extra over active accounts. Unsupported/future/corrupt
  generations remain visible recovery. Do not force all economic queues through whole-save overwrites.
- Update Settings/app restart guards for new command/upgrade commits; a service-worker update cannot interrupt
  a destructive step or lose an unknown economic acknowledgement. Durable jobs restore after a deliberate
  restart; offline installed assets are already available before committing to a new screen path.

## 3. Full verification and screenshots

Required: `pnpm lint && pnpm test && pnpm build`, `sim:farm:kitchen`, `sim:farm:stats`, `sim:constellation`,
`sim:careers`, relevant race-balance, `sim:puzzles`, `sim:rpg:campaign` and existing legacy Farm fixtures.
Transition `sim:farm`'s live progression/envelope to the new model deliberately; retain frozen legacy tests,
do not leave a default command promising the deleted plot-expansion ladder. State exact commands/seeds/policies.

Measure startup JS ≤ 180 KB **gzip**, report Farm/Extra/catalogue/guide chunk sizes, lazy imports and no new external
dependencies/art. Verify 390 × 844 and 375 × 667 screenshots for all districts, cookbook/shopping, Energy, real
receipt, reset/recovery export and Extra map/list/selected-build/pre-race delta. Maintain isolated synthetic
proofs and no original-game art/owner rows in git. Clear focus/back/VoiceOver/reduced-motion/safe-area checks.

Create `docs/research/farm-kitchen-release-acceptance.md` with separate code/CI, synthetic integration, reset/
backup, balance, browser/bundle, production deployment and pending owner-device sections. A checkbox is only
Passed when its actual command/observation exists; no inherited success claims or placeholders marked complete.

## 4. PR, merge and actual deployment

Open a release PR with scope/reset whitelist, arithmetic versus measured results, commands, startup/chunks,
screenshots and remaining owner-only checks. The owner implementation request supplies the normal branch/PR
workflow; never push main directly. Ensure latest main/rebase, CI all green and no unrelated Claude changes
overwritten. Merge through the approved PR flow, then watch the existing deployment run to completion.

Use `gh run view/watch` and existing deployment evidence; do not use GitHub UI randomly or obtain cloud
credentials. Verify production `/api/health`, unauthenticated `/api/save`401 and hosted SPA/cache behaviour.
Record API/web commit/build IDs/run URL independently. There is no new private content publish: foods/icons
are code-owned and verified Uma art already exists. Check existing manifest availability without importing or
republishing unrelated RPG/Puzzle art/rosters.

If an authenticated owner session is available within task scope, inspect aggregate readiness/build/upgrade
state only, never export/read raw owner save for checked-in evidence. A live migration must run through the
guarded application path and its archive, **not** curl/manual JSON/item grants to manufacture a demonstration.
Without that session, report production code/smoke Passed and owner migration/PWA checks Pending; do not pretend
to have tested the account or withhold a completed authorized release merely for an inaccessible device check.

Confirm installed PWA build/update separately when possible. Deployment failure leaves evidence and uses a
compatible forward fix/maintenance state; after generation activation do not roll back to a pre-v3 writer,
wipe IndexedDB, delete control/evidence or auto-restore an archive. Keep recovery/Retry visible and explain
remaining blocker accurately. No destructive manual production repair is bundled into this task.

## 5. Owner protocol after production availability

Give the owner a short exact path with expected outcomes, no DEV setup:

- Refresh/restart into the new Settings build; Home→Farm and recovery/export notification. Confirm Farm levels
  and old Extra reset once, while cards/scenarios/CL/Inspiration/RPG/Puzzles and inventory remain.
- Check all six tiles in each district without scroll; assign/change an idle outfit, confirm persistent crew.
- Start raw job, close/reopen and verify exact timer; use granted debug Energy on **one** selected job; collect
  and confirm global Items/Farm EXP. Claim a retained old crop if present and check 0 new Farm EXP.
- When shared recipes open, process→cook a chosen partial/full batch; pin a meal and use the shopping plan.
  Confirm recipes/stat lanes/scenario flavours and no missing-content screens.
- Training→Extra for a real scenario/distance: buy named node with meal, toggle, switch distances and pre-race
  check correct stat delta/cap waste. No race level/CL/Inspiration requirement or hidden double purchase.
- Repeat a normal morning/evening routine and report elapsed/idle/bottleneck enjoyment; optional second device
  sees the same acknowledged jobs and cannot pay twice. VoiceOver/text-size/thumb/PWA background checks too.

Normal cooking opens at personal Lv 9/shared milestone: sixteen claims, about eight days at two/day for the
first pioneer. Do not hide that behind a fake unlocked recipe. For an optional accelerated device smoke test,
each six-hour job needs twelve Energy to finish immediately; four explicit Grant 50 presses supply the first
sixteen raw claims (192 Energy). Explain the actual cost and keep a separate normal-paced acceptance record;
debug actions accelerate deadlines only, never grant EXP/meals or auto-claim. Do not execute owner grants yourself.

Record responses later as owner evidence, not inferred from screenshots. The implementation/deployment task
may close with these checks explicitly pending; full physical-device acceptance cannot be called Passed.

## Documentation closeout and non-goals

At release replace old **live** descriptions in Farm/Constellations/architecture/minigame-kit/README with the
implemented system and formulas, retain historical version sections/recovery notes, and update technical
contract/release evidence. Append decision and completed rows/last-spec commit in task index. Delete this spec
and M031 in the same PR under D104; remove/replace links to every already-completed task spec.

No unrelated modes, race engine/caps, private content import/publication, dependency, infrastructure, old
account gifts/repair, generic docs sweep or changes outside the exact Farm/Extra reset scope.
