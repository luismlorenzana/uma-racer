# Badges, Titles & Achievements

Badges are a **core pillar**. Every Uma gets a trophy case that tells her story: where she won, how she won, what she
mastered, and how far she has come. None of it pays currency, and none of it puts original-game data in git.

> **Status: built (generation 2, T141, D359).** Per-Uma badges, titles and G1 trophies (`flair.ts`) and the Trainer's
> achievements (`trainer-achievements.ts`) run on generation 2's catalogue, shown in the Trophy Hall
> (`/racing/trophy-hall`, [11](../game/11-hub-and-places.md) §3.3). Badge state is its own versioned entity
> (`BADGE_STATE_VERSION = 1`) in the save's `badges/…` kind, beside the append-only `flairEvents` log
> ([rework/13](../rework/13-removals-and-plan-changes.md) §6), so an Uma's flair syncs on its own.

## Concepts

| Concept | Description |
|---|---|
| **Badge** | A per-Uma accomplishment. Most have Bronze → Rainbow tiers; some are one-off feats |
| **Goal Ribbon / Honors** | Badge forms of her career's facts: one ribbon per completed goal, and Honors for a scenario whose every goal she won |
| **Title** | A named race-set honor. One earned title may be active under the Uma's name |
| **G1 trophy** | One trophy per distinct G1 race family, with a lifetime win count |
| **Flair event** | Append-only evidence that a badge tier, title, trophy, or achievement was first earned |
| **Trainer achievement** | Account-wide accomplishment derived from every Uma's flair and the cards ever bonded; see [Trainer achievements](#trainer-achievements) |
| **Hidden badge** | Definition and progress are concealed until its first tier or one-off award is earned |

### Tier ladder

| Tier | Color | Shape | Prestige points |
|---|---|---|---:|
| Bronze | Bronze | Circle | 1 |
| Silver | Silver | Square | 2 |
| Gold | Gold | Diamond | 4 |
| Platinum | Blue-white | Hexagon | 8 |
| Rainbow | Rainbow | Star | 16 |

Only the highest earned tier of a tiered badge contributes Prestige. Ordinary one-off badges contribute 4 points, the
Hall of Fame badge 16, Goal Ribbons 1, Honors/Perfect/Speedrun 4, and titles 10. G1 trophies and Trainer achievements
do not contribute to an Uma's Prestige. Badges are pure flair and never pay Prize Money, items, Uma Tickets or Shards,
stats, EXP, or SP.

## Catalog v1

Catalog definitions are checked-in game rules made only from semantic ids, generated labels, criteria, thresholds, tags,
visibility, and point values. They contain no private race, Uma, or card ids. Definitions are evaluated by shared generic
criterion handlers rather than one function per badge.

These reusable tier scales are domain constants (`BADGE_THRESHOLDS`), pinned in `domain.test.ts`:

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
| Distinct lifetime skills | 5 / 15 / 30 / 60 / 100 |
| Skills in one scenario | 5 / 10 / 15 / 20 / 25 |
| Parent uses | 1 / 5 / 10 / 25 / 50 |

### Generation 2 (T141, D359)

- **Retired:** Diligent, Card Collector, Maxed Out, Coupon Clipper, Era and Type Complete, and every Puzzle and
  Friendship record ([rework/13](../rework/13-removals-and-plan-changes.md) §1, [06](../game/06-cards-and-bonds.md) §7).
  Their facts are gone from the badge state too.
- **Redefined:** [Scenario] Fully Trained is that scenario's layer done; [Scenario] Graduate is leaving it; the level
  badges and Veteran Stable read the lifetime level; Living Legend comes only through the Hall of Fame; Era Loyalist
  reads the set of every race she ran in the scenario; Capped and Perfect Form read the scenario's caps (§6, §7).
