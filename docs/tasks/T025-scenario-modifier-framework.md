# T025 — Scenario modifier framework, Unity Cup, and Trackblazer (Milestone 8, part 2)

**Goal:** give scenario tiers a durable, deterministic training-side modifier lifecycle, then make Unity Cup and
Trackblazer the first two scenarios that play differently without changing caps, Race Form, race simulation, or the
single-currency economy.

Depends on: T012 Scenario Start/promotion, T014 Journey, T022 update-safe commits, T024 seven-type support decks, and the
existing deterministic Training and progression-race transactions.

Read first: `AGENTS.md`, `docs/design/scenarios.md`, `docs/design/training.md`, `docs/design/support-cards.md`,
`docs/design/racing.md`, `docs/technical/architecture.md`, `docs/tasks/M008-scenario-identity.md`, and
D55/D63/D109/D110/D116 in `docs/decisions.md`.

## Scope and fixed choices

- Progression save schema v4 adds exactly one nullable `scenarioModifier` field to each Uma. Non-null state is a strict
  version-1 discriminated union whose kind and tier must match the active scenario. The profile advances to schema v4 in
  the same one-way migration so cloud snapshots cannot mix profile and Uma schema versions.
- A v3 Uma migrates with `scenarioModifier: null`. No current-tier progress is invented. Training and racing remain valid;
  tiers 2–3 explain that a legacy run has no modifier, and the next Scenario Start creates the correct state.
- Tier 1 and not-yet-implemented tiers use `null`. Starting tier 2 creates Team Spirit state; starting tier 3 replaces it
  with Climax state; promotion to any other tier clears it. Leaving/reloading a review screen never initializes or mutates
  state. The atomic Scenario Start commit is the only normal initializer.
- **Unity Cup · Team Spirit:** a facility with at least **3 present support cards** shows a Spirit Burst. Choosing it adds
  **10 raw gain to each of the five stats**, including stats the facility does not normally raise. SP, Training EXP, card
  EXP, hint odds, friendship, and placement are unchanged. The fixed bonus is added after ordinary card/growth gain math
  and before normal rounding, the 1200 soft cap, and the scenario/TL cap. State records a nonnegative burst count.
- **Trackblazer · Climax:** every first-place progression-race finish that does not close the tier grants exactly **1
  Climax item**. The Training screen can explicitly arm one item; if the committed turn uses it, all ordinary raw stat and
  SP gains for the chosen facility are multiplied by **1.20** before normal rounding/soft-cap/cap handling, then one item
  is consumed. Card EXP, Training EXP, hints, placement, Race Bonus, Uma EXP, race inputs, and race results are unchanged.
- Climax state stores nonnegative `earned`, `stock`, and `used` counts and requires `stock + used = earned`. A loss, replay,
  already-recorded completion, gate-closing win, preview, failed write, reload, or unarmed training changes no item count.
  Arming is screen-local and defaults off after navigation or a commit; requesting use without stock rejects before write.
- Modifier effects are pure projections shared by previews and commits. They never raise stat/SP caps, edit aptitudes or
  Race Form, enter the race engine, grant/consume account currency, or become badge/Trainer criteria. Ordinary Training
  remains fully usable while a modifier is null, ignored, out of stock, or not triggered.
- Scenario Start success/review, Training previews/results, Trackblazer race results, and Profile Journey identify the
  modifier in plain language. Journey retains only the scenario's static modifier identity after promotion; tier-local
  state and resources are deliberately not archived.
- Add no dependency and no original-game row, identifier, effect value, or image to git. Keep startup JavaScript at or
  below 180 KB gzip.

## Deliverables

### 1. Versioned modifier domain and save migration

- Add a small pure scenario-modifier module exporting the version, kinds, constants, strict parser, tier initializer,
  display projection, Training preview/resolution helpers, and Trackblazer race-win reducer. Reject mismatched tiers,
  unknown keys/kinds/versions, unsafe counts, and invalid Climax accounting.
- Advance profile/Uma schema to v4. Preserve explicit v1/v2/v3 readers and one-way migrations; v3 migration adds only the
  null field. Update save snapshots, schema-consistency checks, conflict anti-regression, API exact-key parsers, fixtures,
  and compatibility errors without weakening old validation.
- Add a Dexie schema step that upgrades profile and every Uma atomically, retains row versions and all gameplay facts,
  queues only changed profile/Uma rows once, and leaves cards/logs/badges/preferences untouched. Cloud adoption performs
  the same v3→v4 conversion and queues preserved-version replacements.
- Pin modifier state version 1, threshold 3, +10 all-stat burst, one item per eligible win, and ×1.20 item multiplier in
  `packages/domain/src/domain.test.ts`. Never silently migrate an unknown future nested modifier version.

### 2. Scenario Start and promotion lifecycle

- `startNewUmaScenario` explicitly returns null modifier state for tier 1. `promoteScenario` initializes the destination
  tier through the central factory in the same atomic result that resets Training Level and creates the new Journey.
- Promotion replaces rather than carries state: Team Spirit counters disappear at tier 3, Climax stock/counters disappear
  at tier 4, and later unimplemented tiers start null. Retries/reconstructed success screens read the committed field and
  cannot double-initialize it.
