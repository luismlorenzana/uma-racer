# T004 — Saved-Uma Training loop (Milestone 2, part 2)

**Goal:** make Training the first fully playable, repeatable progression action. The player opens Training for an owned Uma,
sees a deterministic deal of her equipped support cards across five facilities, previews the exact capped gains, spends one
Training Ticket, and atomically persists stat/SP gains, Training EXP/levels, card EXP/levels, skill hints, ledger entries,
and sync work. Racing with the saved Uma remains T005.

Depends on: `T003-stable-save-foundation.md`. Until T003 merges, this task may be developed as a stacked branch but its PR
must not target production independently of T003.

Read first: `AGENTS.md`, `docs/design/training.md`, `docs/design/support-cards.md`,
`docs/design/skills-and-inheritance.md` through Loadout, `docs/design/economy.md`, `docs/design/ux.md` §Training,
`docs/design/scenarios.md`, `docs/design/uma-progression.md`, `docs/technical/architecture.md` §1,
`docs/decisions.md`, and T003.

## Scope and fixed choices

- This task implements the saved-Uma Training turn only. It does not add progression races, race rewards, card limit
  breaks, the Card Album, coupon redemption, a general deck editor, scenario promotion, inheritance, goals, or badges.
- Training remains the documented MVP: five facilities, no energy, mood, failure chance, random events, or scenario
  modifiers. Motion feedback is DOM-based; do not pull PixiJS into the Training route merely for particles.
- A Training turn is deterministic. Its deal and hint rolls derive from the profile creation time, Uma template id,
  scenario tier, and `trainingsThisScenario`. Reloading before a choice shows the same deal; the next committed turn shows
  the next deal. Use a small seeded PRNG in `@racer/domain`, never `Math.random`.
- T004 bridges to the later deck-building milestone with a narrow rule: when an owned Uma has an empty deck, entering
  Training persists a deterministic, type-balanced auto-deck from owned, era-eligible Speed/Stamina/Power/Guts/Wit cards.
  It fills the documented 4 / 5 / 6 unlocked slots. A nonempty deck is never silently rewritten; invalid references,
  duplicate card/character entries, locked-era cards, Friend/Group cards, or too many slots produce a useful error.
- Auto-deck priority follows the Uma's growth rates, descending with `speed → stamina → power → guts → wit` as the tie
  break. Take at most one card of each type on the first pass, then continue in the same type order while rejecting duplicate
  card characters. Candidate ids are sorted, making the result stable. The complete private tier-1 starter set must be able
  to fill all four tier-1 slots; tests use invented cards only.
- Friend/Group cards remain owned but inactive until their dedicated design task. Card event skills and raw unique effects
  remain out of scope; only `hintSkillIds` and the generated MVP effect profile participate.
- Training uses the current Training Level caps at the start of the turn. A Training Level gained by that turn moves the
  cap markers for the next deal; it does not retroactively enlarge the just-resolved gains.
- The current deal is derived, not another persisted save field. Static card/skill/template data remains only in the
  content registry. The save continues to carry ids and mutable state only, so save schema v1 does not gain reference-data
  copies.
- Extend the ledger reason vocabulary with `training`. One spend record is appended per committed turn. Card-level ticket
  rewards retain the existing `card-level` reason and get one deterministic ledger id per card and reached level.
- Keep the initial JavaScript chunk at or below 180 KB gzip. Training and its heavier view code must remain route-split.
  Add no dependency.

## Deliverables

### 1. Deterministic Training domain rules

Extend the small Training/Card domain modules, or add a focused `training-turn.ts`, with explicit types and pure functions
for deals, previews, and resolution.

#### Deck eligibility and auto-fill

- Export `deckSlotCount(tier)`: 4 at tier 1, 5 at tier 2, and 6 at tier 3+.
- A usable Training deck contains unique owned card ids, no two cards with the same `charaId`, no card with `era > tier`,
  no Friend/Group card, and no more than the unlocked slot count. It must contain at least one card to train in T004.
