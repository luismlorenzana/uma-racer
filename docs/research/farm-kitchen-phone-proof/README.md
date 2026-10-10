# Farm kitchen phone proof — T122–T123 / D313–D314

2026-10-09. This is an isolated DEV browser proof, **not owner-account or physical-iPhone acceptance**. Every
outfit name, portrait placeholder, stock row, milestone and job is invented. No sign-in, account provider,
production API, owner save or private art starts. The screens use the real `PersistentFarmKitchenHost`, Dexie
tables, semantic resolver and shared production components.

## Reproduce

Run the web dev server and open `/dev/farm-kitchen-proof`. The session receives one unique
`farm-kitchen-proof-*` database, twelve invented outfit workers, one Ready Garden job, one running Orchard job,
idle Barnyard/Workshop/Kitchen workers, Block1 recipe milestones, representative raw/processed/meal stock and
12 Energy. Reload retains the same assignments and jobs. **Advance 6h** changes only the injected proof clock;
**Grant 50 Energy** exercises the owner-debug host command in this isolated database. The route and fixture are
excluded from production boot and never install a test double.

## Browser checks

The synthetic screenshots below cover both required viewport sizes. Files with `-375.jpg` show the smaller phone.

| View | 390 × 844 | 375 × 667 |
|---|---|---|
| Hub | [image](farm-hub-390.jpg) | [image](farm-hub-375.jpg) |
| Garden | [image](farm-garden-390.jpg) | [image](farm-garden-375.jpg) |
| Orchard | [image](farm-orchard-390.jpg) | [image](farm-orchard-375.jpg) |
| Barnyard | [image](farm-barn-390.jpg) | [image](farm-barn-375.jpg) |
| Workshop | [image](farm-workshop-390.jpg) | [image](farm-workshop-375.jpg) |
| Kitchen | [image](farm-kitchen-390.jpg) | [image](farm-kitchen-375.jpg) |
| Crew | [image](farm-crew-390.jpg) | [image](farm-crew-375.jpg) |
| Worker picker | [image](farm-picker-390.jpg) | [image](farm-picker-375.jpg) |
| Recipe and substitutions | [image](farm-recipe-390.jpg) | [image](farm-recipe-375.jpg) |
| Cookbook | [image](farm-recipes-390.jpg) | [image](farm-recipes-375.jpg) |
| Wishlist | [image](farm-wishlist-390.jpg) | [image](farm-wishlist-375.jpg) |
| Items | [image](farm-items-390.jpg) | [image](farm-items-375.jpg) |
| Claim | [image](farm-claim-390.jpg) | [image](farm-claim-375.jpg) |
| Energy | [image](farm-energy-390.jpg) | [image](farm-energy-375.jpg) |
| Guide | [image](farm-guide-390.jpg) | [image](farm-guide-375.jpg) |

At **390×844**, a district's `main` measured735 px client and735 px scroll height. Six cards occupied y173–840,
with six44 px actions. At **375×667**, `main` measured558/558 px; cards occupied
y173–663 and retained six44 px actions. Body width equalled the viewport and the normal district had no page
scroll. Worker, recipe, Energy and guide sheets scroll internally. Increased system text is allowed to use that
accessible sheet/page fallback rather than clip the controls.

The live pass covered Hub summaries, all five 2×3 districts, Working/Available picker, explicit idle-worker Move,
busy/ready lock, processing and meal recipe sheets, batch1–4, exact substitutions/stock and disabled reasons,
Cookbook/Wishlist, stage/block/stat Item facets, compact density, Legacy Produce, claim result, per-job Energy and
all seven guide pages. There were no native selects. Truncated names retained accessible labels or full-title text;
state always paired colour with text/icon. The normal production kitchen route remained capability-off throughout.

## Persistent/economic checks

The real-Dexie integration test performs assign → start → reload → injected six-hour advance → claim. It verifies
the same frozen job survives reload, output credits once,12 EXP reaches the selected outfit and the immutable receipt
retains the exact output/job identity. Pure presentation tests cover Farm-level/name/id sorting, legal same-block
substitution order, max/partial batches without shrinking, actionable worker/milestone/stock gates, one-pass stock
allocation across three wishlist slots, pending versus spendable stock, ready station output and rounded six-unit
raw-job needs. Source checks keep production runtime imports out of the proof, forbid native selects/direct DB writes
and bind guide copy to imported rule constants.

Still pending: owner physical-iPhone/PWA feel, VoiceOver and large-text acceptance, real private portrait appearance,
second-device observation and the T124 production cutover. T122 changes no Farm economics, Extra/race stats, release
flag, owner save, private content, API schema, dependency or infrastructure.

Rebased verification: lint, all tests (serial workspace run) and build pass. An existing race wall-time assertion
failed under parallel workspace load (338 ms against 250 ms); the unchanged race suite passes when run serially.
Startup is 154.62 KB gzip with the committed capability off. A temporary local flag-on build passes at 154.65 KB
startup and 14.60 KB gzip for the lazy Farm screen (including guide/marks); the release flag was restored to false.
Both new Farm simulations and the legacy Farm simulation pass with the existing regression hashes.

## T123 Extra map and race proof

