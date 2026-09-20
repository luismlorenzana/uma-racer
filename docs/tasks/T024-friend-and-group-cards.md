# T024 — Friend and Group support cards (Milestone 8, part 1)

**Goal:** make every owned Friend and Group SSR a first-class support card: valid in decks and Auto fill, deterministic in
Training, useful through generated broad effects, visible throughout the album/deck/badge surfaces, and honest about source
effects Uma Racer does not implement.

Depends on: T004 support decks and Training, T016–T018 flair/Trainer achievements, and T033–T034 shared album/card UI.

Read first: `AGENTS.md`, `docs/design/support-cards.md`, `docs/design/training.md`,
`docs/design/collection.md` §§Card album and Trainer achievements, `docs/design/badges.md`,
`docs/tasks/M008-scenario-identity.md`, `docs/technical/architecture.md`, and D54/D103/D109/D110/D115 in
`docs/decisions.md`.

## Scope and fixed choices

- Friend and Group remain ordinary `SupportCardType` values. They occupy one unlocked ordered deck slot, obey ownership,
  era, no-duplicate-id, and no-duplicate-character rules, level through Training, limit break with tickets, grant card
  coupons at max, and contribute Race Bonus exactly like stat cards.
- They have no specialty facility. A deterministic deal places each Friend/Group card uniformly at one of the five existing
  facilities and never in `out`. Specialty Priority is inactive, and card type never equals a facility, so they cannot
  trigger friendship gain/Training EXP/card EXP or the Friendship Power badge.
- Generated Training Bonus, Skill Point Bonus, Hint Frequency, and Race Bonus work unchanged. A generated Stat Bonus is
  divided by five and added to all five stats when the card is present, before the ordinary growth/multiplier/rounding and
  cap rules. Generated Initial Stats divide by five across all stats at promotion, rounding each stat independently.
- The importer maps any stat-bonus source identity to the generic broad Stat Bonus profile for Friend/Group, and likewise
  maps any initial-stat identity to broad Initial Stats. Original values and conditions remain discarded after profile
  weighting. Unsupported base identities receive aggregate-only import diagnostics; unsupported LB4 signature identities
  are counted/labeled in card detail and never approximated.
- Auto fill keeps its first pass of stat-type coverage in Uma-growth order. It then ranks all remaining eligible cards,
  including Friend/Group, by the existing generated projection and hint breadth, with type rank and card id as stable
  tie-breaks. A thin catalog may use Friend/Group earlier; character uniqueness always wins over score.
- The shared card album, card picker/deck editor, filters, detail, comparison, effect-strength sort, ownership/era state,
  where-equipped links, and promotion action accept all seven types. Inactive specialty/friendship/signature rows say why;
  they are never advertised as usable value or selected as a headline effect.
- The Trainer catalog already derives `[Type] Complete` definitions from content. Reconciliation must prove Friend and Group
  denominators, progress, retroactive awards, and event idempotence. Existing earned achievements remain monotonic.
- No save-schema or API-schema migration is required: card type already lives in private content, deck ids are type-agnostic,
  and all progression state is already shared. Existing saves with no Friend/Group equipped are unchanged.
- Keep startup JavaScript at or below 180 KB gzip. Add no dependency and no original-game row/id/value to git.

## Deliverables

### 1. Generated effects and importer diagnostics

- Centralize source-effect mapping so the data normalizer and domain LB4 projection cannot drift. Stat cards retain their
  matching-stat-only mapping; Friend/Group map any stat/initial-stat identity into the generic broad profile.
- Preserve median-relative `0.5…1.5` profile weights and deterministic content hashes. Add synthetic normalization tests for
  Friend/Group broad mappings, shared effects, unsupported identities, aggregate diagnostics, and input-order stability.
- Extend card projection with explicit active/inactive semantics. Friend/Group specialty and friendship values project as
  inactive zero for gameplay/headlines while retaining a reason for UI; unsupported signature identity count is pure and
  derived from the already-preserved unique-effect identities.
- Pin uniform Friend/Group placement, the one-fifth spread, and inactive effects in `domain.test.ts`; update design docs and
  append D115 in the spec PR.

### 2. Deck, Training, racing, and promotion rules

- Remove the `unsupported-type` deck issue and its stale MVP copy. All deck entry points—persistent/memory saves, Training,
  progression racing, promotion, and repair diagnostics—share the same seven-type validator.