- **Added:** Promoted · Tier 2 and Tier 3, the Hall of Fame badge and the title Hall of Famer (§6); the Trainer's Card
  Partners, Era and Type Bonded, Promotions and Hall of Fame ([Trainer achievements](#trainer-achievements)).

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
from the result's immutable accomplishment facts.

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

Private race content supplies semantic `series` tags such as `triple-crown` plus stable `seriesLegs` values shaped as
`<tag>:<leg-key>`; the ignored mapping from source race-family ids to those legs never enters git. Catalog v1 awards:

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
| Hall of Famer | Entering the Hall of Fame (§6) | — |

Titles can be earned across any number of scenarios and are permanent. A leg is satisfied by a win in any of its family
aliases, so alternate-venue and scenario variants receive the same credit; every leg in the set must be satisfied once.
The evaluator joins stored family-win facts to the current content's legs, then freezes stable leg ids into the earned
title. Repeat titles use the current private race name with a safe family-id fallback. Every distinct G1 family win also
creates or increments its trophy, but only the first win emits a `trophy-earned` flair event.

The importer reads a Claude-maintained, gitignored version-2 `content/overrides/flair.json` containing tag → leg → family
alias mappings and the main-venue set. It validates stable kebab-case leg keys, fixed leg counts, duplicate placement,
exactly 10 distinct retained main venues, and every private reference, while reporting aggregate coverage only. A missing
override produces zero coverage and disables only the affected title/Grand Tour criteria; malformed coverage fails import
instead of guessing by name. A tile whose coverage is unpublished says so ("Race-series coverage is not published"),
so it never reads as covered-but-unearned.

**Published coverage (2026-09-19):** all 8 series across 30 race families, plus the 10 `jra-main` venues, so every title and Grand Tour is earnable in production.

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
`last-spurt` event and is unavailable if the engine emits none. Every race row snapshots these bounded facts.

`Duelist` waits for race-engine R4. `Upset` waits for a documented per-runner pre-race rating; grade handicaps are not
a field ranking and must not be repurposed. Neither appears as an earnable/locked catalog-v1 tile.

### 6. Stats, levels, and scenarios

Scenario badges exist for each scenario *T* of the catalogue, by the game's scenario number
([04](../game/04-tiers-and-promotion.md) §1).

| Definition | Criterion | Tiers |
|---|---|---|
| Speed / Stamina / Power / Guts / Wit Peak | Highest value she has raced with or held in her selected preset | 600 / 900 / 1,200 / 1,600 / 2,000 |
| Balanced | Highest minimum of the five stats, read the same way | 400 / 600 / 800 / 1,000 / 1,200 |
| [Scenario] Capped | On leaving that scenario, at least one stat is at or above its lowest stat cap | One-off per scenario |
| [Scenario] Perfect Form | On leaving that scenario, all five stats are at or above that cap | One-off per scenario |
| Level milestones | Highest lifetime level, 50 × (tier − 1) + Racing Level ([03](../game/03-uma-progression.md) §2) | 10 / 25 / 50 / 75 / 100 |
| [Scenario] Graduate | Left that scenario: by the advance, by promotion from a tier's last scenario, or into the Hall of Fame from the catalogue's last | One-off per scenario |
| [Scenario] Speedrun | Left that scenario after 15 or fewer race starts in it | One-off per scenario |
| Living Legend | Graduated every scenario of the catalogue; the last one only through the Hall of Fame | One-off |
| Promoted · Tier 2 / Tier 3 | Promoted out of tier 1 / tier 2: the Graduate fact of scenario 5 / 10 | One-off, 4 Prestige |
| Hall of Fame | Entered the Hall of Fame: the Graduate fact of the catalogue's last scenario. Also earns the title Hall of Famer | One-off, 16 Prestige |

**The cap** of Capped and Perfect Form is the scenario's lowest per-stat cap: 1,200 in URA Finale, the lowest of the
five in a later scenario's uneven profile ([04](../game/04-tiers-and-promotion.md) §7). `≥` is intentional, since caps
clamp each stat and a stat may sit above the lowest one.

**Leaving a scenario writes its completion fact**, which Capped, Perfect Form, Graduate, Speedrun, Era Loyalist and
Honors read: her selected preset's stats as she leaves, her starts there, her goals and Honors, her lineage, and the
deck. The deck is the union of the card sets of every race she ran there, at most six, cards of another era kept first
so Era Loyalist's verdict holds. Graduate and Speedrun are exact from the completion fact and her race history.

### 7. Training, skills, goals, and lineage

| Definition | Criterion | Tiers |
|---|---|---|
| [Scenario] Fully Trained | Opened every unlock of that scenario's layer (`layerDone`, D344; [05](../game/05-training-hub.md)) | One-off per scenario |
| Era Loyalist | Left a scenario with only cards whose era equals that scenario's *T* in the set of every race she ran there | One-off per scenario |
| Full House | Every card node of her tree open and filled in one preset (D164, D235) | Hidden one-off |
| Skill Collector | Distinct skills ever seen in her selected preset's library | Distinct lifetime skills |
| Full Kit | Most skills in her selected preset's library within one scenario | Skills in one scenario |
| Goal Ribbon | One named ribbon per completed career goal | One point each |
| [Scenario] Honors | Won every goal of her career in that scenario | Four points each |
| Destiny | Completed career goals across her careers | 3 / 10 / 25 / 50 / 100 |
| Perfect Journey | Honors in every scenario she has left, with at least three left | One-off |
| Legacy | Arrivals of another Uma in a scenario with this Uma in a parent slot of that Uma's selected preset | Parent uses |
| Dynasty | Times a grandchild left a scenario with this Uma in a grandparent slot of its selected preset | 1 / 3 / 5 / 10 / 20 |

Era Loyalist requires a nonempty deck whose every card's era is the scenario's *T*; mixed eras fail, and a card missing
from the content is left out of the deck. A Goal
Ribbon uses the stored goal id and result id, joins its target privately for display, and falls back safely when content
is missing. Legacy counts at arrival (the advance), when the child's career freezes; Dynasty when the grandchild leaves
the scenario. Choosing a lineage alone counts nothing, and a promoted Uma arrives with empty presets, so her promotion
counts no parents.

## Durable facts and honest history

### Race facts

Each `raceResults` row carries versioned `accomplishmentFacts`. Version 1 snapshots only the bounded facts required above:

- race family, grade, venue key/tags, course id, surface, exact distance, distance category, and semantic series tags;
- player start delay, first-final-spurt placement, whether the player strictly led every section checkpoint, and whether an
  inherited unique activated.

These facts are derived from the authoritative template, the race input and the deterministic timeline when the race
is prepared ([Racing](racing.md#accomplishment-facts)). They do not change simulation or replay versions. Parsers reject
invented UI-supplied facts, unknown fact versions, duplicate tags, unsafe ids, invalid ranges, or facts inconsistent with
the stored player result.

### Bounded Uma facts

Each per-Uma badge entity stores bounded aggregate facts rather than an unbounded copy of gameplay history: counters by
grade/surface/distance/strategy/venue/family, current/longest streak, best stats/minimum stat, distinct skill ids, the
scenarios she Fully Trained and her Full House count, scenario-completion facts, goal/Honors totals, parent-use counts,
and evaluation watermarks. Race history remains the source log and flair events remain their own append-only log.

**Where generation 2's facts come from:**
- **A race** applies its race facts from its `raceResults` row, at her sequence.
- **Her build's facts** are read from her as she stands, at each evaluation: Fully Trained when her scenario's layer is
  done, Full House when a preset fills every card node of her tree, her selected preset's library for the skill
  badges, its stats for the stat peaks, and her lifetime level for the level peak.
- **Leaving a scenario** (the advance, a promotion, the Hall of Fame) writes its completion fact (§6), a Dynasty fact
  for each grandparent in her selected preset, and, on arrival in the next scenario, a Legacy fact for each parent in
  it.
- **The Trainer** reads every Uma's badge state, her race results and the ever-bonded card set
  ([Trainer achievements](#trainer-achievements)).

### Retroactivity grades

Every definition has one history grade, which its progress label reflects:

| Grade | Meaning |
|---|---|
| **Exact** | All relevant history can be reconstructed from race results, careers, skills, or current state |
| **Since tracking** | Facts were not durably stored before her badge state existed; progress is a truthful lower bound from then |
| **Untracked** | A required replay/content dependency is missing; no progress or award is guessed |

Generation 2's save started empty (D323), so race and training history are exact from an Uma's first race. A badge
state is created the first time a commit or the Trophy Hall needs one: her past races are replayed into it in order, and
her build's facts read as she stands. Lineage facts start as since-tracking. A lower bound that already crosses a
threshold may award it, but the UI labels the underlying progress "at least".

## Award and event semantics

- Evaluation is pure and deterministic: `(catalog, previous state, facts, triggering source) → next state + new events`.
- Badge tiers and titles are monotonic. Earned flair is never revoked by later catalog/content changes.
- Crossing multiple tiers at once records every tier internally but presents one highest-tier fanfare for that definition;
  detail retains each tier's first-earned event.
- A deterministic flair-event id contains scope, award key, and tier/title/trophy stage. Retries match existing payloads;
  same-id mismatches are corruption.
- **When.** Each race, advance and promotion commit evaluates the Uma's flair (and, at a departure, her lineage's) and
  reconciles the Trainer. The badge entities and flair events ride in the operation's own local transaction, behind it
  in the one sync lane, so no badge appears without its gameplay commit or the other way round. Opening the Trophy Hall
  reconciles once more, writing only what changed. No other place calls flair.
- A result shows the events earned in its own commit, so a reload or retry neither replays the fanfare nor
  re-evaluates the catalogue: the first showing plays it, a reload shows it quietly.

## Displaying flair

### The Trophy Hall

A place on the Racing page ([11](../game/11-hub-and-places.md) §3.3). Its Peek shows recent flair, and its counter the
flair earned since this device last visited. `/badges` and `/trainer` redirect into it. The Uma profile's Racing tab
links to her page there for titles, Prestige and her showcase.

### Badge page

Its top switch has **Uma / Stable / Trainer** scopes:

| Scope | Route | Shows |
|---|---|---|
| Uma | `/racing/trophy-hall/uma/:umaId` | An Uma strip (highest lifetime level first); her Prestige, frame, earned count and active title; her showcase; her titles; her badges; the G1 trophy wall; her latest 20 timeline entries |
| Stable | `?scope=stable` | Definitions aggregated across every owned Uma, with holders and rarity |
| Trainer | `?scope=trainer`; the profile at `/racing/trophy-hall/trainer` | Trainer achievements, records and the profile ([Trainer achievements](#trainer-achievements)) |

Every scope's list has search, a status filter (all, earned, locked), a category filter and six sorts: most recent,
highest tier, closest next tier, rarest, alphabetical and category. Hidden unearned definitions are excluded from search
and counts; other locked definitions show as locked tiles with their progress.

Stable rarity is private and local to the current known roster, never global telemetry: universal holders are Common;
partial majority/half are Uncommon; a minority held by more than one Uma is Rare; unique or still-unheld definitions are
Elite. Orphaned Umas are reported and excluded from both the holder numerator and known denominator.

A tile shows its category, name, description, tier (or Locked) with its progress and a progress bar, and in the Stable
its holders. No original-game badge art is committed or hosted publicly. The G1 trophy wall shows each family trophy
with its win count and latest win date.

### Showcase, titles, and saved views

- **Pins.** The Uma scope's pin mode pins an earned award to her showcase, or unpins it; a new pin joins the default
  group. The Trainer's showcase shows on the trainer profile.
- **Active title.** One title she has earned is active under her name, switched with Set title. Removing content never
  clears an already earned safe title id.
- **The saved shape** keeps catalog v1's limits (`parseBadgeState`): pins are unlimited, an award appears at most once
  across a scope's groups, every showcase has an unnamed default group followed by at most 20 named groups (names 1–40
  trimmed characters), each scope stores at most 20 named saved views, the Trainer's display name is 1–32 characters,
  and the Trainer may pin any number of owned Umas in an explicit, duplicate-free order. The Trophy Hall has no editor
  for named groups, saved views, the display name, the Trainer's pins or pinned Umas, so those keep their defaults.

### Flair timeline and Prestige

The timeline merges append-only flair events in `(earnedAt, id)` order; each entry shows its award, its kind and its
date. Deleting or reordering a showcase never edits history.

`prestige = Σ highest tier points of each tiered badge + Σ one-off points + 10 × titles earned`, where a one-off is 4
(16 for the Hall of Fame), a Goal Ribbon 1 and Honors 4.

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
in `packages/domain/src/domain.test.ts`.

## Trainer achievements

Account-wide accomplishments on the same tier ladder as badges: Bronze → Silver → Gold → Platinum → Rainbow. They are
pure flair: they pay nothing and add no Prestige. `reconcileTrainerState` (`trainer-achievements.ts`) recomputes them
from every owned Uma's badge state, her race results and the cards ever bonded, in each race, advance and promotion
commit and when the Trophy Hall opens. An earned stage never falls. The thresholds are
`TRAINER_ACHIEVEMENT_THRESHOLDS`, pinned in `domain.test.ts` and `generation-2-flair.test.ts`.

### Collection

| Achievement | Criterion | B / S / G / P / R |
|---|---|---|
| Stable Master | Umas owned | 30 / 40 / 60 / 90 / all |
| Card Partners | Distinct support cards ever bonded, to any Uma in any tier | 10 / 25 / 50 / 100 / 200 |
| Era *N* Bonded | Every card of that era bonded at least once, to any Uma | One-off per era |
| [Type] Bonded | Every card of that type bonded at least once, to any Uma | One-off per type |

### Stable

| Achievement | Criterion | B / S / G / P / R |
|---|---|---|
| Stable Wins | Races won by all Umas | 10 / 100 / 500 / 1,500 / 5,000 |
| Stable G1s | G1 wins by all Umas | 1 / 10 / 50 / 150 / 500 |
| Stat Badges | Stat and Balanced badge stages earned by all Umas | 5 / 25 / 75 / 200 / 500 |
| Badge Hoarder | Badge stages, one-offs, Goal Ribbons and Honors earned by all Umas | 25 / 150 / 500 / 1,500 / 5,000 |
| Title Holders | Distinct titles held across the Stable | 1 / 5 / 10 / 20 / all |
| Veteran Stable | Umas at lifetime level 50 or higher | 1 / 3 / 10 / 25 / 50 |
| Legendary Stable | Umas at the maximum lifetime level | 1 / 3 / 5 / 10 / 25 |

### Journey

| Achievement | Criterion | B / S / G / P / R |
|---|---|---|
| Graduations | Scenarios left by all Umas (Graduate facts) | 5 / 25 / 75 / 200 / 500 |
| Heirs | Arrivals in a scenario with at least one parent in the selected preset | 5 / 25 / 100 / 250 / 1,000 |
| Stable Goals | Career goals completed by all Umas | 5 / 25 / 100 / 300 / 1,000 |
| Honors Collector | Scenario Honors earned by all Umas | 1 / 10 / 30 / 100 / 300 |
| Family Tree | Distinct Umas that have served as a parent | 2 / 5 / 10 / 25 / 50 |
| Promotions | Promotions across the Stable | 1 / 5 / 15 / 30 / 50 |
| Hall of Fame | Umas inducted into the Hall of Fame | 1 / 3 / 10 / 25 / 50 |

Counting rules are exact:

- `all` freezes the applicable private-catalog denominator and keys when earned; later content never revokes it.
  Stable Master's is the catalogue's Umas. Title Holders' is every race-set title whose legs the private content fully
  covers, plus the Two-Time and Three-Time title for every G1 family in it.
- **Card Partners** has no `all`: its fifth step is 200. **Era and Type Bonded** freeze the era's or type's card ids
  when earned. All three read the **ever-bonded set**, `everBondedCardIds` over every Uma's current bonds and her tier
  histories, so a promotion, which clears her bonds, never lowers it ([06](../game/06-cards-and-bonds.md) §7, §9). Cards
  outside the current catalogue don't count.
- Stat Badges counts earned stat/Balanced badge stages. Badge Hoarder counts all per-Uma badge stages, one-offs, Goal
  Ribbons, and Honors, excluding titles and trophies.
- **Veteran and Legendary Stable** read the lifetime level ([03](../game/03-uma-progression.md) §2). Lifetime 50 is a
  tier-1 Uma at Racing Level 50, or any promoted Uma. The maximum is `MAX_UMA_LEVEL`, ten levels for each scenario of
  the catalogue: 140 today, tier 3 at Racing Level 40 while tier 3 has four scenarios.
- **Heirs** counts her arrivals with one or two parents in her selected preset's open slots, and **Family Tree** the
  distinct Umas with at least one Legacy fact (§7). Stable Goals and Honors Collector count tracked facts only.
- **Promotions** counts each Uma's Graduate facts of scenarios 5 and 10, and **Hall of Fame** the Umas with the Graduate
  fact of the catalogue's last scenario.
- Orphaned saves are visible diagnostics but do not inflate current-content collection denominators.

Retired with generation 2 (T141): Card Collector, Maxed Out, Era and Type Complete, Coupon Clipper, and every Puzzle,
Friendship and minigame record ([06](../game/06-cards-and-bonds.md) §7, [04](../game/04-tiers-and-promotion.md) §9).

### Records

Single-value bests, shown on the trainer profile, each with the Uma who set it:

- Highest single stat ever reached.
- Most wins, most G1 wins, and most badge stages by a single Uma.
- Biggest winning margin, and the longest win streak.

### Trainer profile

At `/racing/trophy-hall/trainer`:

- The Trainer's display name (stored with the Trainer's badge preferences, default `Trainer`), with the Stable's badge
  stages and the achievements earned.
- Meters: **Cards bonded x/N**, N the content's cards, and **Umas x/y**.
- The records.
- The Trainer showcase, and the latest flair across the Stable.
- Every achievement, with the same search, filters and sorts as the badge lists.

The Trainer scope (`?scope=trainer`) shows the same without the showcase and the latest flair.

### Engine notes

- Trainer state is the separate versioned `badges/trainer` entity: its aggregates, achievements, records and
  preferences. The Stable scope stays a live aggregation and is not copied into another award collection.
- Every earned stage has one append-only Trainer flair event (`trainer-achievement`).

## Explicitly deferred

- `Duelist`, rushed/spot-struggle feats, and other R4-dependent badges.
- `Upset` until a per-runner rating formula is designed and pinned.
- Phase 9's awards ([rework/10](../rework/10-expeditions.md)): Expedition titles, Clean Sweep, the real-sweep series
  titles, and the Trainer's Around the World.
- Sound, haptics, bespoke badge art, and replacing existing emoji/icons (Milestone 9).
- Social/global rarity, public profiles, sharing, leaderboards, or server-authoritative anti-cheat.
- Currency or progression rewards from flair.