- Scenario Start review and success surfaces name Team Spirit or Climax, summarize exact behavior, and say that resources
  expire at the next promotion. Tier 1 and null future tiers do not show an empty modifier card; a legacy null tier-2/3 run
  receives an honest unavailable-until-next-start notice on Training/Journey.

### 3. Unity Cup Training integration

- Extend facility previews with a typed modifier projection and explicit modifier-only gains. Team Spirit eligibility uses
  the already-determined present-card ids, so it consumes no RNG and Friend/Group cards count like any other present card.
- Add +10 to every stat's raw gain only for the selected 3+-card facility, then apply the existing caps and >1200 soft-cap
  path. A burst at a cap may apply zero and still counts as triggered because the player selected the eligible facility.
- Increment `bursts` exactly once in the committed Uma state. The Training screen marks eligible facilities before choice,
  explains the five-stat bonus in its modifier panel, and reports the burst/result without altering friendship styling.

### 4. Trackblazer race and Training integration

- Apply the pure win reducer after deterministic race resolution and goal evaluation but before the same Uma row is
  committed. Both memory and persistent completion paths return identical state; existing-result retries only re-read and
  never award again. The race result screen reports an earned item when one was actually added.
- Add a 44-point Training control showing Climax stock and an explicit Use/Save choice. Rebuild all five previews when the
  local choice changes. Armed previews multiply existing raw stat/SP gains by 1.20; card/hint/EXP projections stay fixed.
- Carry the use flag through lazy action/runtime/memory/persistent layers. Validate it again inside the transaction, consume
  one item in the same Uma write as gains, and return a typed result describing consumption. A stale second commit fails by
  the existing training-ledger guard without consuming another item.

### 5. UI, Journey, verification, and closure

- Add a shared pure view projection for scenario modifier name, short rule, active progress, preview/result callouts, and
  legacy-null messaging. Use it in Scenario Start, Training, race Results, and the Journey medallion/detail without
  duplicating numeric rules in components.
- Cover domain arithmetic/state/parser/migration, API mirroring, IndexedDB/cloud migration, promotion reset, deterministic
  previews, idempotent race awards, opt-in consumption, memory/persistent parity, Journey projections, and UI-facing view
  models with small invented fixtures only.
- Extend the deck/training harness with tier-2 baseline and forced/organic Team Spirit cases plus tier-3 baseline and a
  bounded number of Climax-item uses. Re-run `pnpm sim:balance` to prove race inputs/outcomes are unchanged and append the
  results to `docs/research/support-deck-balance.md`.
- Run `pnpm lint && pnpm test && pnpm build`; verify 390×844 portrait and startup bundle budget. Delete this spec in the
  implementation PR (D104), mark T025 complete in task/milestone indexes, and leave durable rules in design/architecture
  docs.

## Manual verification

With synthetic/local content and `pnpm dev` at 390×844:

1. Start a tier-2 Uma. Confirm Scenario Start previews Team Spirit, success shows it once, reload preserves zero bursts,
   and Training labels every facility with 3+ cards without changing the deterministic deal.
2. Select a burst facility. Confirm all five applied stat gains match preview/caps, SP and EXP paths are ordinary, one burst
   is reported, reload preserves count, and a retry cannot increment it twice.
3. Promote into tier 3. Confirm Team Spirit state is gone and Climax starts at zero. Win a non-gate-closing race, lose a
   race, replay the win, and reload; only the new win adds one item and the result explains it.
4. Open Training with stock. Toggle Use/Save and confirm all preview gains change by ×1.20 while the deal stays identical.
   Commit one armed turn, confirm one item is consumed and the result says so; commit unarmed with remaining stock and
   confirm it is preserved.
5. Promote out of Trackblazer with stock remaining. Confirm stock is discarded, the next tier starts null until its later
   task, Journey still names Climax without claiming archived counts, and normal Training remains available.
6. Load a migrated v3 active tier-2/3 save. Confirm all prior data survives, Training/racing work, and the modifier surface
   says the legacy run has no modifier instead of fabricating state or forcing a restart.

## Acceptance

- Save v4 and its API/Dexie/cloud migration preserve every existing fact, reject malformed/future modifier state, queue
  upgrades once, and never block a legacy active scenario merely because its modifier is null.
- Unity Cup deterministically previews/applies +10 raw gain to every stat at 3+ cards and records one burst; Trackblazer
  deterministically awards/uses one-shot ×1.20 items with atomic idempotence and no unusable gate-win reward.
- Modifiers are visible at Scenario Start, Training, Results, and Journey, yet never affect caps, aptitude, Race Form, race
  simulation, account currencies, ordinary completion, or unsupported tiers.
- Synthetic balance evidence is recorded, `pnpm sim:balance` stays race-identical, all gates pass, task spec is removed,
  and startup remains at or below 180 KB gzip.

## Explicitly out of scope

- Modifiers for tiers 4–14 (T026–T029), retroactively enabling modifiers inside an already-started v3 tier, permanent
  modifier history/awards, item trading/conversion/purchase, item variants, automatic item use, inventory caps, second
  currencies, new race rewards, aptitude/cap/Race Form/race-engine changes, energy/mood/failure, original scenario data,
  audio/haptics/new art, infrastructure/workflows/environment files, or private-content publication.