- Generalize `trainingCardEffects`, deal generation, facility previews, hint rolls, and card EXP so Friend/Group cards apply
  the fixed broad rules without unsafe casts or a fake facility. Stat-card RNG behavior and seeds remain unchanged.
- Extend the pure gain input to represent broad flat bonuses. A broad bonus can create a capped gain in a stat absent from
  the facility base row; SP remains separate and the >1200 soft-cap rule remains unchanged.
- Apply five-way Initial Stats inside the atomic promotion calculation. Promotion result details identify all affected stats;
  retries and snapshots remain unchanged. Race Bonus uses the same projected active value as deck detail.
- Auto fill is deterministic under input reordering, respects era/character/slot rules, and can return Friend/Group ids.

### 3. Album, deck editor, and Trainer follow-through

- Remove every “Friend/Group unavailable” state. Type chips/labels use `Friend` and `Group`; candidate disable reasons are
  limited to ownership, selection, era, duplicate character, capacity, or missing content.
- Card detail and comparison show broad Stat/Initial Stats semantics, inactive specialty/friendship reasons, inactive
  signature count, hints, and current/next-LB projections. Deck totals and effect-strength sorting exclude inactive values.
- Auto fill, manual selection, save/reload, Training preview/result, race bonus, where-equipped, and card promotion remain
  reachable with 44-point controls at 390×844.
- Add Trainer-catalog tests containing all seven synthetic card types. Friend/Group Complete use their own denominators,
  reconcile retroactively when already owned, emit once, and remain earned after later catalog growth.

### 4. Verification, research, and task closure

- Expand co-located domain/importer/web tests with small invented fixtures only. No tests make network requests.
- Run `pnpm sim:cards -- 300` before and after the implementation and append a T024 section to
  `docs/research/support-deck-balance.md`. Record the synthetic weak/mid/mature baseline plus Friend/Group wildcard cases;
  TL10 must remain reachable within the documented 25 ordinary turns when modifiers are ignored.
- Run `pnpm lint && pnpm test && pnpm build`; confirm the web startup chunk stays within budget.
- Delete this task spec in the implementation PR (D104). Update the milestone/task indexes and durable design docs to mark
  T024 complete. Do not modify workflows, infrastructure, Firebase/environment files, or the API Dockerfile.

## Manual verification

With synthetic/local or refreshed private content and `pnpm dev`:

1. At 390×844, filter Cards to Friend and Group, open details, compare current/next LB values, and confirm broad/inactive
   labels are understandable without exposing source numbers.
2. Equip one of each type, reload the deck, and confirm no unavailable warning. Exercise reorder/remove, duplicate-character,
   later-era, missing-content repair, Auto fill, where-equipped, and card promotion.
3. Reload the same pending Training deal and confirm identical placement. Friend/Group always appear at one facility, never
   create friendship, receive present-card EXP, spread capped gains across stats, and can roll their ordinary hints.
4. Race and promote with the deck. Confirm Race Bonus and five-way Initial Stats match the displayed projections, and that
   save retry/reload does not duplicate any reward or mutation.
5. Own the complete synthetic Friend/Group sets and reconcile Trainer state twice. Confirm the two Complete achievements
   appear once and remain earned when a later card is added to the catalog.

## Acceptance

- Every imported Friend/Group card is equippable when owned and era-eligible, participates in Auto fill/manual deck editing,
  and follows the same level/LB/coupon/race rules as the five stat types.
- Deals and gains implement the documented reliable-attendance/broad-support contract deterministically, without a fake
  facility, friendship activation, source-value copying, cap changes, or save migration.
- Album, deck, Training, promotion, racing, comparison, and Trainer achievements agree on active effects and all seven types;
  unsupported effects are explicit rather than silently approximated.
- Synthetic balance evidence is recorded, the task spec is removed on implementation merge, all quality gates pass, and
  startup remains within 180 KB gzip.

## Explicitly out of scope

- A Friend/Group-specific facility, relationship/date events, energy/mood/failure, borrowing cards, source event chains,
  original effect conditions/values, or approximations for unsupported source identities.
- Scenario modifiers or modifier save state (T025–T029), new currency/rewards, affinity, cap/Race Form/race-engine changes,
  audio/haptics/new art, infrastructure, workflow, or production-content publishing.
