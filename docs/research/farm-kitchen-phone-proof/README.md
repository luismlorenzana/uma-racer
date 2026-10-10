# Farm kitchen phone proof — T122 / D313

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
