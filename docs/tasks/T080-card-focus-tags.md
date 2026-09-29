# T080 — Card focus: running style and distance

**Goal:** beside its stat type, every support card carries a **running-style focus** (Front, Pace, Late, End or
Generalist) and a **distance focus** (Sprint, Mile, Medium, Long or Generalist), derived from its skills and corrected
by hand where the rule misreads a card (D201). The album filters by them and the card page shows them, and T081 builds
achievements on them.

No dependency: this runs beside T078. Read [M024](M024-card-training-loop.md) (the measured focus table), D107, D114,
D201, [Support Cards](../design/support-cards.md) and [Collection — shared browsing chrome](../design/collection.md#shared-browsing-chrome).
Branch from current `main`; open a PR; never push to `main`. Private content stays out of git: fixtures are synthetic,
and the PR reports aggregate counts only.

## The rule (fixed, D201)

- A card's skills are its distinct hint and event skills found in the skills pack (whites and golds, the card's own gold
  included).
- A skill is **restricted to a style** when every activation alternative of every condition names that style
  (`running_style==1..4` → Front, Pace, Late, End); an alternative is a `@`-separated branch of `condition`, read with
  its `precondition`. The same reading with `distance_type==1..4` gives Sprint, Mile, Medium, Long. A skill with no such
  term, or with one branch that lacks it, restricts nothing.
- The card's **style focus** is the style its restricted skills name most, when that count is **at least 2 and at least
  30%** of the card's skills; otherwise, or on a tie for the most, **Generalist**. The distance focus reads the same.
- Measured on today's pack (M024): 151 cards get a style, 134 a distance, 52 both, 79 neither.

## Implementation contract

- `packages/domain/src/card-focus.ts`: `cardFocus(template, skillsById): { style: Strategy | 'generalist'; distance:
  DistanceCategory | 'generalist' }`, pure, deterministic and exported, beside `CARD_FOCUS_MIN_SKILLS = 2` and
  `CARD_FOCUS_MIN_SHARE = 0.3` (pinned in `domain.test.ts`). Reuse the condition vocabulary in `race-skills.ts` rather
  than a second parser.
- **Authored overrides:** a private, gitignored `content/overrides/card-focus.json` maps a card id to `{ style?, distance?,
  note }`. `pnpm data:import` validates it (known ids, known values, a note on every entry) and writes an optional
  `focus` field onto those card templates in the cards pack; `SupportCardTemplate` gains `focus?`. `cardFocus` returns an
  override's value for the dimension it names and the rule's for the other. A pack without the field keeps working.
- **Claude authors the overrides** (as with `flair.json`, D107): reviews all derived tags in a private report under
  `content/review/`, overrides where the rule misreads a card (a signature gold for one distance under generic whites, a
  tie that has an obvious answer), and publishes the pack. Code first, then the pack (D114). Ask Claude for any change
  to an authored tag.

## Presentation

- **Card page:** two chips under the stat split: the style (its strategy label or "Generalist") and the distance.
- **Cards album:** two facets, **Running style** and **Distance** (each with Generalist), grouped under Card, counted
  and removable like every facet; the album detail shows both chips. The Uma card-set picker, which uses the same
  album engine, gets the facets for free, so picking cards for a Late, Long Uma is two taps.
- Tiles do not grow: the facets and detail carry the information.

## Docs and decision

Add a **Card focus** section to [Support Cards](../design/support-cards.md) (the rule, the override file, what it is for)
and the two facets to [Collection](../design/collection.md#shared-browsing-chrome). D201 carries the rule.

## Tests

- Synthetic cards: 3 Late-only skills of 8 → Late; 2 of 10 (20%) → Generalist; one Late skill → Generalist; a tie
  between Late and End → Generalist; a skill whose two `@` branches are both Late counts, one whose branches are Late and
  unrestricted does not; a distance and a style on the same card are independent.
- An override replaces only the dimension it names; the importer refuses an unknown id, an unknown value and an entry
  without a note.
- Album: both facets filter, count and clear; the picker exposes them.

## Acceptance

- The PR reports aggregate counts per style and distance on the private pack (never names), within a few cards of the
  M024 table, and Claude's override pass is published.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; the main bundle stays under 180 KB gzip.
- This spec is deleted in the same PR (D104).

## Out of scope

Stars (T078), scenario gating and partners (T079), achievements (T081), any gameplay effect of a focus (a focus is a
category, not a bonus), turf/dirt focus.
