# World Expeditions

> **Status: approved design, not built yet (phase 9); first written 2026-10-13 (D327, D332).** Every number is a
> **draft** that `pnpm sim:expeditions` and the loop simulation ([12](../game/12-economy-and-pacing.md) §12) tune, then
> pin in tests. The race pools are the [World Expeditions research](../research/world-expeditions.md)'s. What phase 3
> built in its place: the Expedition Map as a placeholder ([11](../game/11-hub-and-places.md) §3.3), a stand-in run
> whose eighth win completes it, reached only by the dev seeds (`tiers/expedition.ts`, [04](../game/04-tiers-and-promotion.md)
> §3), and the Expedition prize rate ([09](../game/09-racing-rewards-and-exchange.md) §2.1). This page moves into the
> manual when phase 9 builds it.

A **World Expedition** is the finale of a tier. Once an Uma has finished her tier's last career, she travels abroad for
an international campaign: one of **13 Expeditions**, each a pool of 8–14 real foreign races on one surface and at two
neighbouring distances. **Eight distinct wins** from the pool complete it, and completing it **promotes** her to the
next tier ([04](../game/04-tiers-and-promotion.md)). Every tier offers all 13. Tier 1 is the base campaign. Tiers 2 and 3 field
stronger rivals and add mechanics.

This page fixes the structure now so that the large authoring job can happen later without a redesign. That job is
136 race families, about 89 new course layouts at 34 new venues, and seven rosters of local champions.

## At a glance

| Thing | Rule (drafts) |
|---|---|
| Who can go | An Uma whose tier's last career is complete: Racing Level 50, every scenario-5 goal won |
| Choice | Any of the 13, in every tier. One active Expedition per Uma; any number of Umas on one Expedition |
| Success | **8 distinct race families won** by this Uma from the Expedition's pool while she is on it |
| Cost | None. No items, tickets or fees. Losing costs only the race |
| Difficulty | Rivals race at **100% / 103% / 106%** of a trained Uma of the tier's last scenario (a home G1: 95%, today's handicap) |
| Tier mechanics | Tier 2: home advantage, fuller fields, finals. Tier 3: adds the going and travel (engine v10) |
| Rewards | Prize Money at 1.5× the G1 rate, an Expedition title, promotion (and one Uma Ticket from tier 1) |
| Target | A fully trained Uma on an Expedition that suits her finishes in about **15–25 races**, about a week of her racing |
| Place | The **Expedition Map** on the Racing page ([11](../game/11-hub-and-places.md)), drawn with uma-art's `tier-finale` building |

## What an Expedition is

The Expedition is the tier's **side-scenario**. Unlike a scenario, it adds no training layer, unlocks or career goals,
and it pays no Racing EXP. She races with the build she has: her tier build at its scenario-5 layer
([03](../game/03-uma-progression.md), one build per tier).

### Entry

- **Her tier's last career is complete:** Racing Level 50 and every career goal of the tier's fifth scenario won
  ([03](../game/03-uma-progression.md)). In tier 3, while it holds four scenarios, that is scenario 14's career
  ([04](../game/04-tiers-and-promotion.md)).
- **Her scenario-5 training layer does not have to be complete.** Racing is never blocked by training (D328), and the
  field is the real gate. Rivals are sized for a fully trained Uma, so an Uma with half her layer wins less often and
  takes longer. Her remaining sessions keep running while she races abroad. The Expedition page shows her layer
  ("Training 18 / 22"), and the planner ([02](../game/02-check-ins-and-notifications.md)) lists what is left.
- Nothing else. An Uma who meets the rule sees **Start Expedition** on every Expedition page. One who does not sees
  why: "Scenario 5 career: 2 of 3 G1s won".

### Choosing

The owner picks from the Map or from the Uma's profile. Every Expedition shows its **fit** for the chosen Uma: how many
of its pool families she runs at **B or better** on both surface and distance, the grade careers already use. An
Expedition **suits** her when its fit is **8 or more**: she can then complete it without racing off-aptitude. The Map
sorts by fit (more A grades first) and stars her best fit. Fit is advice. She may start any Expedition.

### One at a time; switching and pausing

- An Uma has **at most one active Expedition**. Any number of Umas may be on the same one, each with her own run.
- **Switching is free and keeps progress.** Every Expedition she starts gets its own **run** with its own wins.
  Starting another pauses the current run, and returning resumes it with every win intact.
