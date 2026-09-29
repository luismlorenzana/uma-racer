# Milestone 24 — Card Training Loop

**Outcome:** training cards is a progression loop of its own. Every scenario is open for card training from the start,
the player decides which cards to bond where and when, a card maxes in **three** clears instead of five, every card
carries a **running-style** and a **distance** focus beside its stat type, and a family of **Bond achievements**
rewards bonding many cards across those categories.

Decisions: D199 (card training stands on its own), D200 (three stars), D201 (card focus), D202 (Bond achievements).
Source of truth once each task lands: [Support Cards](../design/support-cards.md),
[Minigames — Friendship Training](../design/minigames.md#friendship-training--card-stars),
[Collection](../design/collection.md), [Economy](../design/economy.md).

## Where it stands today (2026-09-29)

- **Scenarios are gated by Umas.** The Cards tab's scenario lenses and a card page's per-scenario rows stop at the
  highest scenario any Uma has unlocked (`highestTier` in `CardsScreen.tsx` and `CardPage.tsx`), which is why only two
  scenarios show. Friendship Training itself does not check Umas: `validateTarget` only asks that the card is owned,
  eligible (`era ≤ tier`) and below max there.
- **The run's deck borrows an Uma's card set.** `friendshipSetup` builds the deck from the named Uma's set in that
  scenario, else the first set any Uma holds there, and tops up from owned cards by seed. That is the only runtime
  dependency on Umas.
- **Stars are 0★–5★ per card per scenario** (D147, D150): a node pays 60 · 68 · 76 · 84 · 92 · 100%, the run earning a
  star has 1 · 2 · 2 · 3 · 3 stages, the first 5★ anywhere earns a Card Select Coupon, and rivals are built on a typical
  3★ set (84% a node). `MAX_STARS` is read in 18 files.
- **Cards have one category:** their stat type. Skills carry `running_style==N` and `distance_type==N` conditions
  that nothing reads for categorisation yet.
- **Trainer achievements** already reconcile deterministically from card saves (`trainer-achievements.ts`,
  catalog v1): Maxed Out, Card Collector, Era Complete, Type Complete.

## Measured card focus (private pack, 312 cards, aggregates only)

A first rule — a style or distance is a card's focus when at least 30% of its distinct hint and event skills, and at
least two, are restricted to it — gives:

| Dimension | Tagged | Generalist | Split |
|---|---|---|---|
| Running style | 151 | 161 | Front 30 · Pace 47 · Late 51 · End 23 |
| Distance | 134 | 178 | Sprint 18 · Mile 25 · Medium 60 · Long 31 |

52 cards carry both tags, 79 neither, the rest one, as the owner expected. Speed cards spread across every style and
distance (Pace 16, Front 9, Late 7, End 6; Medium 14, Mile 7, Sprint 5, Long 5), so "train speed cards for different
aptitudes" has real choices. At 25% 174/164 cards tag; at 40%, 124/100. T080 fixes the final rule.

## Tasks

| Task | Delivery | Depends on | Suggested owner |
|---|---|---|---|
| [T078](T078-three-star-cards.md) | Three stars: 0★–3★, save v8 migration, run ladder, coupon at 3★, rivals unchanged | — | Claude (save migration, API, production publish of the change) or Codex with Claude reviewing the migration |
| [T079](T079-card-training-on-its-own.md) | Every scenario open; a run's partners picked on its own, not from an Uma | T078 | Codex (delegable) |
| [T080](T080-card-focus-tags.md) | Running-style and distance focus per card; album facets; authored overrides | — (parallel with T078) | Codex for code; Claude authors and publishes the private overrides |
| [T081](T081-card-bond-achievements.md) | Bond achievement families (type, style, distance, combos, scenario, totals) | T078, T080 | Codex (delegable) |

```text
T078 three stars (save v8) ──┬──► T079 every scenario, own partners
                             │
T080 card focus ─────────────┴──► T081 Bond achievements
```

T078 goes first because every later task counts "max" and it changes the save. T080 touches content, the album and the
card page, not stars, so it can run beside T078. T079 and T081 both read T078's max; T081 also needs T080's tags.

## Fixed product contract

- **Card training never needs an Uma.** Every scenario, tier 1 to 14, is open for card training from the start; a card
  is trainable in a scenario once its era allows it (`era ≤ tier`, unchanged). Umas still read the stars of the scenario
  they train in (D127): card training feeds Uma training, never the other way round.
- **The player decides** how many cards to bond in each scenario and when. No quotas, no recommended order, no
  auto-training.
- **Three stars.** 3★ is max and pays exactly what 5★ paid; nothing about a maxed card changes. Below max, values may
  move: the owner only races maxed cards (D200).
- **Card focus is a second and third category**, beside stat type: one running style or Generalist, one distance or
  Generalist. Most cards carry one tag, some both, some neither (D201).
- **Bond achievements are flair only.** They pay no tickets, coupons or shards, like every trainer achievement.
- **Unchanged:** one ticket a run, all-or-nothing runs, the Card Select Coupon as the only way to own a card (D198),
  scenario twists, per-scenario stars.

## Milestone verification

Each PR runs `pnpm lint`, `pnpm test`, `pnpm build` and the sims it names. The milestone is done when:

1. A save from before T078 migrates once to v8, loses no maxed card, and syncs; open Friendship Training runs are
   retired with their tickets refunded.
2. A fresh account can open any of the fourteen scenarios in the Cards tab and bond an eligible owned card there with
   no Uma in that scenario.
3. Every card in the private pack has a style and a distance focus (a tag or Generalist), visible on its tile and page
   and filterable in the album.
4. Bonding cards to 3★ earns the Bond achievements retroactively and incrementally, with one flair event per tier.
5. The design docs above describe the built loop, and every M024 spec is deleted (D104).

## Out of scope

- Changing what a maxed card pays, card node values, Race Bonus at max, or Uma training.
- New currencies or ticket sinks; changing the Card Select Coupon's source.
- New Friendship Training rules beyond the star ladder and partner choice.
- A card "level" or any progress that is not stars.
