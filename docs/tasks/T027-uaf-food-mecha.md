# T027 — U.A.F., Great Food Festival, and Mecha Umamusume modifiers (Milestone 8, part 4)

**Goal:** make tiers 7–9 train differently through three deterministic build-and-payoff loops—adaptive color streaks,
banked temporary dishes, and player-directed facility research—without adding currency, changing caps or Race Form, or
blocking ordinary Training.

Depends on: T025's save-v4 modifier union/lifecycle and pure Training projection, T026's atomic no-ticket modifier action
pattern and update-safe lock, and the existing five-facility Training UI.

Read first: `AGENTS.md`, `docs/design/scenarios.md`, `docs/design/training.md`,
`docs/technical/architecture.md`, `docs/tasks/M008-scenario-identity.md`, and D109/D116–D118 in
`docs/decisions.md`.

## Scope and fixed choices

- Extend the nullable scenario-modifier union with strict version-1 states for tiers 7–9. Save schema stays v4; no profile,
  API, Dexie, or cloud migration is needed. An already-active tier-7/8/9 null run remains playable with the honest legacy
  notice until its next Scenario Start. Starting or promoting into those tiers creates the new state; promotion replaces it.
- **U.A.F. · Sports Genres:** Blue, Red, and Yellow are assigned to the five facilities by
  `genres[(trainingsThisScenario + facilityIndex) mod 3]`. Every committed choice raises its displayed genre by 1, capped
  at 5, and becomes the next color to match. Matching the prior chosen genre multiplies ordinary raw stat/SP by
  `1 + 0.05 × resultingGenreLevel`, capped at ×1.25. The first turn cannot match.
- **Great Food Festival · Cooking:** every committed training harvests 1 ingredient matching its facility, capped at 3
  per facility. An explicit no-ticket action consumes 3 matching ingredients when no dish is active and starts a
  three-training ×1.20 ordinary raw stat/SP buff. Boosted turns still harvest; the duration decrements after each commit.
- **Mecha Umamusume · Research:** every committed training grants 1 research point, capped at 3. An explicit no-ticket
  action spends 3 to raise one selected facility's research level by 1, capped at 3. A facility's installed level
  multiplies that facility's ordinary raw stat/SP by `1 + 0.10 × level`, up to ×1.30, on later trainings.
- All multipliers apply after ordinary card/growth math and before existing rounding, >1200 half-gain, and caps. They do
  not change deals, Training/card EXP, hint rolls or fallback SP, friendship, ticket cost/rewards, badge facts, Race Form,
  or race simulation. A match/dish/research effect counts even if caps make its applied gain zero.
- State is deterministic and bounded. U.A.F. stores three 0–5 levels, a nullable canonical prior genre, and a nonnegative
  match count. Food stores five 0–3 ingredient counts, 0–3 dish turns, and a nonnegative cooked count. Mecha stores 0–3
  points and five 0–3 facility levels. Exact keys and tier/kind/version must validate strictly.
- A full Food ingredient stack, ready Mecha gauge, or all-max Mecha state never blocks Training. Food forbids cooking over
  an active dish. Mecha offers no upgrade when all facilities are level 3; its ready gauge may remain full harmlessly.
- Unknown kinds/versions remain an app-update incompatibility at strict save boundaries. Add no dependency or
  original-game content. Startup JavaScript remains ≤180 KB gzip.

## Deliverables

### 1. Domain states, definitions, and pure reducers

- Extend `scenario-modifiers.ts` with typed states, display definitions, and pinned constants for tiers 7–9. Make the
  central tier initializer exhaustive through tier 9 and null for tier 1 and tiers 10–14.
- Add canonical genre/facility records and strict parsers for every new bound. Preserve the unsupported-kind/version
  app-update boundary in the domain and API mirror.
- Extend pure Training projection with the pre-turn training index needed for U.A.F. labels. Return typed effects and next
  state for genre/level/match, ingredient/harvest/dish duration, and points/facility level without consuming RNG.
- Add pure `cookFestivalDish` and `installMechaUpgrade` reducers. They must validate readiness/selection, clone state,
  consume exactly one ready gauge, and return before/after detail without touching tickets or unrelated Uma fields.

### 2. U.A.F. Training integration

- Derive all five preview colors from the same pre-turn index and canonical facility order. Show resulting level, whether
  the choice matches, and its exact multiplier; previewing never changes the prior color or levels.
- On commit, level the chosen genre once, apply the match multiplier once, replace the prior genre, and increment matches
  only when the prior genre matched. Memory/persistent results and retries must not double-level or double-count.
- Keep labels textual as well as colored so the interaction does not rely on color perception. The deterministic rotation
  must remain stable across reload and independent of the support-card deal.

### 3. Food harvest and atomic cooking

- Every committed Training harvests the chosen facility ingredient after applying/decrementing any active dish. At the
  ingredient cap, report no harvest rather than overflowing. Preview shows whether the current turn is boosted and what
  the post-commit duration/ingredient count will be.