- **A win counts only for the run that was active when the race started**, so a family in two pools
  ([shared races](#shared-races)) counts once. Switching gains nothing, so it costs nothing.
- **Pause** stops the current run without starting another. She can race regular races meanwhile; they never count.

### What counts

A race counts toward her run when all four hold:

1. She **finished first**: a committed, authoritative result, the same test career goals use.
2. The race's family is in the **run's pool**.
3. The run was **active** when she started the race.
4. She has **not already won that family** in this run.

Each family counts once, so repeating a race cannot fill two of the eight. The pool is **frozen when the run starts**,
like a career's targets. A content update may **add** families to an active run (more routes, never a higher bar). A
family that later leaves the content stays runnable for every run that froze it, as retired career targets do (D194).

**Expedition races are run only from the Expedition page, by an Uma on that Expedition.** They are never in Race
Select's regular catalogue, just as D192 already keeps Longchamp out of it. So an Uma early in her tier cannot use the
Expedition's higher prizes.

### Retries

Retries are **free and unlimited**. Losing costs only the race, as with career goals. There is no attempt count,
deadline, entry fee or cooldown. A retry is a new race: a new seed and a freshly rolled field.

### Completion and promotion

- The **eighth distinct win completes** the run. It settles inside that race's commit, like a career goal. The results
  screen shows the eighth stamp, the title fanfare and **Promote**.
- **Promotion is a separate, confirmed action**, available from then on with no deadline. It resets the Uma, so it
  never happens by surprise. What promotion does belongs to [04](../game/04-tiers-and-promotion.md).
- **Until she promotes, she may keep racing her pool.** Wins past eight count toward Clean Sweep
  ([rewards](#rewards)). Prize Money for repeat races follows [09](../game/09-racing-rewards-and-exchange.md)'s anti-grind
  rules.
- Tier 3 has no next tier, and [04](../game/04-tiers-and-promotion.md) owns that endgame. The recommendation to 04: she keeps
  her build and title, and may start any other Expedition for its title alone.

## All regions in every tier

Every tier offers **all 13 Expeditions** (owner's rule, D332). An Uma picks the one that suits her surface and
distances. Bands are the game's: Sprint ≤ 1,400 m, Mile 1,401–1,800, Medium 1,801–2,400, Long ≥ 2,401. The band
columns count the pool's families in each band, which is what fit is made of. **Finals** are the families whose
research role is a final, a championship or a capstone ([finals](#finals)).

| Group | Expedition (id) | Region | Size | Pool | Sprint | Mile | Medium | Long | Finals |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| Dirt Sprint/Mile | United States Speed Championship (`us-speed`) | United States | Grand | 12 | 9 | 3 | | | 3 |
| Dirt Sprint/Mile | South Korean Sprint Circuit (`kr-sprint`) | South Korea | Standard | 8 | 7 | 1 | | | 2 |
| Dirt Mile/Medium | American Dirt Classics (`us-dirt-classics`) | United States | Grand | 12 | | 5 | 7 | | 5 |
| Dirt Mile/Medium | Dubai Dirt Classics (`ae-dirt-classics`) | Dubai | Standard | 9 | | 5 | 4 | | 3 |
| Turf Sprint/Mile | Hong Kong Speed & Mile (`hk-speed-mile`) | Hong Kong | Standard | 10 | 6 | 4 | | | 3 |
| Turf Sprint/Mile | Australian Speed & Mile (`au-speed-mile`) | Australia | Grand | 12 | 9 | 3 | | | 6 |
| Turf Sprint/Mile | British Speed & Mile (`gb-speed-mile`) | Britain | Grand | 12 | 6 | 6 | | | 4 |
| Turf Mile/Medium | British Champions (`gb-champions`) | Britain | Grand | 12 | | 7 | 5 | | 5 |
| Turf Mile/Medium | Hong Kong Crown & Cup (`hk-crown-cup`) | Hong Kong | Grand | 13 | | 6 | 7 | | 5 |
| Turf Mile/Medium | Australian Mile & Championship (`au-mile-championship`) | Australia | Grand | 13 | | 9 | 4 | | 6 |
| Turf Medium/Long | Australian Cups (`au-cups`) | Australia | Grand | 12 | | | 8 | 4 | 6 |
| Turf Medium/Long | British Classics & Stayers (`gb-classics-stayers`) | Britain | Grand | 12 | | | 5 | 7 | 3 |
| Turf Medium/Long | France: Road to the Arc & Stayers (`fr-arc-stayers`) | France/Europe | Grand | 14 | | | 11 | 3 | 6 |
| | **13 Expeditions** | **7 regions** | | **151** | | | | | |

The map's **seven regions** hold one to three Expeditions each: United States 2, South Korea 1, Dubai 1, Hong Kong 2,
Australia 3, Britain 3, and France/Europe 1 (France, plus two Irish races and one German). The 151 pool entries are
**136 distinct families**, because 15 sit in two pools. The ids are checked-in semantic ids; every race fact behind them
is private ([content rules](#private-content-rules)).

### Every aptitude group has a choice

Each of the research's five groups has **at least two** Expeditions. An Uma's career profile ([03](../game/03-uma-progression.md),
today's [Scenario Careers](../design/scenario-goals.md)) is her surface and two neighbouring distances. The table shows
which Expeditions suit an Uma with A in both of her profile's distances, counting fit from the band columns above:

| Profile | Suited Expeditions (fit ≥ 8) | Count |
|---|---|---:|
| Turf Sprint · Mile | Hong Kong Speed & Mile, Australian Speed & Mile, British Speed & Mile, Australian Mile & Championship (9 miles) | 4 |
| Turf Mile · Medium | British Champions, Hong Kong Crown & Cup, Australian Mile & Championship, Australian Cups (8 Medium), France (11 Medium) | 5 |
| Turf Medium · Long | Australian Cups, British Classics & Stayers, France | 3 |
| Dirt Sprint · Mile | United States Speed Championship, South Korean Sprint Circuit | 2 |
| Dirt Mile · Medium | American Dirt Classics, Dubai Dirt Classics | 2 |
| Dirt Medium · Long | **None.** Best fit: American Dirt Classics, 7 from Medium alone ([edge cases](#edge-cases)) | 0 |

Single-distance specialists are covered too: a pure turf sprinter by Australian Speed & Mile (9 sprints), a pure turf
miler by Australian Mile & Championship (9 miles), a pure Medium turf Uma by France (11) or Australian Cups (8), and a
pure dirt sprinter by the United States Speed Championship (9).

### Shared races

The 15 shared families are allowed in both pools, rather than each assigned to one Expedition. Assigning them would
break the eight-win rule: British Speed & Mile and Hong Kong Speed & Mile would each keep only 7 families.

| Region | Families | Pools |
|---|---|---|
| Hong Kong | Jockey Club Mile, Champions Mile, Hong Kong Mile | Speed & Mile · Crown & Cup |
| Australia | Doncaster Mile, King Charles III Stakes (Randwick), Champions Mile | Speed & Mile · Mile & Championship |
| Australia | Ranvet Stakes, Queen Elizabeth Stakes, Cox Plate | Mile & Championship · Cups |
| Britain | 2000 Guineas, Lockinge Stakes, Queen Anne Stakes, Sussex Stakes, Queen Elizabeth II Stakes | Speed & Mile · Champions |
| Britain | King George VI & Queen Elizabeth Stakes | Champions · Classics & Stayers |

**Every shared family is shared inside one region.** Mechanics take their numbers from the region ([tiers](#tiers)),
so a shared race behaves the same whichever pool she runs it for. A shared family is one race, with one course, one
prize and one "Final" flag, and its card says "Also in British Champions".

Some different races share a name across regions: King Charles III Stakes (Ascot 1,000 m, Randwick 1,600 m),
Champions Mile (Sha Tin, Flemington) and Sprint Cup (Sha Tin, Haydock). Each is its own family with its own private
id. Race Select's same-name collapse (D192) never applies to Expedition races, and cards add the venue when two
Expeditions show the same name.

## Tiers

Every Expedition in a tier follows the same rules, and the **region sets the numbers**: field sizes, the odds of the
going, the time zone. So the owner learns three rule sets and seven flavours, not 39 combinations.

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Field strength (share of a trained Uma of the tier's last scenario) | **100%** | **103%** | **106%** |
| Runners | 12 | 14 | The race's real field, up to 18 (Hong Kong 14) |
| Local champions | One per race, at field strength | **Home advantage**; two in finals | As tier 2 |
| Finals | Open | **Open after 4 wins** in the run | As tier 2 |
| The going | Good, sunny (today's fixed values) | Good, sunny | **Rolled per race** from the region's odds |
| Travel | — | — | **Jet lag** on arrival |
| Courses and seasons | Real layouts, local seasons | Same | Same |
| Engine | v9 (today's) | v9 | **v10** |

Tier 2's and tier 3's shares sit on top of [04](../game/04-tiers-and-promotion.md)'s tier scaling: a tier-2 field is built on
a scenario-10 Uma, who is already stronger than a scenario-5 one.

### The mechanics catalogue

Each idea was weighed on four tests: can the owner read it in one line before the race, does it need engine work, does
it fit the free-time racing mode, and does it carry regional flavour.

| Mechanic | What it does | Engine | Tier | Verdict |
|---|---|---|---|---|
| **Home courses** | Each race runs on its venue's own layout: direction, corners, straights, hills, and straight courses for British and Flemington sprints | None. Layouts (v3), hills (v5) and the straight fallback exist | All | Adopted: it is the content |
| **Local seasons** | Each race carries its local season, so seasonal skills fire as they would there (Australia's spring is September to November) | None. `course.season` is an input already | All | Adopted |
| **Local champions** | Named international rivals in every field ([below](#local-champions)) | None. Rival generation is domain code | All | Adopted |
| **Home advantage** | Local champions race at +5%, every stat rolled 90–100% (other rivals 80–100%) | None. A preset and a roll | 2, 3 | Adopted |
| **Fuller fields** | 12 runners, then 14, then the race's real field | None. The engine takes 18 runners and templates carry `fieldSize` | 2, 3 | Adopted |
| **Finals** | A pool's finals open after 4 wins in the run, and field two local champions | None. A domain gate | 2, 3 | Adopted: the qualifier idea, simplified |
| **The going** | Firm, Good, Soft or Heavy, with weather, rolled per race. Changes HP drain, Speed and Power, and ground and weather skills | **New engine version, v10.** Ground and weather are fixed at Good and sunny today (`FIXED_GROUND_CONDITION`, `FIXED_WEATHER`) | 3 | Adopted |
| **Travel** | Her first race or two after arriving in a region roll her mood one level lower | **v10.** Mood is rolled inside the engine from the seed today, with no input to shift it | 3 | Adopted |
| Back-to-back fatigue | Races close together carry fatigue into the next | v10 mood shift | — | **Rejected.** It punishes the free-time racing mode, which the game is built to reward |
| Handicap weights | The top-rated runner carries extra weight, as in real handicaps | New physics with no source in the original | — | **Rejected.** Every number would be invented, and it penalises the owner's best Uma |
| Season windows | Races open only in their real months | None | — | **Rejected as windows,** which would lock races for months. Kept as local seasons |
| Qualifier ladders | Win named legs to enter a named final | None | — | **Replaced by Finals.** Per-final ladders cut the alternate routes that make a pool deeper than eight |

#### Local champions

- **Invented international Umas**, each with a name, region, surface, home bands, running style and ring colour. None
  is a real horse or a real person ([rosters](#local-champion-rosters)).
- **Who runs.** Champions are drawn from the region's roster whose surface matches and whose bands include the race's
  distance, seeded like the rest of the field and never twice in one field. The other rivals come from every Uma in the
  game, as today (D153), so a field reads as Japan's stars on tour against the locals.
- **How many and how strong.** Tier 1: one a race, at the Expedition preset and rolled 80–100% like everyone else.
  Tiers 2 and 3: one in a prep and two in a final, with **home advantage** (5% above the preset, rolled 90–100%).
  Aptitudes are A, like every rival.
- **Skills.** Not being in the game's roster, they have no unique. Each carries **one gold and three to seven whites**,
  rolled the way D163 rolls whites: from skills that can fire on this course.
- **On screen.** With no stand art, the face ring holds the region's crest in her colour (new small art,
  [11](../game/11-hub-and-places.md)). She is tagged "Local champion" in the pre-race field, the feed and the results.

#### Finals

At tiers 2 and 3, a pool's finals open after **4 wins in the run**. Until then a final shows locked with "Opens after 4
wins". A final also fields two local champions. "Final" belongs to the family, not the pool, so a shared family is a
final in both of its pools or in neither. Every pool keeps **at least 6 non-finals**, so four wins can always come
first; the importer checks it. Each campaign gets an arc, preps then finals, without per-race ladders.

#### The going (tier 3)

Each tier-3 Expedition race rolls its going from the race seed, with its region's odds, and shows it before the race.
Weather follows the going: Firm is sunny, Good is cloudy, and Soft and Heavy are rainy.

| Region | Firm / Good / Soft / Heavy (draft odds) | Jet lag races |
|---|---|---:|
| United States (dirt) | 55 / 30 / 10 / 5 | 2 |
| South Korea (dirt) | 45 / 35 / 15 / 5 | 0 |
| Dubai (dirt) | 75 / 20 / 5 / 0 | 1 |
| Hong Kong | 30 / 50 / 15 / 5 | 0 |
| Australia | 20 / 45 / 25 / 10 | 0 |
| Britain | 15 / 45 / 30 / 10 | 2 |
| France/Europe | 10 / 45 / 35 / 10 | 2 |

What the going changes, all from the original:
- **HP drain**, by the original's coefficients: turf 1.0 / 1.0 / 1.02 / 1.02, dirt 1.0 / 1.0 / 1.01 / 1.02
  ([race mechanics](../research/race-mechanics.md), ⚠️ to verify).
- **Flat Speed and Power changes** from the original's ground table, which the research still lists as open and must
  settle before v10. v10 applies them relative to Good, so a Good race is exactly today's race.
- **Skill conditions:** `ground_condition` and `weather` read the race's values instead of the fixed Good and sunny, so
  wet-ground and weather skills finally matter.

The going treats the whole field alike apart from skills and Power. It makes a different race, not a harder one.

#### Travel (tier 3)

Her **location** is the region of her last race; regular races are in Japan. Her first race in a region away from her
location is an **arrival**. On that race, and on the next ones the "Jet lag races" column counts, her mood rolls **one
level lower**: Great becomes Good, and Awful stays Awful. The column follows the time difference from Japan: none for
South Korea, Hong Kong and Australia (two hours or less), one race for Dubai (five hours), and two for Europe and the
United States (seven hours or more).

Switching between two Expeditions in one region is not an arrival; racing at home in Japan and then returning is. So
the mechanic rewards staying on tour. It costs a few percent on one or two races and never blocks. Location is derived
from her race history, so it needs no new save field.

#### Engine v10

Tier 3 needs one new engine version. Tiers 1 and 2 run on today's v9.

| Input | Type | Effect |
|---|---|---|
| `course.going` | `'firm' \| 'good' \| 'soft' \| 'heavy'`, optional | HP coefficient, Speed and Power changes relative to Good, and the `ground_condition` skill variable |
| `course.weather` | `'sunny' \| 'cloudy' \| 'rainy' \| 'snowy'`, optional | The `weather` skill variable only |
| `runner.moodShift` | −2 … +2, optional | Added to her rolled mood and clamped to −2 … +2. The roll's own stream is unchanged, so nothing else in the race moves |

When an input is absent, v10 behaves exactly as v9. All new races run on v10 and v9 records replay on v9, as with
every engine bump (D231, D240). A test runs the `sim:turns` corpus on v10 with no going and no shift and requires
results identical to v9's. v10 is needed only when the first Uma reaches tier 3's Expedition, not before she finishes
tier 2.

## Difficulty

### Fields

Fields are rolled as today ([Racing — presets](../design/racing.md#presets), D153, D159). Each style takes two to
five rivals, every stat is rolled 80–100% of a preset, and each rival carries her Lv5 unique and three to seven whites.
An Expedition changes three things: the **preset**, the **field size** and the **local champions**.

```
expeditionPreset(tier, distance, style) = rivalPreset(lastScenario(tier), EXPEDITION_SHARE[tier], distance, style)
EXPEDITION_SHARE  = tier 1: 1.00 · tier 2: 1.03 · tier 3: 1.06       (a G1's share is 1 − 0.05 = 0.95)
localChampion     = expeditionPreset × (1 + HOME_ADVANTAGE[tier]), every stat rolled 90–100%
HOME_ADVANTAGE    = tier 1: 0 · tiers 2–3: 0.05
lastScenario(t)   = 5, 10, 15 (14 in tier 3 until the 15th ships)
```

`rivalPreset` is today's formula with the grade handicap replaced by the share. [04](../game/04-tiers-and-promotion.md) owns
the trained Uma it is built on for the rework, and each scenario's caps still bound every stat.

**One class for every Expedition race.** The real races are local G1s, G2s, G3s and Listed races, but a G3 abroad is
no softer here: every Expedition race uses the Expedition share. The local grade reaches the engine only as its
`grade` skill condition, with Listed read as OP.

**Why these shares.** A fully bonded build wins 80–100% of today's G1s against fields at 95%
([difficulty target](../design/racing.md#difficulty-target)). Rivals and handicaps stay exactly as today (D336,
[03](../game/03-uma-progression.md) §9), and a fully trained Uma in the rework carries every card at today's maximum (D329), so
at 95% an Expedition would be a formality. At 100%, with one local champion in 12 runners, the draft aims at about 45%
a race. Tiers 2 and 3 add strength, runners and mechanics for about 40% and 35%. The sim sets the shares, and each is a
one-line change, like the grade handicaps.

### Targets

| Measure (`pnpm sim:expeditions`) | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Win rate a race: fully trained, best-fit Expedition, fit ≥ 8 | 40–50% | 35–45% | 30–40% |
| Races to complete, median | 15–20 | 17–23 | 20–25 |
| Races to complete, 90th percentile | ≤ 30 | ≤ 32 | ≤ 35 |
| The same Uma with 75% of her tier's unlocks, median | ≤ 40 | ≤ 40 | ≤ 40 |
| A race at C on surface or distance, win rate | < 10% | < 10% | < 10% |

With a win rate *p* a race, eight distinct wins take about 8 / *p* races: 18 at 45%, 20 at 40% and 23 at 35%. That
makes **15–25 races**, and at about three races a day, a week of her racing.

**The sim.** For each tier, it takes every Uma in the private roster whose profile has a suited Expedition, gives her
[05](../game/05-training-hub.md)'s full tier build of the last scenario, and runs a greedy campaign on her best fit: always the
open, unwon family she is best at, with the best of four styles. It runs 200 campaigns a cell, prints medians,
percentiles and win rates by tier and by region, and fails CI outside the bands above. It also reports, as counts
only, how many roster Umas have no Expedition with fit 8 or more.

**Roster cost (for [12](../game/12-economy-and-pacing.md)).** Twenty-five Umas at about 20 races each is about 500 Expedition
races a tier, roughly 8 hours of racing at about a minute a race with Skip. Entry does not wait for a finished training
layer, so this racing overlaps scenario 5's last weeks of training rather than adding weeks to the tier.

## Rewards

| Reward | Rule |
|---|---|
| **Prize Money** | Every Expedition race pays **1.5× the G1 row** of the tier's table, whatever its local grade: **450 / 180 / 90** for 1st / 2nd / 3rd at the README's drafts. She wins about 45% abroad against 80–100% of home G1s, so a race pays about the same either way: the Expedition is not a farm. [09](../game/09-racing-rewards-and-exchange.md) owns the table, repeats and anti-grind |
| **Racing EXP** | **None.** She is at Racing Level 50, the tier's cap, so there is nothing to level, and nothing is converted. The Prize Money rate is the race's payment |
| **Expedition title** | One per Expedition, earned at completion: 10 Prestige ([titles](../design/badges.md#4-titles-and-g1-trophies)). Completing the same Expedition again in a later tier earns Two-Time or Three-Time, as G1 repeats do |
| **Clean Sweep** | A hidden one-off badge for winning every family of the pool in one run, before promoting. 4 Prestige |
| **Series titles** | Real sweeps inside pools, mapped in the flair override: US Triple Crown, Hong Kong Triple Crown, Hong Kong Four-Year-Old Series, Hong Kong Speed Series, Korea Sprinter Series, and the Caulfield–Melbourne Cups double |
| **Venue badges** | The dynamic **[Venue] Regular** badges cover the new venues by venue key. Grand Tour stays the ten JRA main venues |
| **Trainer achievement** | **Around the World**: distinct Expeditions completed across the stable, 1 / 3 / 6 / 9 / 13 |
| **Promotion** | [04](../game/04-tiers-and-promotion.md). Promotion from tier 1 also pays one account **Uma Ticket** (README, 04) |

There is no completion purse: promotion is the prize. Titles carry through promotion with the account (D327). Working
title names, which the owner may rename: American Speed Queen, Korean Sprint Queen, American Classic Queen, Desert
Classic Queen, Hong Kong Speed Queen, Australian Speed Queen, British Speed Queen, Champions Queen, Hong Kong Crown
Queen, Australian Mile Queen, Queen of the Cups, British Stayer Queen and French Classic Queen, in the table's order.

## Places and screens

### The Expedition Map

- A **place on the Racing page**; [11](../game/11-hub-and-places.md) owns the Hub, routes and the art list. Its building is
  uma-art's **`tier-finale`** (`buildings/atlas.json`, `page: "town"`, 48×48), already drawn as the tier's finale.
- **Always visible.** Before any Uma is eligible, it opens with "No Uma has finished her tier yet" and each Uma's
  distance to entry ("Scenario 4 · Racing Lv 37").
- **The map** is a stylised world map (a new drawing on 11's list) with **seven region pins**. A pin shows the region's
  crest, its Expeditions, and a chip for each Uma on them: her face, tier crest and wins ("5/8"). Paused runs are dimmed.
- **An Uma picker** in the thumb zone recolours the pins by that Uma's fit (suits, partial, poor) and stars her best fit.
  A **list view** for one-handed use shows the 13 grouped by surface and distance, with fit and the Umas on each.

### The Expedition page

| Section | Shows |
|---|---|
| Header | Name, region, surface, its two bands, pool size, "8 wins to complete" |
| **Her run** | Eight stamps, races run, started date. Start, Resume or Pause; Promote once complete |
| **Next races** | Up to five open, unwon families she suits best (A first), each with its local grade, venue, distance (furlongs beside metres where the race is published in them), her aptitudes, prize, and Final or Shared tags. At tiers 2–3, finals show locked until four wins |
| **Pool** | Every family. Won ones carry their stamp, date and a link to the result |
| **In effect** | Her tier's rules: field strength, runners, local champions, finals, and at tier 3 the going's odds and jet lag |
| **Training** | Her scenario-5 layer ("18 / 22") and a link to the planner ([02](../game/02-check-ins-and-notifications.md)) |
| **Umas here** | Every Uma on this Expedition, with her wins |

### Pre-race, race and results

- **Pre-race:** "Counts toward Hong Kong Speed & Mile · 5/8", "Already won in this run" or "Not counted: you are on
  British Champions"; the local champions by name and the field size; at tier 3, the going, the weather and "Jet lag:
  mood one level lower" when it applies.
- **Race:** today's race screen on the authored course; at tier 3 a Soft or Heavy course is drawn wet (a palette change).
- **Results:** the stamp and Prize Money; on the eighth win, the title fanfare and **Promote**, which opens 04's confirm
  sheet. A loss offers **Retry**.
- **Planner:** an Uma at this stage reads "Expedition 5/8 · next: \<race\>", plus any training left
  ([02](../game/02-check-ins-and-notifications.md)). No push notification is needed: racing is active play.

## Save

Each Uma holds her Expedition state in her tier state, in the generation-2 save ([13](13-removals-and-plan-changes.md)):

```ts
interface ExpeditionState {
  activeId: ExpeditionId | null
  runs: Partial<Record<ExpeditionId, ExpeditionRun>>
}

interface ExpeditionRun {
  expeditionId: ExpeditionId     // checked-in semantic id, e.g. 'hk-speed-mile'
  tier: 1 | 2 | 3
  startedAt: string              // ISO time
  contentVersion: string         // the private content version the pool was frozen from
  pool: string[]                 // private race-family ids, frozen at start; content additions merge in
  wins: Record<string, string>   // family id → result id of the first win in this run
  completedAt: string | null     // set by the eighth distinct win
}
```

- **Race results** gain an `expedition` snapshot: the Expedition id, the tier, the family counted (or null), the field
  size, the local champions, and at tier 3 the going, weather and mood shift. It makes replays exact and lets `wins` be
  rebuilt from the results log. Starts and location are derived from results, so they are not stored.
- **Progress settles in the race's commit**, before Prize Money, as goals do: one transaction, and a retry returns the
  stored ids without awarding or animating again.
- **Two devices** merge wins as a union by family, keeping the earliest result id; `completedAt` keeps the earliest
  time. Completion is idempotent.
- **It ends at promotion.** Promotion ([04](../game/04-tiers-and-promotion.md)) writes a summary of every run into her tier
  history (Expedition, wins, races, completed or not) and clears `ExpeditionState`. Race results, titles and badges
  stay where they live.

## Content to author

The structure above is fixed; this content can be authored later without changing it.

### Race families

**136 families.** For each, the private overlay holds a canonical family id and its display name without sponsor; its
region, venue and surface; its distance in whole metres (plus furlongs where published so) and so its band; its local
grade and local season; its real maximum field, up to 18; whether it is a final; and which pools hold it.

### Venues and course layouts

| Expedition | Families | Venues (* in the platform's master data) | New layouts |
|---|---:|---|---:|
| United States Speed Championship | 12 | Churchill Downs, Belmont Park, Saratoga, Del Mar, Keeneland, Santa Anita Park* | 9 |
| American Dirt Classics | 12 | Churchill Downs, Pimlico, Belmont Park, Monmouth Park, Saratoga, Parx, Gulfstream Park, Del Mar, Santa Anita Park* | 11 |
| South Korean Sprint Circuit | 8 | Seoul, Busan-Gyeongnam | ~5 |
| Dubai Dirt Classics | 9 | Meydan | 3 |
| Hong Kong Speed & Mile | 10 | Sha Tin | 3 |
| Hong Kong Crown & Cup | 13 | Sha Tin | 3 more |
| Australian Speed & Mile | 12 | Flemington (straight and round), Moonee Valley, Randwick, Doomben, Eagle Farm | 9 |
| Australian Mile & Championship | 13 | Flemington, Caulfield, Rosehill Gardens, Randwick, Moonee Valley | 6 more |
| Australian Cups | 12 | Flemington, Rosehill Gardens, Randwick, Doomben, Moonee Valley, Caulfield, Eagle Farm | 8 more |
| British Speed & Mile | 12 | Ascot, Newmarket (Rowley Mile and July Course), York, Haydock Park, Newbury, Goodwood | 11 |
| British Champions | 12 | Newmarket, Newbury, Ascot, Goodwood, Sandown Park, York | 4 more |
| British Classics & Stayers | 12 | Epsom Downs, Ascot, York, Goodwood, Doncaster | 8 more |
| France: Road to the Arc & Stayers | 14 | Longchamp*, Chantilly, Saint-Cloud, Leopardstown, The Curragh, Baden-Baden | 9 |
| **All 13** | **136** | **36 venues: 34 new, 2 in master data** | **about 89** |

"More" counts only layouts an earlier row of the same region has not already needed. By region: United States 20,
South Korea about 5, Dubai 3, Hong Kong 6, Australia 23, Britain 23, France/Europe 9.

- **Reused (4 layouts).** The platform's master data has **Longchamp** (one turf course, 2,400 m) and **Santa Anita
  Park** (uma-platform P32: dirt 1,200–2,000 m and turf 1,000–2,400 m, left-handed). The Expeditions reuse Longchamp
  2,400 m and Santa Anita's dirt 1,200, 1,600 and 2,000 m. Longchamp still needs 1,850, 2,100, 3,100 and 4,000 m.
- **The Breeders' Cup runs at Santa Anita Park** in the game. The real race moves between hosts, and Santa Anita hosts
  it most often. Fixing it there means the BC Sprint, BC Dirt Mile and BC Classic need no new layout.
- **About 11 layouts are straight courses** (Ascot, Newmarket, York, Haydock, Newbury, Flemington). These need a length
  and hills only, since the engine's straight fallback exists (R3).

**How layouts are authored.** They go in a private overlay, `content/overrides/expedition-courses.json`: gitignored,
Claude-maintained like `flair.json` (D107), in the master data's course shape (length, surface, direction, corners,
straights with front types, slopes). Venue rows add a name, region and crest key.
- **Source and precision:** approximations from public track maps and official course guides, with corners and
  straights within about 25 m and hills by sign and rough grade. That is enough for v8 and v9's corner and hill physics.
- **Fail closed:** the importer rejects a family with no layout, so no race silently runs on a made-up oval (research
  item 3). An Expedition opens only when **every** family in its pool is authored.
- **Order**, cheapest first: Dubai, Hong Kong, South Korea, France/Europe, United States, Australia, Britain. The owner
  reviews each region in the preview as it lands.
- **Deadline:** all 13 before the first Uma completes tier 1's last career, since every region must be offered in
  every tier. [12](../game/12-economy-and-pacing.md)'s timeline puts that about 16–20 weeks after the new game starts.

### Local champion rosters

Seven regions with **8–12 champions each, about 70 in all**, each with a name, region, surface, home bands, running
style and ring colour. **Names are original inventions:** Claude checks each against public race records and drops any
that matches a real horse. They live in the private overlay with the rest of the pack, so the pack has one authoring
place. **Seven region crests**, for the Map pins and the champions' face rings, go on [11](../game/11-hub-and-places.md)'s list.

### Private content rules

- **Private:** every real-world race fact (names, venues, distances, dates, grades, field sizes, layouts), the
  champions, and anything from the original game. These stay in the gitignored `content/` folder and the private bucket,
  served only through the authenticated API (CLAUDE.md's ground rules).
- **Checked in:** the semantic Expedition and region ids, the Expedition names (our curation, already in the research
  doc), the rules (eight wins, shares, field sizes, finals, mechanics, the going's odds, jet lag), and the title and
  badge definitions by semantic id.
- **Tests use synthetic Expeditions**, with synthetic families, venues and champions, as race tests already use
  synthetic courses. The importer's coverage report gives **counts only**, like the flair override's.

### The research's open items

| # | Item | Decision | Owner |
|---|---|---|---|
| 1 | Source and licensing audit | Every imported or researched fact, layout and champion lives in the private overlay and bucket. Checked-in tests are synthetic | Claude, at import |
| 2 | Race-year normalisation | One canonical family per race: a stable private id, its name without sponsor, and its traditional home venue and distance. Temporary venues (Belmont racing at Saratoga, Pimlico's rebuild) and race-year variants are not modelled; the importer keeps source history privately | Claude |
| 3 | Course geometry inventory | 36 venues and about 93 layouts, 4 of them reused. Authored approximations that fail closed; the Breeders' Cup fixed at Santa Anita Park | Claude authors; the owner reviews each region |
| 4 | Band boundaries | The authority's conventional metric distance in whole metres (7 f = 1,400, 1⅛ mi = 1,800, 1½ mi = 2,400), then the game's bands. Furlongs show beside metres | Decided here |
| 5 | Pool ownership | Shared families allowed: 15, each in two pools of one region. A win counts for the run active when the race started | Decided here |
| 6 | Eligibility | Age, sex and restricted-bred conditions are ignored. Every Uma may run every race | Decided here |
| 7 | NPC content | Generic rivals as today, plus invented local champions. No real foreign horses | Decided here |
| 8 | Name collision | The feature is **World Expeditions**. [04](../game/04-tiers-and-promotion.md) renames Project L'Arc's "Expedition" buff | 04 |
| 9 | Scenario context | A tier side-scenario. She races with her one tier build ([03](../game/03-uma-progression.md)), so there is no earlier unit to choose. Results are tagged with the Expedition. No EXP | Decided here |
| 10 | Implementation design | This page: lifecycle, save, rewards, retries and accomplishments | Done |

## Edge cases

- **An Uma with no suited Expedition.** No foreign scene runs dirt races past 2,400 m in depth, so Dirt Medium · Long
  has no Expedition. Pure turf stayers (British Classics & Stayers has 7 Long families) and pure dirt milers (5 miles
  at most) also top out below 8. Such an Uma takes her best fit and wins the last one or two families at her next-best
  distance. For a dirt Medium · Long Uma that is American Dirt Classics: 7 Medium families plus one 1,800 m race, and
  she is usually B at a Mile. The Map says "No Expedition suits her fully. Best: American Dirt Classics, 7 of 12". If a
  Lineage Hall slot raises an aptitude ([05](../game/05-training-hub.md)), her fit updates at once. The sim counts this group.
  There is no 14th Expedition, because no real scene would carry it.
- **An Uma who completes tier 3's Expedition** reaches the end of the climb, which [04](../game/04-tiers-and-promotion.md)
  owns; the recommendation is above.
- **Shared races** count once, for the run active when the race started, even if she switches mid-race. A shared
  family won on British Champions is not stamped in British Speed & Mile.
- **A promoted Uma** arrives in her next tier with no Expedition state. Her old runs are history, and her chip appears
  on the Map only once she starts a new one. **An Uma bought mid-tier** does nothing special.
- **Racing at home during an Expedition** pays as usual ([09](../game/09-racing-rewards-and-exchange.md)) and counts for
  nothing. At tier 3 her next race abroad is an arrival.
- **Content changes during a run.** Additions merge into the frozen pool. A family that leaves the content stays
  runnable for her run, and a won family is never removed.
- **Offline.** Expedition races simulate and commit locally, like every race, once the Expedition pack is cached. If
  it is not, the Map shows "Connect once to download Expeditions", and races cannot start.
- **A stale page** (another device finished the run) refreshes on the next commit. A race started from it counts by
  the saved run, not the page, and Promote checks the saved run ([04](../game/04-tiers-and-promotion.md)).
- **Aptitudes change during a run** (a new Lineage Hall unlock): fit recomputes live, and the run is unaffected.
- **A 0-stock Warehouse** has no effect: Expeditions use no items. **Two Umas on one Expedition** have independent
  runs, and each race rolls a fresh field.

## Decided here

1. **Entry:** the tier's last career complete. The scenario-5 training layer is **not required** (D328); the field is
   the gate.
2. **One active Expedition per Uma**, any number of Umas per Expedition. **Switching is free** and keeps each run's
   wins; a win counts only for the run active when the race started. Pause is allowed.
3. **What counts:** first place in a family of the run's frozen pool, once per family. Additions merge in; nothing won
   is removed.
4. **Expedition races** are run only by Umas on that Expedition, never from the regular catalogue. **Retries** are free
   and unlimited, with no entry cost of any kind.
5. **The eighth win completes the run; promotion is a separate, confirmed action** with no deadline. Racing on until
   then counts toward Clean Sweep.
6. **All 13 in every tier**, with the semantic ids in the table above. **Fit** counts pool families at B or better on
   surface and distance; an Expedition **suits** at fit 8.
7. **Shared families are allowed** (15, each in two pools of one region), not assigned to one Expedition.
8. **Mechanics are tier rules with regional numbers.** All tiers: home courses, local seasons, local champions. Tier 2:
   home advantage, 14 runners, finals after 4 wins. Tier 3: adds real fields up to 18, the going and travel.
   **Rejected:** handicap weights, back-to-back fatigue, real-time season windows, per-final qualifier ladders.
9. **Engine v10** adds optional going, weather and mood-shift inputs. Without them it is identical to v9. Only tier 3
   needs it.
10. **Field strength** is 100 / 103 / 106% of a trained Uma of the tier's last scenario, one class for every Expedition
    race. Local champions get +5% and a 90–100% roll at tiers 2–3, and one gold plus 3–7 whites.
11. **Prize Money is 1.5× the G1 row** (450 / 180 / 90 at the README's drafts; [09](../game/09-racing-rewards-and-exchange.md)
    owns it). **No Racing EXP** abroad, and no completion purse.
12. **Rewards:** a title per Expedition (10 Prestige, with Two-Time and Three-Time), a hidden Clean Sweep badge, six
    real-sweep series titles, and the Around the World Trainer achievement.
13. **The Map** is a Racing-page place drawn with uma-art's `tier-finale`. It needs a new world map and seven crests.
14. **Content:** one canonical course per family; the Breeders' Cup at Santa Anita Park; conventional metric
    distances; real eligibility conditions ignored; authored layout approximations in a private overlay that fails
    closed; about 70 invented local champions. An Expedition opens only when its whole pool is authored, and all 13
    are ready before the first tier-1 finale.
15. **Dirt Medium · Long gets no Expedition.** Its Umas take their best fit.
16. **The Expedition state ends at promotion**, summarised into her tier history.
| Until phase 9 the Expedition Map is a placeholder: each Uma's distance to entry ("Scenario 4 · Racing Lv 37"), "Ready for her World Expedition. Expeditions open in a later update; she keeps racing, and nothing is lost." when she could start, and Promote for one already holding a completed run. It shows no Start, pool, region, fit, Expedition, prize or date, its sub-routes go back to the Map, and nothing writes Expedition state (T141) | [13](13-removals-and-plan-changes.md) §4 and "Entry": phase 9 replaces D340's stand-in run without a migration |

## Done when

1. The Expedition Map is on the Racing page with the `tier-finale` building. It shows all 13 Expeditions on seven
   region pins in every tier, with each Uma's runs and wins, at 390×844 in the preview.
2. An Uma whose tier's last career is complete can start any Expedition, and anyone else sees what is missing. The
   page shows her fit, suits and best fit for every Expedition.
3. Domain tests on synthetic Expeditions pin: the eight-win threshold; once per family; counting only for the run
   active at race start; frozen pools with additions merged in; switching that keeps wins; finals locked until four
   wins at tiers 2–3; fields of 12 / 14 / real up to 18; shares 1.00 / 1.03 / 1.06; home advantage +5% with a 90–100%
   roll; and no Racing EXP.
4. The eighth win completes the run in the same transaction as the result. A retried commit returns the stored ids
   with no second fanfare. Two devices' wins merge by family.
5. Promote appears only on a completed run and confirms before acting. Promotion clears the Expedition state into her
   tier history (04's tests).
6. Expedition races never appear in Race Select's regular catalogue, and Umas not on the Expedition cannot enter them.
7. `pnpm sim:expeditions` holds every band in [Targets](#targets) for every tier, and reports, as counts, the Umas
   with no fit of 8 or more.
8. Engine v10: the `sim:turns` corpus with no going and no mood shift gives results identical to v9's. The going's HP,
   stat and skill effects and the mood shift are pinned in race tests. v9 records replay on v9.
9. The importer fails closed on any pool family without a layout, venue, season, field size or final flag, and reports
   coverage as counts only. No race fact, layout or champion name is in git.
10. The titles, Clean Sweep, the six series titles and Around the World award with fanfare and carry through
    promotion.
11. Results with an Expedition snapshot replay exactly, including the field, champions, going and mood shift.
