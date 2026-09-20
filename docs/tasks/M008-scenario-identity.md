# Milestone 8 — Scenario identity and deck depth

**Outcome:** a scenario stops being only a name, a stat cap, and a card era. Each one trains differently, and the last
16 support cards you can own but never use finally work.

These are the two systems the design agreed on and then deferred "after the MVP" without giving them a home: scenario
modifiers (D55) and Friend/Group cards (D54). The 2026-09-19 alignment review found both still unscheduled.

## Invariants (D109)

Modifiers are a **training-side twist**, not a second economy and not a balance rewrite:

- A modifier's resources are **tier-local**: they appear at Scenario Start, reset at promotion, are never bought with
  Training Tickets, and never convert into tickets, coupons, or shards. Tickets remain the only currency (D63).
- A modifier never raises a stat or SP **cap**, never edits Race Form, and never adds hidden race stats. It changes how
  fast you move inside the caps and how a tier feels.
- Any aptitude a modifier grants follows the pink-spark rule: **+1 grade, capped at A** (D51).
- Modifier state lives in the Uma's save behind one versioned field, is deterministic, and survives reload; a save from
  before the modifier existed reads as "no modifier state" and never blocks Training.
- Every modifier is skippable: the tier is completable while ignoring it entirely.

## Scenario modifiers

Tier 1 stays clean as the tutorial tier. The rest, in release order, extending the table in
[scenarios.md](../design/scenarios.md#scenario-modifiers):

| # | Scenario | Modifier |
|---|---|---|
| 2 | Unity Cup | **Team Spirit:** 3+ cards at one facility triggers a spirit burst that adds gains to every stat |
| 3 | Trackblazer | **Climax:** race wins in the tier grant one-shot training items that expire at promotion |
| 4 | Our Grand Concert | **Performances:** training collects notes; a full set pays a bonus across stats |
| 5 | Grand Masters | **Fragments:** fragments drop from training and a full set triggers a burst |
| 6 | Project L'Arc | **Expedition:** a completed expedition raises one aptitude grade, capped at A |
| 7 | U.A.F. Ready GO! | **Genres:** facility colors level up, and matching colors pay more |
| 8 | Great Food Festival | **Cooking:** training harvests ingredients; dishes buff the next turns |
| 9 | Run! Mecha Umamusume | **Research:** gear upgrades act as permanent facility research levels for the tier |
| 10 | The Twinkle Legends | **Legends:** pick a legend's buff path for the tier |
| 11 | Design Your Island | **Construction:** development points build facilities during the tier |
| 12 | Yukoma Hot Springs | **Soak:** relaxation builds up; a full bath makes the next training free and doubled |
| 13 | Beyond Dreams | **Shared light:** training fills a gauge that bursts into the two lowest stats |
| 14 | Tracen Diner | **Orders:** training collects orders; a served set buffs the next three turns |

Rows 2–11 are the ideas already logged in the design doc; 12–14 are new drafts. Each one gets its exact numbers, state
shape, and UI in its own task, and each must fit the invariants above.

## Friend and Group cards

11 Friend and 5 Group SSRs exist in the content packs, 2 of them are starters. T024 made all 16 equippable and active:

- They occupy an ordinary deck slot and follow the same era gating, levels, and limit breaks as stat cards.
- They have **no specialty facility**, so they never trigger friendship training the way a matching stat card does.
  They reliably attend one uniformly selected facility; their generated stat and initial-stat budgets split across all five
  stats, trading specialization for breadth.
- Values stay **generated from the source effect profile**, never copied (D54). Effect ids that the engine does not
  support stay explicitly inactive rather than silently approximated.
- Deck validation, Auto fill, the album, Trainer achievements, and the "[Type] Complete" badges must all account for the
  two extra types.

## Task outline

Numbers are provisional; each task gets a full spec when it becomes next.

| Task | Scope |
|---|---|
| T024 | Friend and Group cards: effects, deck rules, album/badge follow-through (complete) |
| T025 | Modifier framework (save shape, Scenario Start/promotion lifecycle, Training UI surface) + Unity Cup + Trackblazer |
| T026 | Grand Concert · Grand Masters · Project L'Arc |
| T027 | U.A.F. · Great Food Festival · Mecha Umamusume |
| T028 | Twinkle Legends · Design Your Island · Yukoma Hot Springs |
| T029 | Beyond Dreams · Tracen Diner |

T024 landed independently. T025 must land before any other modifier task, and each modifier
task re-runs `pnpm sim:balance` plus the deck/training harness so a tier's twist does not quietly break the pacing target
of about 25 trainings to TL10.

## Definition of done

- Every scenario tier trains differently, and the difference is visible on the Training screen and in the Journey.
- All 16 Friend/Group cards can be equipped, level, limit break, and count everywhere a stat card counts.
- No modifier changes caps, Race Form, currency, or race outcomes, and every tier is completable while ignoring its
  modifier.
- Balance harness runs are re-recorded in `docs/research/`, and the design docs plus `decisions.md` match what shipped.