- Export a deterministic auto-deck helper implementing the priority in **Scope and fixed choices**. Persist an auto-deck
  before showing the first deal; do not produce a UI-only deck.

#### Generated card effects

For the current card save/template pair, calculate the documented generated effects with `cardEffectValue` and the
template's `effectProfile` weight:

- Training Bonus, Friendship Bonus, the card-type Stat Bonus, Skill Point Bonus, and Hint Frequency are active.
- Specialty chance is `35% + generated Specialty Priority percentage points`, clamped to 100%. At LB2+, multiply the
  generated specialty addition by 1.5 for the documented `+50%` unlock.
- Race Bonus and Initial Stats are not used by a Training turn. Raw LB4 unique-effect tuples stay inactive until a later
  task maps them to typed game effects.
- Finite, nonnegative growth rates, card effect weights, eras/types, and every hint/unique reference consumed by T004 must
  be validated before Training initializes. Malformed private content is a content/save error and writes nothing.

#### Deal algorithm

Process equipped cards in deck order with seeded rolls:

1. A stat-type card goes to its own facility when the specialty roll succeeds.
2. Otherwise it has a 70% chance to go to a uniformly selected facility and a 30% chance to sit out.
3. A random placement may still land on the card's own facility and counts as friendship for resolution.

The deal records one placement (`speed`, `stamina`, `power`, `guts`, `wit`, or `out`) per card. Expose enough typed data
for the UI to render card atlas frames without putting content objects in Zustand.

#### Facility previews and resolution

- Build all five previews from the existing base-gain formula, the Uma's growth rates, and cards present at each facility.
  Preview **applied** gains after the current stat/SP caps and the 1200 stat soft cap, so the number shown is the number the
  tap will add. Random hints are not part of the preview.
- A card matching the chosen facility makes that card a friendship card; any matching card makes the turn grant 54
  Training EXP instead of 36. Preserve the existing formula/pinning tests.
- Apply previewed stat/SP gains, then Training EXP, clamp TL at 10, and increment `trainingsThisScenario` exactly once.
  `trainingsThisScenario >= 1` is the derived race-unlocked signal for T005.

#### Skill hints

- Only cards present at the chosen facility roll. Per card, use `20% × (1 + generated Hint Frequency)`, doubled only when
  that card matches the facility, clamped to 100%.
- Use `hintSkillIds`; random-event `eventSkillIds` do not participate. Before LB3, exclude gold skills from that card's
  eligible hint pool. At LB3+, allow its referenced gold hints.
- On success, choose one id-sorted, currently unknown eligible skill with the seeded PRNG and add
  `{ origin: 'card', sourceId: cardId }` to the library. Process cards in deck order so two cards cannot add a duplicate in
  the same turn.
- If the card has a nonempty eligible pool but every eligible skill is already known, grant +10 SP, clamped to the same
  pre-turn SP cap. A card with no eligible hints does not roll and does not grant fallback SP.
- Return learned skill ids and fallback SP in the result so the UI can explain the outcome. T004 does not implement the
  loadout editor; newly hinted skills enter the library but are not auto-equipped.

#### Card EXP and rewards

Every equipped card gains exactly one documented bucket:

| Situation | EXP |
|---|---:|
| Sits out or is dealt elsewhere | 5 |
| Present at chosen facility | 15 |
| Present and card type matches chosen facility | 25 |

- Level through as many thresholds as the gain allows, carrying remainder. Stop at the current LB level cap with EXP
  filled no higher than `cardExpToNext(capLevel)`. A capped card keeps participating but cannot level further until the
  Cards milestone implements limit breaking.
- Each reached card level grants +2 Training Tickets, even if that puts tickets above 500. Return every reached level so
  persistence can append deterministic `card-level` ledger records.
