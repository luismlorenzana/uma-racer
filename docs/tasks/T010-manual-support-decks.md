# T010 — Manual support decks (Milestone 4, part 2)

**Goal:** let the player deliberately build each Uma's support deck and make that saved choice drive Training, skill hints,
and Race Bonus. This replaces T004's temporary silent auto-fill bridge with a visible, validated, local-first editor and
makes card ownership/progression strategically meaningful.

Depends on: `T009-support-card-album-and-progression.md`.

Read first: `AGENTS.md`, `docs/design/support-cards.md` §§Ownership/Deck, `docs/design/training.md`,
`docs/design/uma-progression.md`, `docs/design/ux.md` §§Uma Profile/Training/Cards,
`docs/technical/architecture.md` §1, `docs/decisions.md`, T004, T005, and T009.

## Scope and fixed choices

- Decks remain per Uma as ordered `deckCardIds`; card ownership and level/LB remain account-wide. The same owned card may be
  equipped by any number of Umas, but never twice in one deck.
- Tier 1/2/3+ expose 4/5/6 slots. A saved deck may contain 1 through the unlocked slot count; empty decks are allowed only
  as an unsaved editor draft. Training and progression racing continue to require at least one valid equipped card.
- Every equipped card must be owned, present in the current private content version, a Speed/Stamina/Power/Guts/Wit card,
  have `era <= Uma tier`, and have a character not already represented in the deck. Friend/Group cards remain visible but
  disabled with an explanation. Later-era owned cards remain selectable only after their scenario arrives.
- Order is persisted and used consistently in deck display and deterministic Training deal input. Reordering therefore may
  change which card receives a colliding deterministic random placement; it never rerolls the current saved turn seed.
- “Auto fill” is an explicit editor action using the existing deterministic type-balanced algorithm and current owned,
  eligible cards. Opening Training no longer writes an empty deck automatically: it links to the editor and explains the
  requirement. Existing nonempty decks are preserved exactly.
- Saving re-reads the latest Uma, owned cards, and current content. A stale editor draft that became invalid is rejected
  without writes and remains editable. No API request is on the action path.
- Presets, cross-Uma copy, Friend/Group behavior, and card borrowing remain later additions. Do not broaden this into a
  general loadout framework.
- Keep startup at or below 180 KB gzip. The editor is lazy and uses existing UI/Motion/atlas code only.

## Deliverables

### 1. Pure deck validation and view projection

- Promote the existing deck validation into a focused reusable domain API that validates ordered ids against Uma tier,
  ownership, card content, type, era, slot count, duplicate ids, and duplicate characters. Keep Training and progression
  racing on this same validator so editor acceptance cannot disagree with gameplay.
- Return structured issue codes plus display-safe ids; existing callers may derive their current messages. Reject unsafe or
  duplicate ids before any content lookup. Keep all content/static data outside the save.
- Preserve deterministic explicit auto-fill. It returns at most the unlocked slot count, never duplicates characters, and
  excludes later-era/Friend/Group/unowned cards. It fails honestly when no eligible card exists.
- Add a pure deck view model: slots, selected cards, eligible candidates, disabled reason, generated effect summary,
  summed Race Bonus, and hint-skill counts. Missing retired content produces an explicit repair state rather than silently
  deleting a saved id.

### 2. Atomic deck mutation

- Add `setUmaDeck(umaId, orderedCardIds, now)` through the lazy action/runtime boundary. Re-read and parse the Uma and every
  selected card inside the commit, validate against current content/tier, then update only that Uma and coalesce its outbox
  row in one Dexie transaction.
- Publish the Uma to Zustand only after commit, refresh pending sync, and schedule the existing background flush. Memory-only
  mode runs identical pure validation and publishes with the existing warning. No ledger row is needed because deck edits
  do not earn or spend resources.
- Add a per-Uma deck lock so double-save cannot reorder state unpredictably. A no-op save is accepted without adding
  redundant outbox work.
- Training and race preparation must revalidate the stored deck as they do today. A conflicting server copy may replace the
  whole Uma entity under the existing server-wins rule; unrelated cards/profile/logs remain untouched.

### 3. Mobile deck editor and loop integration

- Replace the Uma Profile “Deck & Loadout” placeholder with a real deck summary and Edit action. Add a lazy nested editor
  or full-screen sheet that preserves the Profile back path and safe areas.
- Show all unlocked slots plus visibly locked future slots. Selected cards show managed art, type, level/LB, era, and a
  remove/reorder affordance with ≥44 pt targets. Candidate cards support type/era filters and deterministic sorting.
- Candidate disabled states explicitly say: later scenario, duplicate character, Friend/Group unavailable, or missing
  content. Owned cards are the only candidates; acquisition remains T011.
