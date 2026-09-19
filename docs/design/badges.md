# Badges, Titles & Achievements

Badges are a **core pillar**. Every Uma gets a trophy case that tells her story: where she won, how she won, what she
mastered, and how far she has come. Milestone 6 implements this pillar without adding currency rewards or original-game
data to git.

## Concepts

| Concept | Description |
|---|---|
| **Badge** | A per-Uma accomplishment. Most have Bronze → Rainbow tiers; some are one-off feats |
| **Goal Ribbon / Honors** | Persisted badge forms of T014's exact completed-goal and 3/3 Journey facts |
| **Title** | A named race-set honor. One earned title may be active under the Uma's name |
| **G1 trophy** | One trophy per distinct G1 race family, with a lifetime win count |
| **Flair event** | Append-only evidence that a badge tier, title, trophy, or achievement was first earned |
| **Trainer achievement** | Account-wide accomplishment derived from collection and all Umas; see [Collection](collection.md#trainer-achievements-account-wide) |
| **Hidden badge** | Definition and progress are concealed until its first tier or one-off award is earned |

### Tier ladder

| Tier | Color | Shape | Prestige points |
|---|---|---|---:|
| Bronze | Bronze | Circle | 1 |
| Silver | Silver | Square | 2 |
| Gold | Gold | Diamond | 4 |
| Platinum | Blue-white | Hexagon | 8 |
| Rainbow | Rainbow | Star | 16 |

Only the highest earned tier of a tiered badge contributes Prestige. Ordinary one-off badges contribute 4 points,
Goal Ribbons contribute 1, Honors/Perfect/Speedrun contribute 4, and titles contribute 10. G1 trophies and Trainer
achievements do not contribute to an Uma's Prestige. Badges are pure flair and never pay tickets, coupons, shards, stats,
EXP, or SP.

## Milestone 6 implementation contract

Milestone 6 is delivered in four ordered tasks:

1. **T015 — Accomplishment facts and badge-state foundation:** versioned badge entities, private race-series tags, exact
   race fact snapshots, bounded counters, honest legacy baselines, strict sync parsing, and atomic fact capture.
2. **T016 — Per-Uma badges, titles, trophies, and award flow:** the catalog/evaluator, retroactive awards, deterministic
   flair events, Results/Home/Profile feedback, and Prestige.
3. **T017 — Badge page, showcases, and flair timeline:** Uma/Stable scopes, search/filter/sort, trophy wall, detail,
   active titles, pins/groups, saved views, and accessible reorder.
4. **T018 — Trainer achievements and profile:** account aggregates, records, Trainer scope, pinned Umas, Trainer showcase,
   and milestone closure.

T015–T018 are implemented. Every owned Uma now has durable facts plus catalog-v1 awards/events, retroactive migration,
Prestige/frame projection, the full lazy three-scope collection page, atomic preferences, trophy wall, bounded timeline,
and a 12-pin Profile showcase. The Trainer entity now also stores reconciled account aggregates, monotonic achievements,
stable records, display name, pinned Umas, and a mixed Trainer/per-Uma showcase.

The core profile and Uma remain save v2. Badge state uses a separate `BADGE_STATE_VERSION = 1` in the already-reserved
`badges` entity collection. This keeps badge rollout isolated from progression migration and lets an individual Uma's
flair sync independently.

## Catalog v1

Catalog definitions are checked-in game rules made only from semantic ids, generated labels, criteria, thresholds, tags,
visibility, and point values. They contain no private race, Uma, or card ids. Definitions are evaluated by shared generic
criterion handlers rather than one function per badge.

These reusable tier scales are fixed for catalog v1:

| Scale | Bronze / Silver / Gold / Platinum / Rainbow |
|---|---|
| Lifetime wins / surface / distance / strategy mastery | 1 / 10 / 25 / 50 / 100 |
| G3 or G2 wins | 1 / 5 / 10 / 20 / 40 |
| G1 wins | 1 / 3 / 7 / 15 / 30 |
| Starts | 10 / 50 / 100 / 250 / 500 |
| Specialist challenge | 1 / 5 / 10 / 20 / 40 |
| Breadth (minimum count across required buckets) | 1 / 3 / 5 / 10 / 20 |
| Venue wins | 1 / 3 / 7 / 15 / 30 |
| Back-field wins | 1 / 5 / 15 / 30 / 60 |
| Friendship trainings | 10 / 50 / 200 / 500 / 1,000 |
| Distinct lifetime skills | 5 / 15 / 30 / 60 / 100 |
| Skills in one scenario | 5 / 10 / 15 / 20 / 25 |
| Parent uses | 1 / 5 / 10 / 25 / 50 |

T015 must expose these values as domain constants and add them to the pinning test before implementation is merged.

### 1. Victories

| Definition | Criterion | Tiers |
|---|---|---|
| Winner | Total wins | Lifetime wins |
| G3 Champion | G3 wins | G3/G2 wins |
| G2 Champion | G2 wins | G3/G2 wins |
| G1 Champion | G1 wins | G1 wins |
| Unbeaten | Longest consecutive-win streak; any non-win breaks the streak | 3 / 5 / 8 / 12 / 20 |
| Seasoned | Total starts | Starts |

Race order is `(sequence, result id)` within one Uma. A corrupt duplicate/gap blocks bootstrap rather than inventing a
streak. A result counts as a win only when its authoritative player placement is first.

### 2. Surface and distance

| Definition | Criterion | Tiers |
|---|---|---|
| Turf Master / Dirt Master | Wins on that surface | Lifetime mastery |
| Against the Grain · Turf / Dirt | Wins there when the saved pre-race aptitude was B or lower | Specialist challenge |
| Impossible Ground | Win there with pre-race aptitude E or lower | Hidden one-off |
| Dual Surface | Minimum of Turf and Dirt wins | Breadth |
| Sprint / Mile / Medium / Long Master | Wins in that distance category | Lifetime mastery |
| Stretching Out · [distance] | Wins there when the saved pre-race aptitude was B or lower | Specialist challenge |
| All-Rounder | Minimum wins across all four distance categories | Breadth |
| Iron Horse | Win at 3,000 m or longer | One-off |
| Blink of an Eye | Win at 1,200 m or shorter | One-off |

The aptitude context is the player's snapshotted race aptitude, never the current improved aptitude. Exact distance comes
from immutable accomplishment facts on new results and the versioned race/content join for legacy results.

### 3. Strategy and venue

| Definition | Criterion | Tiers |
|---|---|---|
| Front Runner / Pace Chaser / Late Surger / End Closer | Wins with that strategy | Lifetime mastery |
| Chameleon | Minimum wins across all four strategies | Breadth |
| Unorthodox | Win using a saved strategy aptitude of C or lower | Hidden one-off |
| [Venue] Regular | Wins at that normalized venue | Venue wins |
| Grand Tour | At least one win at all 10 venues tagged `jra-main` in the current private catalog | One-off |

Venue badges are dynamic definitions keyed by a normalized private-content venue key; display names are private-content
joins. The checked-in catalog never lists source venue ids/names. The private override must resolve exactly 10 distinct
main venue keys. Grand Tour uses the set captured by the catalog version
that awards it and is never revoked if later content adds another venue.

### 4. Titles and G1 trophies

Private race content supplies semantic `series` tags such as `triple-crown`; the ignored mapping from source race-family ids
to those tags never enters git. Catalog v1 awards:

| Title | Required | Legs |
|---|---|---:|
| Triple Crown | Satsuki Sho · Tokyo Yushun · Kikuka Sho | 3 |
| Triple Tiara | Oka Sho · Japanese Oaks · Shuka Sho | 3 |
| Spring Triple Crown | Osaka Hai · Tenno Sho (Spring) · Takarazuka Kinen | 3 |
| Autumn Triple Crown | Tenno Sho (Autumn) · Japan Cup · Arima Kinen | 3 |
| Grand Prix Queen | Takarazuka Kinen · Arima Kinen | 2 |
| Sprint Queen | Takamatsunomiya Kinen · Sprinters Stakes | 2 |
| Mile Queen | Yasuda Kinen · Mile Championship | 2 |
| Dirt Queen | February Stakes · Champions Cup | 2 |
| Two-Time / Three-Time [Race] | Two or three wins in the same G1 family | — |

> ⚠️ **Every race-set title and Grand Tour is currently unearnable**: the private series override was never written, so
> published content carries no series tags. [T019](../tasks/T019-race-series-and-titles.md) writes it, changes a series
> from a family list into **legs** (one leg is satisfied by any alias family, since the catalog holds alternate-venue and
> scenario variants of the same race), and awards the titles retroactively. Only the repeat titles work today.

Titles can be earned across any number of scenarios and are permanent. A leg must be won at least once for each set;
calendar variants sharing the family do not create duplicates. Repeat titles use the current private race name with a safe
family-id fallback. Every distinct G1 family win also creates or increments its trophy, but only the first win emits a
`trophy-earned` flair event.

The importer reads an owner-maintained, gitignored `content/overrides/flair.json` containing race-family series tags and
the main-venue set. It validates every reference and reports aggregate coverage only. Missing or malformed coverage
disables the affected title/Grand Tour criterion with an explicit content diagnostic; it never substitutes by name.

### 5. Race feats

| Definition | Criterion | Tiers |
|---|---|---|
| Wire to Wire | Won while strictly first at every completed section checkpoint | Hidden one-off |
| Great Comeback | Won from last place when the player's final spurt began | Hidden one-off |
| From the Back | Won from 10th or worse when the player's final spurt began | Back-field wins |
| Dominant | Won by at least 5.0 lengths | One-off |
| Big Margin | Won by at least 10.0 lengths | Hidden one-off |
| Photo Finish | Won with a positive runner-up margin below 0.15 lengths | One-off |
| Lightning Start | Start delay below 0.010 seconds and won | Hidden one-off |
| Slow Start, Fast Finish | Start delay at least 0.080 seconds and won | Hidden one-off |
| Course Record | Finished strictly faster than every earlier player result on that course id | One-off per course |
| Heir | Won a race in which an inherited unique skill activated | One-off |

At a tied record time, only the earlier result is the record setter. Wire to Wire samples the authoritative 24-section
placement projection after the gate; a tie for first fails. Last-spurt placement is sampled on the player's first
`last-spurt` event and is unavailable if the engine emits none. New race rows snapshot these bounded facts. Legacy rows are
re-simulated only through their frozen engine-version path; a missing replay/content dependency is marked untracked rather
than guessed.

`Duelist` waits for race-engine R4. `Upset` waits for a documented per-runner pre-race rating; Race Form percentages are not
a field ranking and must not be repurposed. Neither appears as an earnable/locked catalog-v1 tile.

### 6. Stats, levels, and scenarios

| Definition | Criterion | Tiers |
|---|---|---|
| Speed / Stamina / Power / Guts / Wit Peak | Highest saved value | 600 / 900 / 1,200 / 1,600 / 2,000 |
| Balanced | Highest saved minimum of the five stats | 500 / 800 / 1,100 / 1,500 / 1,900 |
| [Scenario] Capped | At scenario completion, at least one stat is at or above that scenario's TL10 cap | One-off per scenario |
| [Scenario] Perfect Form | At scenario completion, all five stats are at or above that cap | One-off per scenario |
| Level milestones | Highest Uma level | 10 / 25 / 50 / 75 / 100 |
| [Scenario] Graduate | Completed that scenario | One-off per scenario |
| [Scenario] Speedrun | Completed/promoted from that scenario in 15 or fewer race starts in the tier | One-off per scenario |
| Living Legend | Completed every scenario present in the awarding catalog version | One-off |

`>=` is intentional for cap badges because permanent stats may already exceed a new scenario's current cap. Promotion and
final completion snapshot the pre-promotion tier, stat values, TL, deck, training counters, race count, and completion time
before applying the next scenario's bonuses. Graduate and Speedrun are retroactive from Journey/race history; old Capped/
Perfect facts that cannot be reconstructed remain untracked.

### 7. Training, skills, goals, and lineage

| Definition | Criterion | Tiers |
|---|---|---|
| Diligent | Lifetime training turns | 50 / 250 / 1,000 / 3,000 / 10,000 |
| Friendship Power | Lifetime friendship trainings | Friendship trainings |
| [Scenario] Fully Trained | Reached TL10 during that scenario | One-off per scenario |
| Era Loyalist | Completed a scenario using only cards whose era equals that scenario tier | One-off per scenario |
| Full House | Trained with all six equipped cards present at one facility | Hidden one-off |
| Skill Collector | Distinct skills ever learned, from skill history | Distinct lifetime skills |
| Full Kit | Highest distinct skills unlocked within one scenario | Skills in one scenario |
| Goal Ribbon | One named ribbon per exact completed T014 goal | One point each |
| [Scenario] Honors | Completed all three tracked goals in that scenario | Four points each |
| Destiny | Exact completed goals across tracked Journeys | 3 / 10 / 25 / 50 / 100 |
| Perfect Journey | Honors in every completed, tracked scenario, with at least three completed scenarios | One-off |
| Legacy | Times this Uma's frozen snapshot was committed as a direct parent | Parent uses |
| Dynasty | A grandchild completed a scenario with this Uma in the frozen grandparent chain | 1 / 3 / 5 / 10 / 20 |

Era Loyalist requires a nonempty deck and every equipped card to match the completed tier; mixed/later/unknown content
fails. Full House is possible only when six slots are unlocked. A Goal Ribbon uses the stored goal id and result id, joins
its target privately for display, and falls back safely when content is missing. Legacy increments on Scenario Start, while
Dynasty increments when the descendant closes the scenario—not when lineage is merely selected.

## Durable facts and honest history

### Race facts

New `RaceResultRecord`s carry optional versioned `accomplishmentFacts`; legacy rows omit it. Version 1 snapshots only the
bounded facts required above:

- race family, grade, venue key/tags, course id, surface, exact distance, distance category, and semantic series tags;
- player start delay, first-final-spurt placement, whether the player strictly led every section checkpoint, and whether an
  inherited unique activated.

These facts are derived from the authoritative template, saved race input, and deterministic timeline inside the existing
completion transaction. They do not change simulation or replay versions. Parsers reject invented UI-supplied facts,
unknown fact versions, duplicate tags, unsafe ids, invalid ranges, or facts inconsistent with the stored player result.

### Bounded Uma facts

Each per-Uma badge entity stores bounded aggregate facts rather than an unbounded copy of gameplay history: counters by
grade/surface/distance/strategy/venue/family, current/longest streak, best stats/minimum stat, distinct skill ids, training
counters, scenario-completion facts, goal/Honors totals, parent-use counts, and evaluation watermarks. Race history remains
the source log and flair events remain their own append-only log.

Training updates lifetime turns, friendship turns, Full House, TL10, and skill facts in the same transaction as the turn.
Scenario Start increments selected parents' Legacy facts in the same transaction as the child. Promotion/final completion
captures the completed scenario and updates every known grandparent's Dynasty fact atomically with the child when those
entities exist locally; missing/orphaned ancestors remain explicit and may be reconciled during bootstrap.

### Retroactivity grades

Every definition has one history grade shown in detail/progress UI:

| Grade | Meaning |
|---|---|
| **Exact** | All relevant history can be reconstructed from race results, journeys, skill history, or current state |
| **Since tracking** | Pre-T015 facts were not durably stored; progress is a truthful lower bound starting from migration |
| **Untracked** | A required legacy replay/content dependency is missing; no progress or award is guessed |

Bootstrap strictly parses complete local race history before publishing ready state. Existing race, goal, level, current
stat, and skill-history awards are retroactive and exact where their dependencies resolve. Current-scenario training turns
form the lower-bound seed for Diligent; current TL10 may award Fully Trained for the active tier. Prior friendship/Full
House/deck-at-completion/parent-use/Dynasty facts are not invented. A lower bound that already crosses a threshold may
award it, but the UI labels the underlying progress “at least”.

## Award and event semantics

- Evaluation is pure and deterministic: `(catalog, previous state, facts, triggering source) → next state + new events`.
- Badge tiers and titles are monotonic. Earned flair is never revoked by later catalog/content changes.
- Crossing multiple tiers at once records every tier internally but presents one highest-tier fanfare for that definition;
  detail retains each tier's first-earned event.
- A deterministic flair-event id contains scope, award key, and tier/title/trophy stage. Retries match existing payloads;
  same-id mismatches are corruption.
- New race/training/promotion/start commits update facts, awards, badge entities, flair logs, and existing game writes in one
  Dexie transaction before Zustand publishes. No badge may appear without its triggering gameplay commit or vice versa.
- Retroactive bootstrap writes all affected badge entities/flair events/outbox rows in one transaction. Source timestamps
  are used when known; otherwise the migration time is stored with `retroactive: true`.
- Results snapshot exact newly earned flair-event ids, including an empty array, so reload/retry cannot replay fanfare or
  re-evaluate a mutable catalog. Legacy results omit the field.

## Displaying flair

### Uma profile and Home

- Name, active title, level, scenario-tier crest, and Prestige frame.
- Existing Scenario Journey medallions remain derived from Journey facts; persisted Goal Ribbons/Honors link back to them.
- The first 12 flattened showcase pins appear on the Badges tab, with a link to the full page.
- Career record remains `starts: 1st-2nd-3rd-other`.
- Home shows the latest three visible flair events for the featured Uma; hidden badge names reveal only when earned.

### Badge page

The route is lazy and mobile-first. Its top switch has **Uma / Stable / Trainer** scopes:

| Scope | Shows |
|---|---|
| Uma | One Uma's badges, titles, Goal Ribbons, G1 trophies, progress, and timeline |
| Stable | Definitions aggregated across every owned Uma, with holder/tier/rarity drill-down |
| Trainer | Account achievements, records, progress, and Trainer showcase |

All scopes support search and applicable tag filters. Uma and Stable support category, tier/type, surface, distance,
strategy, aptitude context, venue, grade, scenario, status, and date. Stable additionally supports Uma and rarity. Sorts are
most recent, tier, closest next tier, rarest (Stable), alphabetical, and category. Hidden unearned definitions are excluded
from search/counts; other locked definitions use silhouettes.

Stable rarity is private and local to the current known roster, never global telemetry: universal holders are Common;
partial majority/half are Uncommon; a minority held by more than one Uma is Rare; unique or still-unheld definitions are
Elite. Orphaned Umas are reported and excluded from both the holder numerator and known denominator.

A tile shows a generated semantic glyph, tier shape/color/label, current progress, and pin state. No original-game badge
art is committed or hosted publicly. Detail shows criterion, ladder, exact/since-tracking status, tier dates and source
links, safe missing-content fallbacks, and related timeline events. The G1 trophy wall groups family trophies and counts.

### Showcase, titles, and saved views

- Pins are unlimited in storage. An award may appear at most once across a scope's groups.
- Every showcase has an unnamed default group followed by at most 20 named groups; names are 1–40 trimmed characters.
- Group and pin order are explicit arrays. Drag handles are enhanced input; ≥44 pt Move up/down controls provide the full
  accessible operation and are the required iPhone fallback.
- Multi-select can pin, unpin, or move many visible items. Filtering never silently changes hidden selections.
- The Uma profile displays the first 12 awards after flattening groups in order. Trainer showcase has the same grouping
  rules and may pin achievements or qualified per-Uma awards.
- Active title must be currently earned by that Uma. Removing content never clears an already earned safe title id.
- Each scope may store at most 20 named saved views. Names are 1–40 characters; filters/sort use strict catalog enums.
- Trainer profile may pin any number of owned Umas in an explicit, duplicate-free order.

### Flair timeline and Prestige

The timeline merges append-only flair events in `(earnedAt, id)` order and can filter by kind. Entries link to their race,
scenario Journey, Uma, or migration explanation. Deleting or reordering a showcase never edits history.

`prestige = sum(highest badge tier/one-off points) + 10 × titles earned`.

| Frame | Minimum Prestige |
|---|---:|
| Plain | 0 |
| Bronze | 5 |
| Silver | 15 |
| Gold | 40 |
| Platinum | 80 |
| Rainbow | 160 |
| Legend | 300 |

Frames are derived, not independently persisted. Thresholds, catalog scales, one-off points, and title points are pinned
in `packages/domain/src/domain.test.ts` when T015 lands.

## Explicitly deferred

- `Duelist`, rushed/spot-struggle feats, and other R4-dependent badges.
- `Upset` until a per-runner rating formula is designed and pinned.
- Sound, haptics, bespoke badge art, and replacing existing emoji/icons (Milestone 7).
- Social/global rarity, public profiles, sharing, leaderboards, or server-authoritative anti-cheat.
- Currency or progression rewards from flair.