2026-10-09, same isolated real-host protocol, never an owner account. The latest proof fixture is a unique
`farm-kitchen-proof-*` database per tab/session, with invented Aster and twelve workers, four invented races
and one invented support card. Open `/dev/farm-kitchen-proof/extra`; no real art/network content is used.
The proof uses the production `FarmExtraStatsScreen` and actual `buildPreparedRace` for all four distances.
Starting stock is injected, not described as earned. **DEV only · prepare full-map/capacity witness** additionally
injects synthetic meals and applies the pure semantic buy/set-active resolver to reach65 bought/18 Sprint
actives for the full-capacity screen. This is explicitly fixture authoring, not earned gameplay or a host
purchase demonstration, and it never alters another database.
Separate real-Dexie integration tests earn meals from raw→process→cook before purchasing and racing.

| View | 390 × 844 | 375 × 667 |
|---|---|---|
| Five-cluster map | [image](farm-extra-map-390.jpg) | [image](farm-extra-map-375.jpg) |
| Accessible list/search | [image](farm-extra-list-390.jpg) | [image](farm-extra-list-375.jpg) |
| Pure node purchase | [image](farm-extra-pure-390.jpg) | [image](farm-extra-pure-375.jpg) |
| Acknowledged purchase / real race deltas | [image](farm-extra-acknowledged-390.jpg) | [image](farm-extra-acknowledged-375.jpg) |
| Pair / insufficient stock / +0 cap gain | [image](farm-extra-pair-390.jpg) | [image](farm-extra-pair-375.jpg) |
| Sun / missing meal | [image](farm-extra-sun-390.jpg) | [image](farm-extra-sun-375.jpg) |
| Matching recipe and contextual return | [image](farm-extra-recipe-390.jpg) | [image](farm-extra-recipe-375.jpg) |
| Full shared map / Sprint capacity | [image](farm-extra-full-390.jpg) | [image](farm-extra-full-375.jpg) |
| Capacity-full Sun detail | [image](farm-extra-capacity-390.jpg) | [image](farm-extra-capacity-375.jpg) |
| Active node / free off | [image](farm-extra-active-390.jpg) | [image](farm-extra-active-375.jpg) |
| Bought idle / free on / +0 gain | [image](farm-extra-off-390.jpg) | [image](farm-extra-off-375.jpg) |
| Independent Mile | [image](farm-extra-mile-390.jpg) | [image](farm-extra-mile-375.jpg) |
| Independent Medium | [image](farm-extra-medium-390.jpg) | [image](farm-extra-medium-375.jpg) |
| Independent Long | [image](farm-extra-long-390.jpg) | [image](farm-extra-long-375.jpg) |

Browser observations:

- A real one-meal Speed Seed purchase acknowledges by its actual name: Sprint Speed1195→1200, Farm20,
  marginal5/waste15. Mile/Medium/Long stay1195. Reload retains the acknowledged build and stock debit.
- An unbought pair with zero Trail Bento stock disables Buy and shows Speed+0/Stamina+10; the Sun similarly
  shows its exact five-stat vector and matching missing meal. Recipe navigation retains outfit/distance/block
  return context and does not reassign a worker or featured Uma.
- The full-map witness has65 bought, Sprint18/18, flat360, marginal165/waste195. Other distances have zero
  actives and their own base/card values. Turning Speed Seed off acknowledges17/18 and leaves capped Speed1200;
  its subsequent detail honestly offers +0 with20 waste, rather than promising an unavailable gain.
- Map, list, filters, search and both sheets fit portrait width. DOM measurements gave body width390/375
  equal to the viewport; all visible buttons/links are at least44 px high. Checkboxes use44 px labels. The map
  scrolls normally and dialogs scroll internally. Labels include full node names and Bought/Active text.
- The labelled modal reports `aria-modal=true`, focuses Close, wraps Shift+Tab to the last enabled action,
  closes on Escape and restores the originating node's focus. It reuses the existing modal focus contract.
  Opening motion uses `m.*` and only transform/opacity; BottomSheet's existing reduced-motion branch removes
  travel. System reduced-motion, VoiceOver and large-text behaviour still need the owner-device pass.

Verification: lint, all1,801 workspace tests (serial Turbo run) and production build pass. The committed gate-off
startup entry is **154.82 KB gzip** and lazy Extra production screen **7.63 KB gzip**. The new Farm screen is
tree-shaken out while the capability is off; T122's prior isolated gate-on measurement was14.60 KB gzip, not a
fresh T123 measurement. A temporary gate-on build was blocked by the safety review as a possible local cutover
activation; no flag was changed. Fresh gate-on Farm/chunk measurement remains for authorized T124 release.

`sim:farm`, `sim:farm:kitchen`, `sim:farm:stats`, `sim:careers`, `sim:balance`, `sim:puzzles` and
`sim:rpg:campaign` pass. The live joined stat matrix retains672 exact card-only checks/2,016 builds and SHA-256
`965ab0db062d575ffcc864a3e2d90887691f7cb5d3fd249a4831610276f62c13`; its measured cap waste is0–30 across
the declared decks, not a promise of universal max stats. Cardless builds still have large weak-stat gaps.
`sim:constellation` exits1 at the already documented tier1 one-Stamina-card/1,400m hard ladder check; every
old-path value is unchanged and no unrelated card/race/cap tuning is included. This exception is reported,
not called a passing sim.

Pending: physical iPhone/PWA/tactile, VoiceOver/large text, real private portrait, release-generation/account
cutover and second-device production acceptance. Both web/API gates remain false; T123 executes no owner reset.
