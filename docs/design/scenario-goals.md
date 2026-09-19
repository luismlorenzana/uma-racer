# Scenario Goals

Each started scenario freezes three optional race targets for that Uma. They give the tier a story without gating
Training, racing, or promotion. Targets are concrete private `RaceTemplate.id` values: content updates never silently
reroll an active or historical Journey.

> **Status:** goal plan **v2** is live: career-and-sex identity, frozen series legs, save v3 migration, and the Stable
> real-horse-sex filter are implemented as decided in D106.

## Three slots

| Slot | Selection | Rule |
|---|---|---|
| **Aptitude** | Her best combined surface + distance aptitude, at the tier's grade | Win the selected race |
| **Identity** | The real horse's career, then her sex's classic series | Win the selected race, or every leg from tier 7 |
| **Challenge** | A third aptitude target | Win by at least **5 lengths** |

## Identity: career first, then sex

This is the slot that makes an Uma feel like her real horse, and it follows two sources in order.

**1. Her career.** The importer joins GameTora's `ura-objectives` to every outfit of a character and stores the ordered,
distinct race families of that horse's career objectives in `UmaTemplate.signatureRaceFamilyIds`. Career order is career
order: debut and junior races first, then the classics, then the senior G1s. Tier *n* takes the *n*-th career family that
is still available, so an Uma re-runs her own career as she climbs:

| Uma | Tier 1 → | | | | |
|---|---|---|---|---|---|
| Special Week | Kisaragi Sho | Tokyo Yushun | Kikuka Sho | Tenno Sho (Spring) | Japan Cup |
| Daiwa Scarlet | Tulip Sho | Oka Sho | Japanese Oaks | Shuka Sho | Queen Elizabeth II Cup |
| Sakura Bakushin O | Keio Hai Junior Stakes | Spring Stakes | Aoi Stakes | Sprinters Stakes | Takamatsunomiya Kinen |

A career family is skipped when it has no retained gameplay race, when an earlier tier already used it, or when the Uma's
saved surface or distance aptitude for it is **worse than B** — a sprinter is never pushed into the Kikuka Sho.

**2. Her sex.** When the career list is exhausted or nothing in it fits, identity falls back to the classic series of the
real horse's sex (`realHorseSex`, imported from the original data):

| Sex | Series | Legs, in order |
|---|---|---|
| Male | **Triple Crown** | Satsuki Sho → Tokyo Yushun (Japanese Derby) → Kikuka Sho |
| Female | **Triple Tiara** | Oka Sho → Japanese Oaks (Yushun Himba) → Shuka Sho |

Each leg is taken in turn, under the same B-or-better check. An Uma with no recorded sex, or one who fails the check,
falls back to an ordinary aptitude target so the slot is never empty.

### From tier 7: win the whole set

The Identity slot becomes a **series goal**: win every leg of one race set **within this scenario**. The sets rotate in a
fixed order so a long-lived Uma collects titles rather than repeating one:

| Tier | Set |
|---|---|
| 7 | Her sex's classic set (Triple Crown or Triple Tiara) |
| 8 | Spring Triple Crown (Osaka Hai · Tenno Sho Spring · Takarazuka Kinen) |
| 9 | Autumn Triple Crown (Tenno Sho Autumn · Japan Cup · Arima Kinen) |
| 10 | Grand Prix (Takarazuka Kinen · Arima Kinen) |
| 11 | Sprint Crown · 12 Mile Crown · 13 Dirt Crown, then the rotation repeats |

