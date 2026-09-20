# T026 — Grand Concert, Grand Masters, and Project L'Arc modifiers (Milestone 8, part 3)

**Goal:** make tiers 4–6 train differently through three deterministic loops—facility coverage, a predictable burst cadence,
and player-directed aptitude growth—without adding currency, changing caps or Race Form, or blocking ordinary Training.

Depends on: T025's save-v4 modifier union/lifecycle, pure Training projection, update-safe commits, shared modifier UI, and
the existing aptitude model.

Read first: `AGENTS.md`, `docs/design/scenarios.md`, `docs/design/training.md`,
`docs/design/skills-and-inheritance.md`, `docs/design/racing.md`, `docs/technical/architecture.md`,
`docs/tasks/M008-scenario-identity.md`, and D109/D116/D117 in `docs/decisions.md`.

## Scope and fixed choices

- Extend the existing nullable scenario-modifier union with strict version-1 states for tiers 4–6. Save schema stays v4;
  no profile, API, Dexie, or cloud migration is needed. A tier-4/5/6 run already started with null remains playable and
  receives the same honest legacy notice until its next Scenario Start. Starting or promoting into those tiers creates the
  new state; promotion always replaces it.
- **Our Grand Concert · Performances:** every committed training collects its chosen facility's note. Notes are unique;
  repeated facilities do not advance the set. Collecting all **5** notes completes a Performance on that turn, clears the
  set, and adds **20 raw gain to all five stats** before rounding, soft-cap, and cap handling. It never adds SP.
- **Grand Masters · Goddess Fragments:** every committed training grants **1 fragment**. The turn collecting fragment
  **8** automatically multiplies its ordinary raw stat and SP gains by **1.50**, then resets fragments to zero. The burst
  is predictable in every facility preview and requires no toggle.
- **Project L'Arc · Expedition:** every committed training adds **1 stamp** until **5** are held. At five, Training remains
  available but progress waits. A separate explicit Training-screen completion chooses any aptitude currently below A and
  raises it by one grade, capped at A, in an atomic no-ticket Uma write; the gauge resets. If all aptitudes are A/S, a null
  completion clears the gauge and records an expedition without an upgrade. The aptitude persists after promotion and is
  visible to the existing race input; only gauge/counters expire.
- Performance and Fragment effects apply after ordinary card/growth math and before existing rounding, >1200 half-gain,
  and caps. They do not change deals, Training/card EXP, hint rolls or fallback SP, friendship, ticket cost/rewards, badge
  facts, or card coupon behavior. An effect counts when triggered even if caps make its applied gain zero.
- Modifier state is deterministic and validates exact keys and accounting: Concert holds unique canonical facility notes
  plus a nonnegative Performance count; Masters holds 0–7 fragments plus a nonnegative burst count; L'Arc holds 0–5
  stamps, nonnegative completed/upgraded counts, and `upgraded <= completed`.
- Unknown kinds/versions remain an app-update incompatibility at strict save boundaries rather than being erased or
  treated as a legacy-null run. Add no dependency or original-game content. Startup JavaScript remains ≤180 KB gzip.

## Deliverables

### 1. Domain states, definitions, and pure reducers

- Extend `scenario-modifiers.ts` with typed states, display definitions, and pinned constants for the three tiers. Keep the
  central tier initializer exhaustive for implemented tiers and null for tier 1 and tiers 7–14.
- Strictly parse each new state: exact keys, correct tier/kind/version, safe integers, canonical unique Concert notes,
  bounded fragment/stamp gauges, and valid L'Arc counter accounting. Cover malformed state and unsupported kind/version
  compatibility errors at the save/API boundaries.
- Generalize the Training modifier input/options beyond the T025-specific Climax boolean. The pure projection must return
  the transformed raw gains, next state, and a typed effect for all five implemented kinds without consuming RNG.
- Add a pure `completeExpedition` reducer that clones aptitudes, validates readiness and target eligibility, advances one
  grade using the shared grade order with an A ceiling, and returns the next state plus before/after detail. A null target
  is accepted only when no below-A category exists.

### 2. Grand Concert and Grand Masters Training integration

- Use the already-chosen facility as Concert's note; all five facility previews show whether that choice is new, repeated,
  or completes a set. On completion, preview and commit share the same +20 all-stat projection, then the committed state
  clears notes and increments Performances exactly once.
- Project Masters' next fragment for all five facilities. When seven are held, every facility previews the ×1.50 burst;
  the committed turn resets to zero and increments bursts exactly once. At all other counts, it adds one fragment without
  modifying gains.
- Carry typed effects through memory and persistent Training results. Existing Training ledger/idempotence must prevent a
  stale retry from collecting another note/fragment or triggering another bonus. No new UI option is sent for these
  automatic effects.

### 3. Project L'Arc progress and atomic completion

- Each committed L'Arc Training advances stamps once, capped at five. A ready gauge stays at five through further
  trainings and never changes gains, hints, EXP, tickets, or deterministic deals.