- Auto fill populates an editable draft. Save shows validation inline, disables while committing, handles retry without
  losing the draft, and provides reduced-motion-compatible success feedback. Cancel/back never mutates the saved deck.
- Profile, Training, and pre-race views immediately reflect the saved deck. Training with an empty deck shows an Edit deck
  CTA instead of invoking `ensureTrainingDeck`; remove the now-obsolete automatic mutation path without deleting the pure
  auto-fill helper used by the explicit button.
- Training result feedback identifies each card's EXP/level change rather than only positional totals, so manual choices are
  legible. Race Select continues to show the summed generated Race Bonus from the same deck projection.

### 4. Balance closure, tests, and documentation

- Add a synthetic-only deck/training balance harness or extend the existing simulator to measure representative weak,
  mid-level, and mature six-card stat decks without loading original data in tests. Report Training gains, time to TL10,
  hint availability, Race Bonus, and the T008 G1 player curve using a sensible strategy/loadout.
- If the aspirational 35%→65% G1 curve still misses, document the measured result and recommendation. Do not add a hidden
  player bonus or change a pinned design number unless the design doc, domain pin, and decision log are updated together.
- Domain tests cover issue codes, every eligibility rule, 4/5/6 slots, partial valid decks, order preservation, deterministic
  auto-fill, no eligible cards, and agreement between Training/racing effect summaries.
- Persistence/runtime tests cover atomic save/no-op, stale/invalid drafts with zero writes, exact outbox coalescing,
  concurrency, memory-only behavior, reload durability, and state publication after commit.
- Pure web tests cover slots/candidates/disabled reasons/filtering/effect summaries/missing references and Training's empty
  deck state. Fixtures stay invented; no network or original-game datum enters git.
- Update `README.md`, `docs/design/support-cards.md`, `docs/design/training.md`, `docs/design/ux.md`, architecture, the T008
  balance report follow-up, and append a decision row for manual decks and the retired auto-fill-on-entry bridge.

## Manual verification

With complete private content and `pnpm dev`:

1. At 390×844, edit fresh tier-1 and higher-tier Umas. Check 4/5/6 slots, filters, reorder/remove, Auto fill, safe areas,
   ≥44 pt targets, private art, reduced motion, no horizontal overflow, and no console errors.
2. Attempt later-era, duplicate-character, Friend/Group, too-many, empty, and stale/missing-content drafts. Confirm clear
   reasons, retained edits, and zero save/outbox mutation.
3. Save a valid ordered deck, reload/Profile/Training/Race, and confirm the exact order, dealt cards, generated effects,
   hint pool, and Race Bonus agree. Change it and confirm the next view uses the replacement without touching card levels.
4. Stop the API, save a deck and train with it, reload, then reconnect. Confirm both mutations remain local and sync without
   lost order, duplicate rewards, or unrelated entity changes.
5. Run and record the synthetic card/deck balance harness. Compare the documented T008 representative target and capture
   any remaining calibration caveat instead of silently tuning core Form.

## Acceptance

- Every owned Uma has a clear, durable manual deck workflow with truthful slot, ownership, era, type, and character rules.
- The one saved ordered deck is the source for Training deals/effects/hints and progression-race bonus; UI projections and
  gameplay validation agree.
- Entering Training with no deck no longer silently writes one. Explicit Auto fill remains deterministic and editable.
- Edits are atomic/local-first, work offline and in memory-only mode, sync through the existing conflict path, and cannot
  partially apply under invalid, stale, concurrent, failed, or no-op saves.
- Synthetic balance evidence is recorded. `pnpm lint && pnpm test && pnpm build` pass and startup stays ≤180 KB gzip.

## Explicitly out of scope

- Acquiring cards, spending Card Select Coupons, Uma albums/coupons, and reveal fanfares (T011).
- Friend/Group gameplay, borrowed cards, deck presets/copying, card bond/events, scenario promotion/Initial Stats, badges,
  trainer achievements, sound, haptics, or new visual assets.

## Implementation result

Implemented on `feat/manual-support-decks`. A structured domain validator now owns identity, slots, ownership, content,
era, stat-card, and character rules for the editor, Training, and racing. The local-first mutation re-reads all selected
rows, coalesces one Uma outbox entity, treats exact order as a no-op, and publishes after commit with a per-Uma runtime
lock; memory-only mode uses the same pure validation.

The Profile summary and lazy editor expose six ordered slots, current locks, private art, move/remove, filters, disabled
reasons, effects/hints/Race Bonus, and explicit deterministic Auto fill. Training's auto-write bridge is removed, empty
decks link to the editor, and result feedback names each card. Synthetic balance evidence is recorded in
[Support Deck Balance Follow-up](../research/support-deck-balance.md); the G1 aspiration remains open without hidden tuning.
