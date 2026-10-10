# Farm kitchen — T124 release acceptance

2026-10-10 · D315–D316 · source baseline `f6c4dcf` (T123/PR111). This is code-owned release work, not a private
content publish or a manual owner-account migration. [Design](../design/farm-kitchen-rework.md) and
[contract](../technical/farm-kitchen-implementation.md#10-t124-complete-release-d315) own the rules.
Only invented isolated saves/art are in checked-in tests/screenshots; exported account JSON is never committed.

## Code and CI

- **Passed locally:** `pnpm lint && pnpm test && pnpm build` after paired capability enablement.
  Six packages; domain 903, web 658, API 112, race 61, data 44, assets 36 tests: **1,814 total**.
- **Passed:** `node apps/api/scripts/sync-farm-adapter.mjs --check` (18 exact modules) and
  `node apps/api/scripts/sync-puzzle-adapter.mjs --check` (86 unchanged modules).
- No new dependencies, design numbers, global save schema, infrastructure/env/workflow edits, private content
  imports/publication or RPG/Puzzle mechanics/flags. Disabled-build tests now inject false explicitly;
  a separate release parity test pins both shipping gates true. Enabled bootstrap installs a real read-only
  preparation host without writing Farm/archive/preferences rows.
- PR CI is independently required before merge; do not infer hosted CI from local cached results.
  The release PR description carries the CI URL/result and post-merge deployment receipt.

## Synthetic integration and reset/backup

**Passed:** new `game/farm/kitchen/release.test.ts` (6) and `screens/farm/FarmKitchenRelease.test.tsx` (3),
`screens/farm/FarmKitchenProduction.test.tsx` (3), plus existing real-host 23, coordinator 11, local cutover 8,
pure cutover 32, transport 5 and API cutover 9 tests.

- Empty0,2 and35-outfit accounts prepare from absent/legacy state to30 stations, all idle worker levels1/0,
  all14 units/four old Extra builds cleared, and exact equality of every non-reset field after removing only
  the reset whitelist. One whole-account archive; repeated preparation/status never resets again.
- Offline stops before a protected request. Lost acknowledged prepare reply remains durable; reload/Retry
  finishes the original generation/archive. Source/hash/readback/storage/exportability/corrupt/future checks
  block before reset; strict fake Firestore rolls back failed bounded steps. Second devices adopt, not reset.
- Zero **new** stock after reset earns all five vegetables/milks, processing and cooking milestones, cheese,
  pure/pair/Sun meals, then buys three nodes and activates Long only. Flat vector34/14/4/4/4, other distances
  and next scenario zero. Closing/reopening Dexie after every Start retains the exact frozen job.
- Existing host tests exercise dependent offline production, rejection of descendants, lost replies/duplicate
  claim/purchase, stale second-device last-ingredient/last-meal spends, exact all30 Collect partition/retry,
  one-job Energy and no EXP/output before Claim. Thirty claims split16+14 with max106 refs and14,078 request
  bytes, unchanged16/200/256KiB limits. A deliberate debug grant pays50; none was executed on owner data.
- Retained old crop claims original stock once for0 newEXP, no recipe milestones. Canonical stat tests/race
  builder use actual race distance, exclude pending previews and lock/reject stale in-flight edits; old race
  inputs/history and card normalization240 remain unchanged.
- Browser release witness uses a separate persistent synthetic server; first reply lost by design, then
  reload/Retry returns the same cohort to active. Private export was requested through the shared application
  path; exported JSON was not checked in. Normal Home/readiness/Help never prepares or grants.
- Production direct links wait for content **and** durable save bootstrap before acquiring a host; sign-out
  drops the previous host, another ready account reacquires it, and failed bootstrap shows an actionable
  error rather than a permanent spinner. The Training adapter already inherits that readiness gate.

## Balance and regression commands

| Command | Actual result |
|---|---|
| `pnpm sim:farm` | Passed; now current kitchen envelope, not deleted plot ladder |
| `pnpm sim:farm:kitchen` | Same script as default; unchanged production hash below |
| `pnpm sim:farm:stats` | Passed;672 exact card-only checks and2,016 actual joined builds, unchanged hash |
| `pnpm sim:farm:legacy` | Passed; frozen four cadence policies,18-plot legacy envelope retained |
| `pnpm sim:careers` | Passed;3,752/3,752 plans,313 races, no unavailable/relaxed historical targets |
| `pnpm sim:balance` | Passed command;2,400 races/200 seeds per row; reports existing Front/Pace imbalance, not a new balance sign-off |
| `pnpm sim:puzzles` | Passed deterministic campaign/economy regression; no rule change |
| `pnpm sim:rpg:campaign` | Passed command; careful policies clear tested URA/Unity/L'Arc; attack-only fails as expected, unchanged RPG |
| `pnpm sim:constellation` | **Failed (known baseline):** one hard tier1 one-Stamina-card/1,400m ladder check; all14 tiers printed. Not hidden or retuned in this release |

Production SHA256 `99fc49c3909c9ccb504789c17c0f3979e0b413a95d128c9473098c7f3b7fb144`.
Stat SHA256 `965ab0db062d575ffcc864a3e2d90887691f7cb5d3fd249a4831610276f62c13`.
Policies/seeds are fixed in the scripts and [balance record](farm-kitchen-balance.md): empty stocks, explicit
two08/20, three07/15/23 or four00/06/12/18 daily check-ins; solo/five/thirty/staggered, blocks1–3, variant
fragmentation and banquet stock buffers. Full solo map87 jobs versus98 toLv50; first pioneer shared cooking
opens after16 claims (Lv9), about8 days at two/day. Farm stays20 total/node, capacity18+2/scenario; caps/waste
are real (not every gap is filled), and no Farm multiplier is applied by growth/Foundation/Shared Light.

## Browser, bundle and restart safety

**Passed synthetic browser:** [phone record/screenshots](farm-kitchen-release-proof/README.md), all five districts,
reset/recovery/export, cookbook/shopping, single-job Energy, real harvest receipt, Extra map/list/selected node
and persisted pre-race delta at390×844/375×667. All six44px actions fit; last tile840/663 respectively,
main scroll equals client735/558. Extra Speed Seed raises only Sprint1195→1200, flat20/marginal5/waste15;
other three race distances remain1195. Fixture milestones/meals are labelled, not claimed as earned production.

Local build gzip (decimal KB, Node gzip; no static entry imports): startup **154.89 KB** (`154,891` bytes ≤180 KB).
Lazy Farm screen **12.90 KB** including its guide; production adapter 1.71 KB, Home card 1.63 KB, marks 2.61 KB,
Extra adapter/screen **5.67 KB**. Catalogue is coalesced into the existing lazy domain/setup chunk **129.46 KB**,
not the startup entry; no separate guide chunk. Firebase/Pixi stay lazy. Existing PWA precaches194 entries;
Farm/Extra/Home/guide chunks are included (3,227.37 KiB total), DEV proof chunks excluded. Critical guards wrap the full confirmed
upgrade, Collect/Retry and Farm acknowledgement adoption; saved jobs survive deliberate later restart.
Focus/Close and contextual Back were exercised in DOM, but browser resizing is not installed iOS acceptance.

## Production deployment receipt

At authoring, local release acceptance is complete; hosted CI, merge and deployment are **not yet observed**.
The release PR's final description records these **after** completion, independently: CI/head SHA, actual
main merge SHA, deployment run URL, API health build/revision, hosted web Settings build ID/entry hash,
`/api/health`200, unauthenticated `/api/save`401, SPA/deep-link and asset/SW cache responses. Do not infer
deployment from merge. No credentials/content publish are needed. Without an owner authenticated session,
manifest readiness/account generation/installed-PWA checks stay pending rather than fetching raw owner data.
The preceding PR111 main run38017577330 failed an unrelated Puzzle foreign-journal DOM test; release must
pass its own fresh CI/deployment instead of claiming that preceding code reached production.

## Pending owner-only checks and exact production path

1. Refresh/restart the Home Screen app and check Settings' new build. Home→Farm→**Archive and prepare Farm**.
   Export/retain the private archive; Farm levels become1 and old Extra clears once, while cards/scenarios/CL/
   Inspiration/RPG/Puzzles/Items remain. Pending unsafe/offline preparation must show Retry/Export.
2. Inspect all five six-slot fields; assign/change an idle worker, start a raw job and close/reopen for the same
   timer. Settings' explicit Grant50 supplies Energy; spend1 on one selected job, then Claim for global Items/
   Farm EXP. Old crops, if any, claim once for0 newEXP. No debug action pays EXP or meals.
3. Normal cooking opens atLv9/16 claims (~8 days at two/day). Optional accelerated smoke: twelve Energy per
   six-hour job; sixteen jobs cost192 Energy, so four **explicit owner** Grant50 presses suffice. Keep normal
   cadence acceptance separate; the agent did not perform these grants on the account.
4. Process→cook a partial/full batch, pin a goal and inspect shared stock/ingredient variants. Training→Extra→
   correct scenario/distance→buy/activate named meal node→pre-race marginal/cap waste. Switch distance:
   that build remains independent. No CL/race-level/Inspiration requirement or second purchase per scenario.
5. Morning/evening routine, actual bottlenecks/enjoyment, second-device acknowledged jobs, physical thumb feel,
   VoiceOver/Dynamic Type/reduced motion, background/offline/reinstall and installed-PWA build/update remain
   **Pending**. No owner session/account JSON was accessed; hosted smoke cannot pass these checks.