- Add memory and persistent completion paths plus one lazy action/runtime method. The persistent path re-reads the Uma in a
  Dexie transaction, verifies active tier 6 and a ready matching modifier, applies the pure reducer, queues the changed Uma
  once for sync, and returns the exact completion result. No profile/account row, currency, race record, or separate
  synced schema field changes.
- Reject an ineligible/stale target, non-ready state, legacy-null run, wrong tier, or second submission before mutation.
  Register the completion with the existing in-flight commit boundary so an app update cannot interrupt it.

### 4. UI and Journey surfaces

- Extend the shared pure modifier view with Concert note progress/Performance count, Masters fragment progress/burst count,
  and L'Arc stamp/completion/upgrade counts. Scenario Start and Journey show the exact static rule; completed Journeys do
  not claim archived resources.
- On Training, label new/repeated/completing Concert notes and impending Masters bursts on facility previews, then report
  the committed note/Performance or fragment/burst in the result sheet.
- Give L'Arc a compact 5-stamp gauge. At readiness, show a 44-point aptitude selector grouped by surface/distance/strategy,
  current→next grade labels, and a 44-point Complete Expedition action. Disable it while another commit runs; refresh the
  saved Uma/result copy after success and announce the exact upgrade (or all-capped completion) accessibly.
- Keep all controls usable at 390×844 with safe-area padding, no horizontal overflow, no emoji, and only transform/opacity
  animation through Motion `m.*` if animation is used.

### 5. Verification, balance, and closure

- Cover parser/state initialization/promotion replacement, Concert uniqueness/reset/caps, Masters cadence/reset/caps,
  L'Arc progress/claim/grade ceiling/all-capped path, memory/persistent parity, retry rejection, sync queue behavior,
  legacy nulls, Journey/view projections, and UI-facing labels with invented fixtures only.
- Extend the deck/training harness with tier-4 baseline/organic/forced Performance, tier-5 baseline/burst cadence, and tier-6
  baseline plus bounded expedition claims. Record deterministic results in `docs/research/support-deck-balance.md`; explain
  aptitude effects separately because the harness measures Training gains, not race selection.
- Re-run `pnpm sim:balance` to confirm tiers 4/5 gain effects and L'Arc state do not directly alter the race engine. Run
  `pnpm lint && pnpm test && pnpm build`, verify 390×844 portrait, and report startup gzip size.
- Delete this spec in the implementation PR (D104), mark T026 complete in task/milestone indexes, and leave exact rules in
  the design docs and D117.

## Manual verification

With synthetic/local content and `pnpm dev` at 390×844:

1. Start tier 4 and collect four different facility notes. Reload, confirm they persist, and compare repeated/new note
   previews. Choose the fifth facility; confirm +20 all-stat raw bonus follows caps, the set clears, and one Performance is
   reported exactly once.
2. Promote to tier 5. Confirm Concert state disappears. Train seven times, checking the fragment gauge, then confirm all
   facilities preview ×1.50. Commit the eighth turn; confirm the selected gains match preview, the gauge resets, and reload
   cannot repeat the burst.
3. Promote to tier 6. Confirm Masters state disappears. Train five times, reload, and confirm a ready expedition while
   ordinary Training remains available. Choose a below-A aptitude, complete, and verify its saved grade rises one step with
   no ticket/profile change; repeat submission must fail without a second upgrade.
4. Raise an aptitude from B to A and confirm it is no longer eligible. With a synthetic all-A/S Uma, confirm only the
   all-capped completion is accepted and no grade is reduced. Promote and confirm aptitude gains persist while expedition
   counters disappear.
5. Load active tier-4/5/6 saves whose modifier is null. Confirm Training and racing work, the legacy notice is honest, and
   neither preview nor a L'Arc completion invents state.

## Acceptance

- New tier starts create strict versioned states; legacy nulls stay playable; promotion drops every prior resource; malformed
  or unsupported states never silently become zero progress.
- Concert completes only after five distinct facility notes and applies +20 raw all-stat gain once. Masters bursts on each
  eighth committed turn at ×1.50 raw stat/SP once. Preview, memory, and persistent results agree under normal caps.
- L'Arc awards one stamp per committed training, lets a ready five-stamp expedition atomically raise one eligible aptitude
  by one grade up to A without a ticket, survives reload/retry safely, and never blocks Training.
- No modifier changes caps, Race Form, hidden race stats, currencies, unrelated rewards, or the deterministic deal; balance
  evidence and full gates are green; startup remains ≤180 KB gzip; the task spec is removed at completion.

## Explicitly out of scope

- Tiers 7–14 (T027–T029), retrofitting modifiers into already-started null runs, archiving modifier resources, aptitude
  grades above A, random fragment/stamp drops, item inventories/trading, new currency, new race rewards, badge/Trainer
  criteria, race-engine coefficients, caps, energy/mood/failure, original scenario data or art, audio/haptics, private
  content publication, and infrastructure/workflow/environment files.