- Level-25 coupon handling remains in the Cards/collection task because T004 cannot create LB4 cards.

### 2. Atomic local mutation and sync integration

Add focused Training persistence/runtime functions rather than putting the turn into the Zustand store.

- `ensureTrainingDeck(umaId)` validates ownership/content. If the deck is empty, persist the auto-deck and coalesced Uma
  outbox entry in one Dexie transaction, then publish the Uma update. In memory-only mode, apply the same rule in memory
  and retain the existing warning that it will not persist or sync.
- `trainUma(umaId, facility, localDay, now)` reads and parses the current profile, Uma, deck cards, and content-backed
  inputs inside the mutation path. Reject missing ownership, malformed references, an invalid/empty deck, or fewer than
  one ticket without writing anything.
- Resolve from the row's current `trainingsThisScenario`, not a stale UI preview. In one Dexie transaction:
  - spend 1 ticket and add any card-level ticket rewards to the profile;
  - write the updated Uma and every changed CardSave;
  - append `training:<umaId>:<tier>:<zero-based-turn>` with delta `-1`, reason `training`, and the supplied local day;
  - append one idempotent `card-level-tickets:<cardId>:<level>` entry per reached level with delta `+2` and reason
    `card-level`;
  - coalesce profile/Uma/card outbox entries and queue every new ledger id.
- Only publish the profile/Uma/card changes to Zustand after the transaction commits. Keep updates narrow so one card
  changing does not replace unrelated entities or reference content.
- Prevent two Training resolutions for the same Uma from running concurrently in one runtime. A rejected/failed mutation
  leaves the current deal and every counter unchanged.
- Refresh/schedule the existing background outbox after deck assignment or Training. Gameplay never awaits Cloud Run.
  Existing server-wins conflict behavior applies per profile, Uma, and card entity.
- API request validation accepts the new `training` ledger reason and remains strict about all other save shapes.

### 3. Full-screen Training UI

Add a lazy `/training/:umaId` route outside `AppShell`, following the existing full-screen race route pattern.

- Home and the Uma Profile enable **Train** for the persisted featured/selected Uma and navigate to this route. Stable
  remains tap-to-profile. Race stays honestly disabled/marked T005 even after the opening Training turn.
- Resolve the id against owned save state and content. Signed-out, loading, empty-content, content-error, save-error,
  non-persistent, unowned, invalid-deck, and no-ticket states are explicit. Non-persistent mode remains playable with its
  warning. A back action returns to the source profile (or Stable fallback) without discarding state.
- On first entry, show a compact `Preparing training…` state while an empty deck is persisted. Never flash a fake deal.
- The 390×844 layout shows:
  - safe-area-aware header with Back, Uma identity/scenario, Training Tickets, and TL/EXP progress;
  - all five stat bars plus SP with current values and cap markers;
  - five ≥44 pt facility tiles in one thumb-reachable row, each labeled by stat, showing its exact applied gain summary;
  - dealt private card atlas icons on their facilities, with a labeled/shape-visible friendship treatment; cards sitting
    out appear in a small bench row;
  - a disabled `Race · T005` action that explains the first Training has unlocked future saved-Uma races.
- Tapping a facility disables the five choices until the local transaction resolves. Animate only transform/opacity:
  press/launch, gains moving toward bars, TL cap movement, ticket change, card EXP summary, and hint chips. Respect reduced
  motion and keep the next deal available quickly. Errors keep the same deal visible with a retryable message.
- Use current save/content after every result; do not maintain a second mutable Training copy in component state. A small
  transient result object may drive feedback and then be discarded.
- Reuse `AtlasSprite` and managed Blob URLs. No GameTora/raw API URL goes into an image element or CSS.

### 4. Tests and documentation

- All fixtures are small and invented. Never copy a real Uma/card/skill name, id, effect row, image, or pack excerpt into
  git. No test makes a network request.