- Add memory and persistent cooking paths plus one lazy action/runtime method. The persistent path re-reads the Uma in a
  Dexie transaction, verifies active tier 8, a matching modifier, no active dish, and a selected stack of 3, then consumes
  it, starts 3 turns, queues the changed Uma once for sync, and returns the exact result. It writes no profile, ledger,
  currency, race, or separate schema row.
- Reject stale/insufficient ingredients, an active dish, a legacy-null run, wrong tier, or a retry before mutation. Share
  the existing per-Uma Training/modifier lock and in-flight update boundary.

### 4. Mecha research and atomic upgrades

- Apply only the selected facility's already-installed research multiplier, then grant one point after the committed turn
  up to the held cap. A newly installed level affects previews and commits beginning with the following Training.
- Add memory and persistent upgrade paths plus one lazy action/runtime method. At 3 points, select any facility below
  level 3, atomically reset points to zero, increment that level, queue the Uma once, and return exact before/after detail.
- Reject a stale/non-ready/maxed target, all-max state, legacy-null run, wrong tier, or retry before mutation. Keep ordinary
  Training available at a ready or all-max gauge and write no account/profile/ledger row.

### 5. UI, Journey, verification, and closure

- Extend the shared modifier view so Scenario Start and Journey describe all three rules, active Journey shows bounded
  progress/counters, and completed Journey says resources expired rather than pretending to archive them.
- On Training, give U.A.F. facilities textual Blue/Red/Yellow level and MATCH labels; show Food pantry stacks, dish turns,
  eligible 44-point dish selection/action, boosted previews, and commit feedback; show Mecha's 3-point gauge, facility
  levels, eligible 44-point upgrade selection/action, multipliers, and commit feedback. Announce action results accessibly.
- Keep controls usable at 390×844 with safe-area padding, no horizontal overflow, no emoji, and only transform/opacity
  animation through Motion `m.*` if animation is used.
- Cover strict parsing/state initialization/promotion replacement, deterministic U.A.F. rotation/level cap/matches,
  Food harvest/cap/cook/duration, Mecha point/upgrade/level caps, memory/persistent parity, stale retry rejection, sync
  rows, legacy nulls, view labels, and cap handling with invented fixtures only.
- Extend the deck/training harness with tier-7/8/9 baseline and active cases, including automatic valid cooking/upgrading.
  Record deterministic evidence in `docs/research/support-deck-balance.md`; re-run `pnpm sim:balance` to prove the race
  engine is unchanged.
- Run `pnpm lint && pnpm test && pnpm build`, verify 390×844 portrait, and report startup gzip size. Delete this spec in
  the implementation PR (D104), mark T027 complete, and leave exact rules in design docs and D118.

## Manual verification

With synthetic/local content and `pnpm dev` at 390×844:

1. Start tier 7. Confirm all five facilities have deterministic textual genres. Train once, reload, and choose a facility
   whose new color matches the prior one; confirm its resulting genre level and multiplier match preview. Reach level 5
   and confirm the multiplier never exceeds ×1.25. Promote and confirm U.A.F. state disappears.
2. In tier 8, train one facility three times and confirm its pantry stack persists at 3 while Training stays available.
   Cook its dish, confirm no ticket/profile change, and verify exactly the next three committed trainings preview and
   receive ×1.20 while harvesting; reload and a retry cannot extend the duration or cook twice.
3. In tier 9, fill three research points, install one facility level, and confirm only later trainings at that facility
   receive ×1.10. Repeat to levels 2 and 3, checking ×1.20/×1.30 and target removal at max. A full gauge never blocks
   Training, including a synthetic all-level-3 state.
4. Exercise insufficient/stale/wrong-tier actions and verify no partial Uma/outbox/profile/ledger writes. Promote after a
   ready Food/Mecha gauge and confirm every tier-local resource expires.
5. Load active tier-7/8/9 saves whose modifier is null. Confirm Training and racing work, the legacy notice is honest, and
   previews/actions never invent state.

## Acceptance

- New tier starts create strict versioned states; legacy nulls stay playable; promotion replaces prior resources;
  malformed or unsupported state never silently becomes zero progress.
- U.A.F. rotation is deterministic and match previews/commits agree through level 5/×1.25. Food harvests bounded stacks
  and one atomic cook produces exactly three ×1.20 committed turns. Mecha spends one ready three-point gauge on one
  selected level and applies only installed ×1.10–1.30 facility multipliers to later turns.
- Every standalone action is ticket-free, update-safe, retry-safe, and limited to the Uma plus one sync outbox update. No
  modifier changes caps, Race Form, hidden race stats, account currency, unrelated rewards, or deterministic deals.
- Balance evidence and full gates are green; startup stays ≤180 KB gzip; mobile UI is accessible; the spec is removed at
  completion.

## Explicitly out of scope

- Tiers 10–14 (T028–T029), retrofitting modifiers into active null runs, archived resource history, random genre/ingredient/
  point drops, simultaneous or queued Food dishes, Mecha levels above 3, new currencies/rewards, badge/Trainer criteria,
  race-engine coefficients, caps, energy/mood/failure, original scenario data/art, audio/haptics, private content
  publication, and infrastructure/workflow/environment files.