The rotation skips a set whose legs are not all B or better, and falls back to the best-scoring set when none qualifies.
Series legs are the private semantic mappings defined by [Badges](badges.md#4-titles-and-g1-trophies); without published
coverage the Identity slot stays a single race. Completing a set naturally earns the matching title.

## Aptitude and Challenge

Aptitude score is the sum of the saved surface- and distance-grade indices (`S = 0` through `G = 7`); lower is better.
Among equally scored candidates at the requested grade, a race that carries any series tag — a famous race — wins the
tie, so a Long specialist chases the Arima Kinen rather than an anonymous 2500 m. Remaining ties sort by race id and
rotate by a stable hash of Uma id, tier, and slot. The generator uses no engine RNG, wall clock, or input iteration order.

The Challenge slot takes a third target and demands a **5-length** win. Each slot excludes the races the earlier slots
took, so a normal catalog always yields three distinct goals.

### Escalation across tiers

| Tier | Requested grade (Aptitude and Challenge) |
|---|---|
| 1 | Aptitude: Pre-OP. Challenge: OP |
| 2 | G3 |
| 3 | G2 |
| 4+ | G1 |

Identity follows the career race's own grade instead, and series goals are G1 by nature. Every race remains open from
scenario 1. When a requested bucket is empty after exclusions, selection visits weaker grades nearest-first, then stronger
grades nearest-first. Scenario Start fails before writes only when the complete catalog cannot supply three distinct valid
targets; its error reports aggregate counts, not private names or ids.

`SCENARIO_GOAL_VERSION` freezes the algorithm. A later algorithm needs an explicit migration and must not reroll a plan
that already has progress.

## Authoritative completion

Completion counts only a committed progression result from the exact Uma, active tier, and frozen target race. All goals
require first place. Challenge reads the ordered second-place runner's stored `marginLengths` only after confirming the
player won; exactly 5.0 passes. A series goal completes when its **last** leg is won inside the same tier; each leg
records its own result id. Preview, abandoned playback, another tier, another Uma, or a different alias of the same race
cannot count.

New race results always snapshot `completedGoalIds` (including `[]`); legacy results may omit it. Goal evaluation occurs
inside the existing atomic race transaction after deterministic re-simulation and before the result is appended. A
matching retry returns the stored ids without awarding or animating again, while a same-id mismatch is corruption.

## Lifecycle and migration

- New Umas have no active Journey until free Scenario Start. Promotion closes the old Journey and generates the next from
  post-pink-spark aptitudes in the same transaction.
- Promotion/final completion preserves completed goals, marks remaining active goals missed, and closes the Journey.
  Completed and missed facts never reopen. A series goal with some legs won is one missed goal, and its won legs stay
  visible as history.
- The one-time v0→v1 bootstrap labelled earlier tiers `legacy-untracked`, generated the current unfinished tier, and
  replayed only that Uma's strictly parsed current-tier race history. A previously completed final tier is also
  legacy-untracked.
- The v1→v2 bootstrap regenerates **only** an active Journey whose goals are all still untouched; any Journey with a
  completion or a miss keeps its frozen v1 plan. Migration invents no wins, misses, or rewards.
- Missing or retired target content shows its safe id and leaves the frozen goal honestly unavailable until restored.

## Presentation

| Place | What it shows |
|---|---|
| **Home** | Active three-goal tracker, rules, state pips (one per series leg), and direct target-race actions |
| **Uma Profile Journey** | One medallion per reached tier; completed, missed, and active pips; distinct Not tracked state; race/result links |
| **Race Select** | Exact active target races — every unwon series leg included — pinned above normal ordering, deduplicated ribbons, and Goals-only filtering |
| **Pre-race** | Every active goal at stake, including the 5-length Challenge rule and which leg of a set this race is |
| **Results** | Serialized Goal Ribbon reveals after ordinary rewards; reload shows the same completed summary without re-earning |

Goals pay no tickets, coupons, shards, stats, or SP. Completing all three derives an Honors crest for Journey/results.
One Goal Ribbon badge is persisted per exact completed goal and one scenario Honors badge for a tracked 3/3 Journey. The
evaluator uses existing goal/result ids, links the Ribbon event to its exact completion time, and never re-evaluates or
changes goal completion. Trainer achievements aggregate only tracked goal and Honors facts, so legacy-untracked tiers
never become fictional Stable progress.