- Domain tests cover deck slots and deterministic type-balanced auto-fill; invalid decks; stable deal/hint seeds; specialty,
  random, and sit-out paths; exact previews; cap/soft-cap behavior; friendship Training EXP; TL10; opening-race unlock;
  skill hint addition/dedup/fallback/gold gate; all card EXP buckets; level remainder/LB cap; and +2 ticket reward events.
- Persistence/runtime tests cover atomic success; insufficient tickets and invalid deck with zero partial writes; auto-deck
  durability; exact ledger ids; mutable outbox coalescing plus append entries; reload-stable deals; memory-only resolution;
  same-Uma concurrency protection; and state publication only after commit.
- Pure web tests cover Training view-model/content joins and missing references. Do not add a component-testing dependency.
- Update `README.md` status and `docs/technical/architecture.md` with the Training mutation flow. Update the matching design
  docs and append a decision row for the temporary auto-deck/deterministic-turn policy. Do not edit old decisions.
- Do not modify `.github/workflows/`, `infra/`, `firebase.json`, environment files, or `apps/api/Dockerfile`.

## Manual verification

With the complete private local content version and `pnpm dev`:

1. Open Home, Profile, then Training for a fresh Uma. Confirm a four-card tier-1 auto-deck is persisted once and the same
   deal survives reload/back-forward navigation.
2. At 390×844, inspect all five facility previews against the selected cards and caps. Confirm no horizontal overflow,
   all choices are at least 44 pt, private atlas frames are correct, and there are no console warnings/errors.
3. Train once. Confirm tickets drop by one plus any visible card-level rewards, exact previewed gains apply, Training EXP
   advances, `trainingsThisScenario` becomes 1, the next deal appears, and Profile/Home agree after reload.
4. Repeat through at least one normal TL-up, one friendship turn, one new skill hint, and one card level-up. Confirm the
   result feedback and ledger/outbox diagnostics match.
5. Spend the last ticket and confirm all facility actions disable at zero without a negative balance. Granting tickets is
   not part of the production UI; a synthetic test or local dev inspection may cover the exact-zero edge.
6. Stop the API, complete another Training turn, reload, and confirm the mutation remains local with pending sync. Restart
   the API and confirm the queue drains without duplicating the turn, level rewards, or ledger entries.
7. Force a stale profile, Uma, and card version in local development or tests. Confirm the server copy wins each conflict
   without deleting unrelated entities or append-only Training ledger records.

## Acceptance

- A fresh tier-1 Uma gets a durable deterministic four-card deck from owned era-eligible stat cards, without exposing a
  general deck editor or activating Friend/Group cards.
- Training presents five reload-stable deals and exact capped previews. A tap spends one ticket and atomically persists the
  documented stat/SP, Training EXP/TL, opening-race count, card EXP/levels, ticket rewards, hints, ledger, and outbox work.
- Training remains fully local-first, works in memory-only mode with an honest warning, queues while offline/API-unavailable,
  and reconciles through the existing tested server-wins sync path.
- The full-screen 390×844 loop is thumb-friendly, safe-area-aware, reduced-motion compatible, uses only managed private
  atlas assets, and keeps Race/other future actions honest.
- No original-game byte or datum is added to git. `pnpm lint && pnpm test && pnpm build` pass, the PWA builds, and the
  production startup chunk stays at or below 180 KB gzip.

## Explicitly out of scope

- Progression races, saved-Uma race setup/results, Uma EXP, Uma levels, race ticket rewards, and race history (T005).
- Card Album/detail, manual deck building/presets, limit breaks, coupons, max-card fanfare, Friend/Group behavior, event
  skills, and typed LB4 unique effects (Cards & collection milestone).
- Skill loadout editing/presets, scenario promotion, inheritance, awakening, parents/snapshots, goals, badges, and titles.
- Energy, mood, failure chance, card bond, random events, scenario modifiers, sound, haptics, or new visual assets.
