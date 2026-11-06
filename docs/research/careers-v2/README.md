# Careers v2: distance groups, full race calendars, presets and tickets

> **Status: proposal (2026-11-05),** from the owner's first playtest of generation 3. Not built. Its defaults are the
> ones §8 recommends; the coordinator logs them as D390. Two parts are already written up:
> - the stages: [swappable stages](swappable-stages.md), packet [T160](../../tasks/T160-swappable-stages.md);
> - the card gating: T161, built (D392, [02](../../game/02-unlocks.md) §4);
> - the URA Finals as an announced course and its conditions, after the owner's follow-up: [finale events](finale-events.md), packet [T164](../../tasks/T164-race-conditions.md) (D395).
>
> The visual summary is [previews/careers.html](previews/careers.html). Every number here comes from a rule in the code,
> a sim already recorded in a decision, or an aggregate count over the private pack (§9). No race ids or private
> field values appear.

## The feedback

The owner, 2026-11-05:
- "We need to flesh out careers a lot more in terms of racing… Umas should have at least 2 specialized types of
  running styles based on their aptitudes." The examples are distance groups:
  - **Long** Umas (Long and Medium at A) "can run all the G1 long races as well as G1 medium races, that way they can
    run the Triple Crown and also the Long Triple Crown";
  - **Mile + Medium** Umas: "the Triple Tiara, Mile Crown (if any) and some additional medium races";
  - **Sprint + Mile** Umas: "focus on Sprint and Mile G1s".
- "In the past we used to have distance aptitude presets that would let me set card sets, stats and inheritance per
  running distance, that way I could mix and match between Long and Medium races."
- "Maybe we do a lot of training upfront in the career and then the Uma races all the career at their 'max stats', as
  those runs overall would be more fun."
- "Cards should be locked on a per-scenario basis."
- "Not sure how to earn card unlock tickets and Uma unlock tickets, or if that's coming later."

## At a glance

| | Today (M036) | Careers v2 |
|---|---|---|
| What frames a career | Her best two neighbouring distances (`careerProfile`) | **Her distance group**, picked at the start from the ones she qualifies for (§1) |
| Her objectives | 6: a G3, two G2s, three G1s, placed by a generator | **Her group's calendar:** 13–14 objectives, mostly G1s and their trials, plus optional races (§2) |
| Races in a career | 9 (6 + the URA Finals) | **16–17** (13–14 + the URA Finals), plus up to 16 optional |
| Plays in a career (once through at A) | 13, spread over the calendar | **13, front-loaded:** 9 in the Junior training block, 1 before her first race, 1 each summer camp, 1 at the Finale (§4) |
| Her stats at her first race | About half her Finale's | **About 80%;** 86% through Classic, 93% in Senior (§4.2) |
| Decks | One | **One preset per distance in her group:** deck, posts and running style (§3) |
| Card Tickets a career | 1 per objective, 2 at the Finals: 8 | **1 per crown won, 2 at the Finals: 3–6** (§5) |
| Uma Tickets a career | 1 at the Finals | Unchanged |
| The Card Library | Unlocks any era | Only eras whose scenario is open; later cards returned (§6, T161) |

## 1. Distance groups

### 1.1 The three groups

| Group | Its distances | Its crowns (the overlay's series) | Its calendar |
|---|---|---|---|
| **Sprint · Mile** | Sprint, Mile | Sprint Crown, Mile Crown | §2.2 c |
| **Mile · Medium** | Mile, Medium | Triple Tiara, Mile Crown; the Dirt Crown on dirt | §2.2 b, and the dirt calendar §2.2 d |
| **Medium · Long** | Medium, Long | Triple Crown, Senior Spring Triple Crown, Senior Autumn Triple Crown, Grand Prix | §2.2 a |

The groups are today's `CAREER_BANDS` (`sprint-mile`, `mile-medium`, `medium-long`), so the type stays.

**"The Long Triple Crown"** is read, as asked, as the two Senior triple crowns: the Spring (Osaka Hai, Tenno Sho
Spring, Takarazuka Kinen) and the Autumn (Tenno Sho Autumn, Japan Cup, Arima Kinen). The other reading, the three
long G1s (Kikuka Sho, Tenno Sho Spring, Arima Kinen), gives the same calendar: all three sit in it. Either way a
Medium · Long career runs every long G1 in the catalogue.

**The crowns follow the group, not the real horse's sex.** Today the generator gives the Triple Crown only to Umas
whose real horse was a colt, and the Triple Tiara only to fillies (65 of 272 Umas). The original game lets any trainee
enter the Oka Sho or the Oaks, and the owner names the Tiara as the Mile · Medium crown, so v2 drops the gate.

### 1.2 Who qualifies

**The rule: A in one of the group's two distances and B or better in the other, on a surface where she is A.**

Counted over the 272 Umas in the private pack (outfits; 135 characters):

| Rule | No group | 1 group | 2 groups | 3 | Medium · Long | Mile · Medium | Sprint · Mile |
|---|---|---|---|---|---|---|---|
| **A in one, B or better in the other** (recommended) | **9** | **212** | **51** | 0 | **140** | **127** | **47** |
| A in both | 90 | 180 | 2 | 0 | 99 | 68 | 17 |
| B or better in both | 9 | 208 | 55 | 0 | 142 | 129 | 47 |

Under the recommended rule, the pairs are: Medium · Long only 108, Mile · Medium only 76, both of those 32, Sprint ·
Mile only 28, Sprint · Mile and Mile · Medium 19.

**Why A and B, not A and A:**
- the owner's own example ("Long and Medium at A") qualifies under it;
- A in both leaves 90 Umas, a third of the roster, with no group at all;
- a B distance races at 0.9 of an A's speed term (the engine's `DISTANCE_APT_SPEED`), which a G1 field at its 17%
  handicap can still be beaten through. C (0.8) is not offered.

### 1.3 "At least two specialized types"

The sentence reads best as **"each Uma races two distances, with a build for each"**: a group is two distances, and
each distance in it gets its own preset (§3). Under the rule above, 263 of 272 Umas run two distances.

Choosing *between* groups is the second layer:
- **51 Umas** qualify for two groups today, and none for three.
- **Summer Camp's aptitude points** (release 4) raise a distance a grade. One step on one distance gives **130 Umas**
  two groups. Two steps give 152 two groups and 10 all three. So "at least two" grows with the roadmap rather than by
  loosening the rule.

### 1.4 Umas with no group: single-distance careers

Nine Umas are A at only one distance with the neighbours below B: **5 Medium-only and 4 Sprint-only**.
- She runs the calendar of a group holding her A distance: a Sprint-only Uma runs Sprint · Mile; a Medium-only Uma
  picks Mile · Medium or Medium · Long.
- **Every race at a distance where she is below B becomes optional.** She can still enter it, and it still counts
  toward a crown, but it never blocks the season.
- She has one preset.
- A Sprint-only Uma keeps 8 of Sprint · Mile's 13 objectives. A Medium-only Uma keeps 10 of Medium · Long's 14 but
  only 4 of Mile · Medium's 13, so Medium · Long is preselected for her.

### 1.5 Surface: dirt is a variant, not a fourth group

- **Turf:** 255 Umas are A. **Dirt:** 23 are A. 6 are A on both, and 17 race only on dirt.
- **The dirt G1s are mile and medium races:** 12 in all, 1 sprint (JBC Sprint), 6 mile, 5 medium and no long race.
  So dirt is one calendar, **Mile · Medium on dirt** (§2.2 d), with the Dirt Crown.
- **Who runs it:** the 21 dirt Umas who qualify for Mile · Medium. Of the 6 who qualify for Sprint · Mile on dirt, 4
  also qualify for Mile · Medium; the 2 who don't run the dirt calendar as in §1.4, its medium races optional.
- **On turf:** Medium · Long 140, Mile · Medium 112, Sprint · Mile 41.
- An Uma who is A on both surfaces picks one at the start.

### 1.6 Who picks, and when

The owner, at career start, from the groups and surfaces she qualifies for.
- The **Start career** sheet (her profile, [11](../../game/11-hub-and-places.md) §3) shows each group she qualifies
  for with its crowns and a strip of its calendar. Her stronger group is preselected: the one whose weaker distance
  grade is higher, ties to the one with more A distances, then Medium · Long, Mile · Medium, Sprint · Mile.
- **The group is frozen with the calendar.** It never changes in that career.
- **One URA Finale career per Uma**, as today. Running her second group is "a second career in a scenario", already
  on the manual's "Not built yet" list (§8, point 2).

## 2. The calendar

### 2.1 Its shape

The career keeps twelve seasons and a Finale. What v2 changes is what each season is for:

| Seasons | What it is | Planned plays | Races |
|---|---|---|---|
| **Junior Spring, Summer, Autumn** | **The training block** | 3 each | None |
| **Junior Winter** | Her first race | 1, the prep heat on her Junior G1's course | The group's Junior G1 |
| **Classic and Senior Spring, Autumn, Winter** | Racing seasons | None; a prep heat is optional | 1–3 objectives, optional races |
| **Classic and Senior Summer** | Summer camp | 1 | None on turf. Japan runs no turf G1 in July or August; dirt has the Japan Dirt Derby |
| **Finale** | The URA Finals | 1, the Finals' prep heat | Qualifier, semifinal, final |

- **In the training block,** Furlong Hand runs the course of her Junior G1, the race she's training for, as the
  swappable stages design already provides ([swappable stages](swappable-stages.md) §2).
- **Racing seasons lead with Race.** The games stay on the season card as an optional prep heat that pays like any
  play. T160 makes Furlong Hand "the big Play button in every season". In v2 that holds in the block, at the camps and
  at the Finale. In a racing season the card shows Upgrade → Race, with the prep heat as a smaller row. This is the one
  coordination point with T160.
- **Summer camp** keeps the original's Classic and Senior summers as training.

**Which months a season holds.** v2 places each race by its month in the original's calendar:
- **Spring:** March to June;
- **Summer:** July and August;
- **Autumn:** September to November;
- **Winter:** December and the January–February after it.

So Junior Winter holds the Classic year's Kisaragi Sho and Keisei Hai, and Classic Winter holds the Senior year's
February Stakes and Kyoto Kinen. In the original's 72 turns, Junior Spring is turns 1–12 (the debut falls at its end),
Senior Winter is turns 71–72, and the Finale is 73 on.

This replaces today's placement by season code (`RACE_SEASON_QUARTER`). Two reasons:
- the code files early-September races (the Centaur Stakes, the Rose Stakes) under summer;
- the code puts February after December in the same year.

**Which year a race belongs to.** Races carry only a season code.
- **From the objectives' turns:** each character's objectives in the master carry the turn they're run on, 1–72,
  half-month precise. A race's year is the year of every turn it appears on. This settles every objective below
  except the Keio Hai Spring Cup and the Senior Hanshin Cup, and every G1 except the JBC Ladies' Classic.
- **From the real calendar:** races no character's objectives date take their real month and age condition. These
  are public facts: a two-year-old race is Junior, a three-year-old race Classic, and "three and up" Classic or
  Senior. They are:
  - the Keio Hai Spring Cup and the JBC Ladies' Classic;
  - eight optional races: the Meguro Kinen, Fuji Stakes, Tokyo Shimbun Hai, Sekiya Kinen, Silk Road Stakes, Antares
    Stakes, March Stakes and Musashino Stakes;
  - the Senior runs of three-and-up races the objectives only date in Classic: the Hanshin Cup, Challenge Cup and
    Sirius Stakes.

The full G1 list with its years is §9.2.

### 2.2 The four calendars

Each season lists its objectives in month order, then its optional races. A grade, a distance in metres and a month
follow each race. A crown leg carries its code:
- **TC** Triple Crown;
- **SS** Senior Spring Triple Crown, **SA** Senior Autumn Triple Crown, **GP** Grand Prix;
- **TT** Triple Tiara, **MC** Mile Crown, **SC** Sprint Crown, **DC** Dirt Crown.

The Junior block (Spring, Summer, Autumn: three plays each, no races) is the same in every calendar and is left out.

#### a. Medium · Long (turf)

| Season | Plays | Objectives | Optional |
|---|---|---|---|
| Junior Winter | 1 | Hopeful Stakes G1 2000 (Dec) | Keisei Hai G3 2000 (Jan) |
| Classic Spring | — | Yayoi Sho G2 2000 (Mar) · Satsuki Sho G1 2000 (Apr) TC · Tokyo Yushun G1 2400 (May) TC | Aoba Sho G2 2400 · Kyoto Shimbun Hai G2 2200 |
| Classic Summer | 1 camp | — | Hakodate Kinen G3 2000 · Kokura Kinen G3 2000 |
| Classic Autumn | — | Kobe Shimbun Hai G2 2400 (Sep) · Kikuka Sho G1 3000 (Oct) TC | St. Lite Kinen G2 2200 · Japan Cup G1 2400 |
| Classic Winter | — | Arima Kinen G1 2500 (Dec) | Nikkei Shinshun Hai G2 2400 · Kyoto Kinen G2 2200 · Diamond Stakes G3 3400 |
| Senior Spring | — | Osaka Hai G1 2000 (Mar) SS · Tenno Sho (Spring) G1 3200 (Apr) SS · Takarazuka Kinen G1 2200 (Jun) SS GP | Hanshin Daishoten G2 3000 · Meguro Kinen G2 2500 |
| Senior Summer | 1 camp | — | Sapporo Kinen G2 2000 |
| Senior Autumn | — | Kyoto Daishoten G2 2400 (Oct) · Tenno Sho (Autumn) G1 2000 (Oct) SA · Japan Cup G1 2400 (Nov) SA | All Comers G2 2200 |
| Senior Winter | — | Arima Kinen G1 2500 (Dec) SA GP | — |

**14 objectives** (11 G1, 3 G2) and 14 optional races. It runs every long G1, the Triple Crown and both Senior triple
crowns. 4 crowns.

#### b. Mile · Medium (turf)

| Season | Plays | Objectives | Optional |
|---|---|---|---|
| Junior Winter | 1 | Hanshin Juvenile Fillies G1 1600 (Dec) | Hopeful Stakes G1 2000 |
| Classic Spring | — | Tulip Sho G2 1600 (Mar) · Oka Sho G1 1600 (Apr) TT · Japanese Oaks G1 2400 (May) TT | Flora Stakes G2 2000 · NHK Mile Cup G1 1600 |
| Classic Summer | 1 camp | — | Radio Nikkei Sho G3 1800 · Queen Stakes G3 1800 |
| Classic Autumn | — | Rose Stakes G2 1800 (Sep) · Shuka Sho G1 2000 (Oct) TT | Queen Elizabeth II Cup G1 2200 · Mile Championship G1 1600 |
| Classic Winter | — | Nakayama Kinen G2 1800 (Feb) | Tokyo Shimbun Hai G3 1600 · Kyoto Kinen G2 2200 |
| Senior Spring | — | Osaka Hai G1 2000 (Mar) · Victoria Mile G1 1600 (May) · Yasuda Kinen G1 1600 (Jun) MC | Milers Cup G2 1600 · Takarazuka Kinen G1 2200 |
| Senior Summer | 1 camp | — | Sekiya Kinen G3 1600 · Sapporo Kinen G2 2000 |
| Senior Autumn | — | Mainichi Okan G2 1800 (Oct) · Tenno Sho (Autumn) G1 2000 (Oct) · Mile Championship G1 1600 (Nov) MC | Fuji Stakes G2 1600 · Queen Elizabeth II Cup G1 2200 |
| Senior Winter | — | — (the run-up to the Finals) | Challenge Cup G3 2000 |

**13 objectives** (9 G1, 4 G2) and 16 optional races: the Triple Tiara, the Mile Crown, and the medium G1s around
them (Osaka Hai, Tenno Sho Autumn). 2 crowns.

#### c. Sprint · Mile (turf)

| Season | Plays | Objectives | Optional |
|---|---|---|---|
| Junior Winter | 1 | Asahi Hai Futurity Stakes G1 1600 (Dec) | — |
| Classic Spring | — | Falcon Stakes G3 1400 (Mar) · NHK Mile Cup G1 1600 (May) | Fillies' Revue G2 1400 · New Zealand Trophy G2 1600 · Aoi Stakes G3 1200 |
| Classic Summer | 1 camp | — | Ibis Summer Dash G3 1000 · Keeneland Cup G3 1200 |
| Classic Autumn | — | Centaur Stakes G2 1200 (Sep) · Sprinters Stakes G1 1200 (Sep) · Mile Championship G1 1600 (Nov) | Swan Stakes G2 1400 · Fuji Stakes G2 1600 |
| Classic Winter | — | — | Hanshin Cup G2 1400 · Silk Road Stakes G3 1200 |
| Senior Spring | — | Takamatsunomiya Kinen G1 1200 (Mar) SC · Keio Hai Spring Cup G2 1400 (May) · Yasuda Kinen G1 1600 (Jun) MC | Ocean Stakes G3 1200 · Milers Cup G2 1600 · Victoria Mile G1 1600 |
| Senior Summer | 1 camp | — | CBC Sho G3 1200 · Sekiya Kinen G3 1600 |
| Senior Autumn | — | Sprinters Stakes G1 1200 (Sep) SC · Swan Stakes G2 1400 (Oct) · Mile Championship G1 1600 (Nov) MC | Centaur Stakes G2 1200 · Fuji Stakes G2 1600 |
| Senior Winter | — | Hanshin Cup G2 1400 (Dec) | — |

**13 objectives** (8 G1, 4 G2, 1 G3) and 16 optional races: the sprint and mile G1s, with the Sprinters Stakes and
the Mile Championship in both Classic and Senior. 2 crowns.

#### d. Mile · Medium on dirt

| Season | Plays | Objectives | Optional |
|---|---|---|---|
| Junior Winter | 1 | Zen-Nippon Junior Yushun G1 1600 (Dec) | — |
| Classic Spring | — | Unicorn Stakes G3 1600 (Jun) | — |
| Classic Summer | 1 camp | Japan Dirt Derby G1 2000 (Jul) | Leopard Stakes G3 1800 |
| Classic Autumn | — | Sirius Stakes G3 2000 (Sep) · JBC Classic G1 2000 (Nov) | Mile Championship Nambu Hai G1 1600 · Miyako Stakes G3 1800 · JBC Ladies' Classic G1 1800 |
| Classic Winter | — | Champions Cup G1 1800 (Dec) · Tokai Stakes G2 1800 (Jan) · February Stakes G1 1600 (Feb) DC | Tokyo Daishoten G1 2000 · Kawasaki Kinen G1 2100 |
| Senior Spring | — | Kashiwa Kinen G1 1600 (May) · Teio Sho G1 2000 (Jun) | March Stakes G3 1800 · Antares Stakes G3 1800 |
| Senior Summer | 1 camp | — | Elm Stakes G3 1700 |
| Senior Autumn | — | Mile Championship Nambu Hai G1 1600 (Oct) · JBC Classic G1 2000 (Nov) | Sirius Stakes G3 2000 · Musashino Stakes G3 1600 |
| Senior Winter | — | Champions Cup G1 1800 (Dec) DC · Tokyo Daishoten G1 2000 (Dec) | — |

**14 objectives** (11 G1, 1 G2, 2 G3) and 11 optional races: every dirt G1 at her distances. 1 crown.

#### Per career

| Calendar | Objectives | G1 · G2 · G3 | With the URA Finals | Optional races | Crowns | Planned plays |
|---|---|---|---|---|---|---|
| Medium · Long | 14 | 11 · 3 · 0 | **17** | 14 | 4 | 13 |
| Mile · Medium | 13 | 9 · 4 · 0 | **16** | 16 | 2 | 13 |
| Sprint · Mile | 13 | 8 · 4 · 1 | **16** | 16 | 2 | 13 |
| Mile · Medium, dirt | 14 | 11 · 1 · 2 | **17** | 11 | 1 | 13 |
| Today (M036) | 6 | 3 · 2 · 1 | 9 | 0 | 0–1 | 13 |

### 2.3 The race rules

- **An objective must be won before Next season,** as today, and retries stay free. With 13–14 objectives this is
  more racing, not more blocking: the rivals are tuned so a median deck wins half its G1s at the first try (§4.4).
- **Optional races:**
  - she enters them in their season, as often as she likes;
  - a first win pays its SP (§4.3);
  - a loss changes nothing, and an optional race never blocks Next season;
  - a win still counts toward a crown.
- **Her own races join the optional list.** Any G1 from her real horse's career (the objectives' races, already
  `signatureRaceFamilyIds`) at her group's distances and surface that the calendar lacks joins it, in the season her
  own objectives date it. So an Uma whose real horse ran the Japan Cup at three meets it in her Classic autumn.
- **A race can come twice.** The Arima Kinen in Classic and Senior, for example, is two objectives. An objective's key
  becomes `season:race`, and its seed names the season, so the second Arima isn't the first one's draw.
- **The fields** are as today: `rollRivalFieldAt` by scenario, grade and the race's season, on the new season shares
  (§4.2).
- **The URA Finals** run on one announced course with its conditions, picked at career start from her calendar's
  board ([the URA Finals as an announced course](finale-events.md), D395). *Superseded:* she picks the distance at the Finale,
  before its prep heat; the default is her better aptitude, ties to the longer distance. The course rule is today's
  (the pair's highest grade).

### 2.4 What this replaces

Today a career's six objectives come from `planScenarioCareer`:
- a Maiden G3 and two Trials G2s from her profile's band;
- three Main G1s, from a rotating series set or her own G1s;
- placed by `placeObjectives`.

In v2, a URA Finale career's objectives are **its calendar's slots, frozen at the start**: one fixed table per group
and surface, in code. Nothing is picked or rotated.
- **The slots name races by their public English name and distance,** which `RaceTemplate` already carries. They're
  resolved against the regular catalogue at `start-career`: the row with a season, then the lowest id. So no new
  private overlay is needed.
- **The generator, the Maiden/Trials/Main stages and `placeObjectives` retire.** `CAREER_BANDS` and the series labels
  stay.
- **Later scenarios** each open with their own calendars per group, in their release, as the drawing board's
  "objectives differ by scenario" asks.

## 3. Distance presets

**One preset for each distance in her group:** Medium and Long for Medium · Long, and so on. A single-distance Uma has
one.

| Each preset holds | Her presets share |
|---|---|
| **A deck** of six owned cards whose era allows the scenario | **The tree:** every pip and Camp bought, and the drills that pay for them |
| **The posts:** each of its cards' branch | **Bond:** the wallet's Bond, and every card's bond track (a card in both decks has one track) |
| **Her running style** at that distance (her best by aptitude by default) | **Skills:** bought once from one SP pool, up to the scenario's SP cap; every bought skill races at every distance |
| | Her aptitudes, and later Summer Camp's aptitude points |

**Why this split:**
- **Stats are per preset without storing any.** A pip's gain is derived from the cards posted at its branch
  ([05](../../game/05-the-build.md) §5). The same Stamina pips pay a Long preset with two Stamina cards posted there
  more Stamina than a Medium preset that posts a Speed card instead. Each preset's derived stats are its own, from one
  shared tree. That's the old game's "card sets and stats per distance" with nothing new to buy.
- **Skills aren't split.** A distance skill only fires at its distance, so a per-preset loadout could only take skills
  away. The real per-distance choice is which skills to buy from the one pool.
- **SP earned reads the better preset.** The tree's sessions and the deck's Initial Skill Points pay SP through the
  deck, so the two presets can earn different amounts. The career's SP is the larger of the two. That is what a deck
  swap already allows today: SP is counted through the current deck, and bought skills are kept. The SP cap bounds
  it either way.
- **Inheritance** has no generation-3 counterpart until Summer Camp's aptitude points (release 4). They will be shared,
  since an aptitude is hers.

**Switching is automatic, by distance,** as the old game's presets did (D254):
- **a race** reads the preset of its distance: its stats, its deck's Race Bonus and its style;
- **a stage** reads the preset of the race it prepares, Furlong Hand's course race (in the block, the Junior G1's);
- **Upgrade** opens on the preset of her next race, with a switch at the top (Medium | Long). Deck, Tree and Bonds
  edit and preview the viewed preset, and each pip preview also shows the other preset's gain, faintly;
- **the race sheet** shows the preset's badge.

**The save** (`CareerRecord`, [the architecture](../../game/architecture.md)):

```ts
interface CareerRecord {
  // kept: umaId, T, startedAt, season, pips, camps, skills, spSpent, wallet, completedAt
  group: CareerBand                                  // 'sprint-mile' | 'mile-medium' | 'medium-long'
  surface: Surface                                   // 'turf' | 'dirt'
  objectives: readonly CareerObjective[]             // { id: 'season:race', raceId, season, optional, status, wonAt }
  presets: Partial<Record<DistanceCategory, Preset>> // her group's distances; replaces `deck` and `posts`
  finale: { step: number; won: boolean; distance: DistanceCategory | null }
  racingBuilds: Partial<Record<DistanceCategory, RacingBuild>> | null // replaces `racingBuild`
}
interface Preset { deck: readonly string[]; posts: Readonly<Record<string, Branch>>; strategy: Strategy }
```

- Crowns are derived from the calendar table and the objectives won, so nothing stores them.
- **Winning the URA Finals freezes one racing build per preset.** Her profile shows both: "URA Finale · Medium" and
  "URA Finale · Long".

## 4. Stat pacing: train up front, then race near her best

### 4.1 Plays and the pay bundle

- **13 planned plays a career,** the same number as today:
  - 9 in the training block;
  - 1 before her Junior G1;
  - 1 at each summer camp;
  - 1 at the Finale.
- **Optional prep heats:** each of the six racing seasons offers one more. They pay like any play.
- **One bundle for every game** ([swappable stages](swappable-stages.md) §1). Sized for 13 plays to hold today's
  totals, the starting values at grade A are:

| At grade A, a play | Today's guide (14 plays) | Careers v2 (13 plays) | A career, once through |
|---|---|---|---|
| Drills | about 100 | **110** | 1,430 (today: 1,400 → 61.4% of the tree, D383) |
| Bond | about 12 | **15** | 195: two presets mean up to 12 deck cards, about 8 in practice, against today's 150 for 6 |
| SP | about 25 | **0** | Racing pays the SP (§4.3) |

T162's `sim:careers` sets the final numbers. These are where it starts.

### 4.2 The stat curve against the rivals

**The model, fitted to today's sim.** D383's median career:
- races Junior Spring at 164 average stat, after about one Training Yard play;
- ends at 559 at its Finale, with 1,400 drills.

Her average stat fits `110 + 390 × d × (1 + 0.15 d)`, where *d* is the share of the career's drills spent. The 0.15
stands for friendship, which Bond brings as the career goes. The fit reproduces today's curve within about 10 points:
277 measured in Junior Winter against 288 modelled, 415 in Classic Winter against 418, and 481 in Senior Summer
against 487. Nothing in it is a new multiplier; it's the curve the sim already prints.

v2's curve, with today's measured shares for comparison:

| Season | Planned plays (total) | Drills spent | Her average stat (T1) | Share of the Finale's | Today's share (D383) | G1 field (−17%) |
|---|---|---|---|---|---|---|
| Junior Spring | 3 (3) | 330 | 203 | 0.36 | 0.15 (0.29 measured) | — |
| Junior Summer | 3 (6) | 660 | 303 | 0.54 | 0.36 | — |
| Junior Autumn | 3 (9) | 990 | 408 | 0.73 | 0.44 | — |
| **Junior Winter: first race** | 1 (10) | 1,100 | **445** | **0.80** | 0.50 | 369 |
| Classic Spring | — (10) | 1,100 | 445 | 0.80 | 0.54 | 369 |
| Classic Summer: camp | 1 (11) | 1,210 | 482 | 0.86 | 0.62 | 400 |
| Classic Autumn, Winter; Senior Spring | — (11) | 1,210 | 482 | 0.86 | 0.68–0.76 | 400 |
| Senior Summer: camp | 1 (12) | 1,320 | 520 | 0.93 | 0.86 | 432 |
| Senior Autumn, Winter | — (12) | 1,320 | 520 | 0.93 | 0.90–0.98 | 432 |
| **Finale** | 1 (13) | 1,430 | **559** | **1.00** | 1.00 | 464 (final −10%: 503) |

**What it means:**
- **Her first race comes at 80%** of her Finale's stats, against today's 50%.
- **Every Classic race is at 86% and every Senior race at 93%.** Three in four of a career's races come at 86% or
  more.
- **The fields keep pace, so early races aren't lopsided.** `RIVAL_SEASON_SHARE` becomes this curve:
  `[0.36, 0.54, 0.73, 0.80, 0.80, 0.86, 0.86, 0.86, 0.86, 0.93, 0.93, 0.93, 1]`. The block's three values are never
  raced. A Junior G1 field is then as trained, against her, as a Senior G1's.
- **What changes from one race to the next** is the grade's handicap (G2 22%, G1 17%, the final 10%) and what she has
  learned: skills, and Bond that brings cards to friendship.
- **The flat steps are the point.** She trains, then races what she trained. An optional prep heat in a racing season
  lifts her a little above the field, which is the owner's reward for playing more ("a stronger deck, or more play,
  does better").
- **More up front?** Moving the camps' plays into the block (12 of 13 before the first race) would start her at 92%,
  but Classic and Senior would then never move. That is §8, point 3.

`RIVAL_TRAINED_STAT` for T1 stays the typical Finale's average stat, re-measured. Holding 60% of the tree keeps it
near 559.

### 4.3 SP: racing pays the skills

v2's races pay far more SP than today's six objectives. At today's 40, 60 and 100 by grade × (1 + Race Bonus):

| Calendar | Objectives' SP before Race Bonus | × about 1.2 | + the tree, deck and hints (about 530) | SP earned | In golds with their whites (306 SP) |
|---|---|---|---|---|---|
| Medium · Long | 1,280 | 1,536 | 2,066 | about 2,070 | 6.8 |
| Mile · Medium | 1,140 | 1,368 | 1,898 | about 1,900 | 6.2 |
| Sprint · Mile | 1,080 | 1,296 | 1,826 | about 1,830 | 6.0 |
| Mile · Medium, dirt | 1,240 | 1,488 | 2,018 | about 2,020 | 6.6 |
| Today | 460 | 550 | + stages 330 | 1,408 (D383) | 4.6 |

**Where the estimates come from:**
- the tree's share (about 500) is the split `sim:careers` prints on invented content (stages and races 931, tree 499,
  deck 0, hints 19);
- the Race Bonus of about 20% is what D383's 1,408 SP leaves for the races once the stages' 330 and the tree's are
  taken out;
- T162's sim prints the real numbers.

**So the stages pay no SP.** The bundle's SP goes to 0, and the skills come from the original's two sources, racing
and training sessions.
- **By her first race** the tree's sessions have paid about 380 SP: a gold with its white.
- **By the Finale** she has earned close to URA Finale's 2,000 SP cap.
- **The target moves** from "4–6 golds" to **85%–105% of the scenario's SP cap** (1,700–2,100 at T1) in every
  calendar. What she spends is capped at 2,000 as today, so optional races add fun, not power, once she's there.

### 4.4 What `sim:careers` must assert

**How it plays:**
- every Uma's URA Finale career **in each group she qualifies for**, on its calendar and surface (a single-distance
  Uma as in §1.4);
- with a median and a strong deck **per preset**: `pickDecks` gains a distance lean (a Long preset trades its weakest
  Speed card for the next Stamina card; a Sprint preset its weakest Stamina card for Speed or Power);
- **the 13 planned plays** at A, with the main game's drill split (T160);
- the bot pours Bond into the union of the two decks;
- each objective's three first tries race the preset of its distance.

**What it holds, per calendar, median deck, once through:**

| Target | Band |
|---|---|
| First tries won: G3, G2, G1 | ≥ 90%, ≥ 75%, ≥ 50% (today's) |
| **First-try G1 wins in each school year** (Junior, Classic, Senior) | **40%–80%:** neither lopsided nor a wall |
| URA Finals finals won | 40%–60% |
| A strong deck | Wins more races in all |
| **Her average stat at her first race** | **≥ 75%** of her Finale's |
| **Her average stat at every Senior race** | **≥ 90%** |
| Each racing season's measured share | Within ±0.03 of `RIVAL_SEASON_SHARE`; otherwise re-set the shares from the print, as D383 did |
| Tree bought | 55%–65% |
| With every optional prep heat played | ≥ 80% |
| With every planned play played twice | ≥ 95% |
| Each preset's deck at bond 80 | 2.5–3.5 cards |
| SP earned | 85%–105% of the SP cap |
| Every game | Pays the same bundle (T160) |

**What it prints:** by calendar, the races and plays per career, the first tries by grade and by year, the curve and
the SP sources. It takes `--group=` for a quicker run.

**CI's invented content** (`career/synthetic.ts`) gains races named after the calendars' slots (the names are
public; the courses and stats stay invented), and keeps its wider bands.

## 5. Tickets

**Today:** each objective's win pays a Card Ticket, and the URA Finals pay an Uma Ticket and two Card Tickets.
- **On v2's calendars that rule would pay 15–16 Card Tickets a career.** URA Finale's era holds only **52 SSRs**, and
  the owner already holds about 25 of them in cards and tickets (§6). Two careers would empty the era.
- **It would also leave release 3's Scout points nothing to buy.**

**The proposal:**

| Source | Pays | A career |
|---|---|---|
| **A crown won:** every leg of one of the overlay's series, won in this career (an objective or an optional race) | **1 Card Ticket** | Medium · Long 4, Mile · Medium 2, Sprint · Mile 2, dirt 1 |
| **The URA Finals won** | **1 Uma Ticket and 2 Card Tickets** (unchanged) | 1 · 2 |
| An objective or optional race won | SP only (§4.3) | — |

So a career pays **1 Uma Ticket and 3–6 Card Tickets**, about 5 on the roster's mix. Each crown's last leg shows its
ticket on the calendar strip and the race sheet ("Completes the Triple Crown: +1 Card Ticket"), so where tickets come
from is always on screen.

**The pace, for a 25-Uma roster:**
- **Umas.** The owner holds 7 Umas and 13 Uma Tickets: 20 within reach today. One ticket a completed career makes the
  25-Uma roster after **5 careers**. Each new Uma then waits behind the twenty she can already run, which is plenty of
  choice.
- **Cards.** After T161's return, the owner holds 7 era-1 cards and about 17–19 Card Tickets. That's about 25 of the
  52 era-1 SSRs, and the rest come in about **6 careers**. After that, tickets bank for the eras each release opens:
  Unity Cup's 24 cards in release 2, 54 more in release 3.
- **Over 25 careers:** about 125 Card Tickets, plus the 24 a new account starts with. That's close to tier 1's 154
  SSRs (eras 1–5) as their scenarios open.

**How the roadmap layers on:**
- **Release 2, Team Showdown:**
  - pays the career bundle like every game, plus **Shards** toward a locked Uma you pick, in career and Hub plays
    alike;
  - target: about one Uma per two careers' plays, on top of the Finals' ticket;
  - Uma Tickets stay the racing reward.
- **Release 3, Fan Festival:**
  - pays the bundle plus **Scout points** toward a card you pick, of an open era only (T161's rule), or toward its
    refit;
  - target: about one card or one refit a career;
  - Card Tickets stay the crowns' reward.
- **Neither is a gacha,** and neither changes the career's resources.

## 6. Card gating by scenario

**T161 carries this as written,** and this proposal adopts it.
- **A card can be unlocked only once its era's scenario is open** in the game (`OPEN_SCENARIOS`, only URA Finale until
  release 2). It's an account rule, not one per Uma.
- **The Library** shows a later-era card with an "Opens with Unity Cup" chip in place of Unlock. Its Locked tab opens
  on the unlockable cards, and its page says the same.
- **The deck's own `card-era` refusal stays,** for the day a release opens several scenarios at once.
- **The one-time return.** The owner's account holds 13 cards, 6 of them from eras 2–5 (three of era 2, one each of
  eras 3, 4 and 5). That's 6 Card Tickets no URA Finale career can use.
  - `return-later-cards` re-locks every unlocked card whose era isn't open and gives back a ticket for each, behind a
    one-time banner in the Library.
  - It's the only exception to "unlocking is final".
  - An owner-tapped return, rather than a silent migration, keeps every re-lock the owner's own decision.
  - None of those cards can be in a deck or carry a bond track today, so nothing else moves.

## 7. What changes in code

### Domain (`packages/domain/src`)

| Module | Change |
|---|---|
| `scenario-goals.ts`, `career-shapes.ts`, `career-stages.ts` | The generator and the Maiden/Trials/Main stages retire. `careerProfile` becomes `distanceGroups(aptitudes)` (§1.2) and `defaultGroup`. The series labels and leg order stay. The sex gate goes |
| **`career/calendars.ts`** (new) | The four calendar tables: slots of `{ season, name, distance, grade, optional?, crowns? }` in month order; the planned plays per season; `resolveCalendar(group, surface, races, aptitudes)`, with §1.4's optional rule |
| `career/calendar.ts` | `placeObjectives`, `STAGE_YEAR` and the season-code placement go. `seasonName` and the year and quarter names stay |
| `career/start.ts` | `newCareer(uma, T, group, surface, races)`; `startCareer` refuses a group or surface she doesn't qualify for, in words |
| `career/season.ts` | `seasonPlan(career)`: its planned plays, objectives and optional races. `canAdvance` ignores optional races. T160's `CAREER_GAMES` order holds; racing seasons mark their play optional |
| `career/races.ts` | Objectives keyed `season:race`; `objectiveSpec`'s seed key names the season; a race prepares on the preset of its distance |
| `career/rewards.ts` | The per-objective Card Ticket goes; `crownCompleted(career, objectiveId)` pays 1 Card Ticket; SP by grade unchanged; the Finals unchanged |
| `career/finale.ts`, **`career/finale-events.ts`** (new) | The Finals run on the career's announced event ([the URA Finals as an announced course](finale-events.md) §6); `finalePair` and `set-finals-distance` retire |
| `career/pay.ts` | The bundle (T160), retuned (§4.1) |
| `build/deck.ts`, `build/ops.ts` | `set-deck`, `post-card` and the new `set-style` take a `distance` |
| `build/derive.ts`, `build/racing-build.ts`, `build/skills.ts` | `readDeck`, `careerStats` and `deriveRacingBuild` read a preset; SP earned is the better preset's |
| `build/bond.ts` | Bond pours into any card of either preset's deck |
| `tiers/rivals.ts` | `RIVAL_SEASON_SHARE` from §4.2, then the sim's measurement |
| `career/sim.ts`, `career/synthetic.ts`, `scripts/sim/careers.ts` | §4.4 |
| `career/docs.ts`, `docs/render.ts` | Live blocks: the four calendars, the groups rule, the plays per season, the crowns and their tickets |
| `account/ops.ts` | T161's `unlock-card` gate and `return-later-cards` |

### The operations

| Operation | v2 input |
|---|---|
| `start-career` | `umaId`, `T`, `group`, `surface`, `finaleEvent` (defaulting to the board's next in turn) |
| `set-deck` · `post-card` · `set-style` | `careerId`, `distance`, then as today; `strategy` for `set-style` |
| `pour-bond` | As today; any card of either preset's deck |
| `run-race` | `careerId`, `objectiveId`, `attempt`, `strategy`? (defaults to the preset's) |
| `run-finale` | As today, at the chosen distance |
| `restart-careers` | One time (§8, point 7) |

### The save and sync

- **`CareerRecord`** changes shape (§3). Its parser is strict, so the sync protocol goes from 3 to 4, and an older
  app is told to update.
- **The owner's one career in progress restarts** (§8, point 7). `restart-careers`, an operation with a fixed id:
  - deletes careers in the old shape, with their race results and stage journals;
  - keeps the tickets they paid, every unlock and every bond track.

### The web (`apps/web/src`)

- **`places/stable/`:**
  - her profile lists her groups (her aptitude pair under each), her racing builds per distance, and **Start career**;
  - Start career opens the group sheet (§1.6);
  - the album gains a group filter.
- **`places/career/`:**
  - **the calendar strip:**
    - each season's race chips: G1 solid, G2 grey, G3 outlined;
    - optional races dashed;
    - crown legs marked;
    - the block's planned plays as pips;
  - **the season card:**
    - in the block and at camps: Play n of 3;
    - in racing seasons: Upgrade → Race, with the objectives, then the optional races, then an optional prep heat;
  - **Upgrade:** the preset switch;
  - **the race sheet:** the preset's badge, and the crown and ticket line;
  - **the Finals' course:** the event cards on the Start career sheet, the header chip and the race sheet's
    conditions ([the URA Finals as an announced course](finale-events.md) §5);
  - **the completion:** two racing builds, and the crowns won.
- **`places/card-library/`:** T161.
- **Tests at 390×844** in light and dark: the group sheet with its event cards, a racing season and the preset switch.

### The docs

Rewrite, in the same commits as the code:
- [01](../../game/01-game-loop.md), [02](../../game/02-unlocks.md) §1, [03](../../game/03-careers.md) (whole),
  [04](../../game/04-tiers-and-scenarios.md) §4, [05](../../game/05-the-build.md) §2, §5, §7 and §9,
  [11](../../game/11-hub-and-places.md) §3 and §8, [12](../../game/12-pacing.md), [Racing](../../game/racing.md) and
  [the architecture](../../game/architecture.md)'s save;
- the career guide (`docs/design/game-loop/previews/career-guide.html`).

### Packets (suggested numbers; the coordinator owns them)

- **T162, the groups and calendars:**
  - §1, §2, §4 and §5;
  - the restart;
  - the retune of T160's bundle on the new calendar, which T160 already defers to T162.
- **T163, distance presets:** §3.
- **Only T162 changes `CareerRecord`.** It writes the whole v2 shape, `presets` included, with both presets starting
  as one deck, and the one protocol bump. T163 then builds the editing and the per-distance reading on that shape, with
  no second bump. Each part merges and deploys on its own, in order T160, T161, T162, T163
  ([M037](../../tasks/M037-careers-v2.md)).

## 8. Open points for the owner

Each has a recommended default. None blocks the packets.

1. **The qualifying rule.** Default: **A in one distance, B or better in the other** (263 Umas qualify, 51 for two
   groups). The alternative is A in both: the owner's example, but 90 Umas get no group.
2. **One career per Uma, or one per group?** Default: **one URA Finale career per Uma**, in the group picked at the
   start. Her second group arrives with "a second career in a scenario", already planned.
3. **How much training up front?** Default: **10 of 13 plays before her first race** (80% of her stats; 86% in
   Classic, 93% in Senior), so the summer camps still lift her. The alternative is 12 of 13 (92% from the first race),
   with Classic and Senior flat.
4. **Stages pay no SP; racing does.** Default: **yes.** The SP target becomes 85%–105% of the scenario's SP cap, about
   6 golds with their whites at T1 where today's is 4–6.
5. **Card Tickets by crown, not by objective.** Default: **yes**, 3–6 a career, about 5 on average, instead of 15–16
   on the new calendars. The Finals' 1 Uma Ticket and 2 Card Tickets stay.
6. **The crowns by group, not by the real horse's sex.** Default: **yes.** The Triple Tiara goes to every Mile ·
   Medium Uma and the Triple Crown to every Medium · Long Uma, as the original lets any trainee enter them.
7. **The career in progress.** Default: **restart it under v2.** Its bond tracks and every ticket and unlock stay; its
   tree, wallet and skills go. The alternative, finishing it on the old calendar, keeps two career shapes in the code
   for one career.
8. **The URA Finals' course** (D395 supersedes this point): an announced course and conditions from her calendar's
   board, the next in turn preselected at career start, any eligible one pickable ([the URA Finals as an announced course](finale-events.md)). *Superseded
   default:* you pick the distance at the Finale from her group's two, preselected to her
   better aptitude, ties to the longer.

## 9. Data notes

### 9.1 Sources and gaps

- **Read locally:**
  - the master release in `uma-platform/content/release`: races, the per-character objectives with their turns, the
    outfits' aptitudes and the cards' release dates;
  - the racer's private series overlay.
- **Filtered as the adapter does:** the regular catalogue (the racer's tracks, G1 to Pre-OP, a season), with the
  Longchamp races and the hidden names left out.
- **Only aggregates and public race names are here.**

**The gaps:**
1. **Races carry no year,** only a season code. The year came from the objectives' turns for every objective but one
   (§2.1), and from the real calendar for the rest. Several G1s appear in only one character's objectives, so their
   year rests on one data point. The calendar's choice settles each race that is open to both Classic and Senior.
2. **The season code and the month disagree** for early-September races, coded summer. v2 places by month.
3. **No debut or maiden races** reach the catalogue: the adapter keeps G1 to Pre-OP. The Junior G1 is her debut.
4. **Duplicate rows** need the resolver's tie-break (name, distance, a season, then the lowest id):
   - the JBC races at several venues and distances;
   - the Mile Championship Nambu Hai under two names;
   - a 2,200 m Japan Cup and a 2,200 m Queen Elizabeth Cup not released on Global;
   - season-less copies of the Tokyo Yushun, Kikuka Sho, Japan Cup and Asahi Hai Futurity Stakes.
5. **Dirt has no long race and one sprint G1,** which is why dirt is a Mile · Medium variant.
6. **The median deck's Race Bonus and the private pack's SP split aren't printed by `sim:careers` today,** so §4.3's
   SP is an estimate until T162's sim prints them.
7. **The real-horse sex field** reads 207 colts and 65 fillies, which is why today's Triple Tiara gate reaches so few
   Umas.

### 9.2 Every G1 in the catalogue

**Year** comes from the objectives' turns, J, C and S being Junior, Classic and Senior. "C/S" means a race open to
both. A † marks a year taken from the real calendar.

**Turf** (22):

| G1 | m | Distance | Month | Year | In calendar |
|---|---|---|---|---|---|
| Asahi Hai Futurity Stakes | 1600 | Mile | Dec | J | Sprint · Mile |
| Hanshin Juvenile Fillies | 1600 | Mile | Dec | J | Mile · Medium |
| Hopeful Stakes | 2000 | Medium | Dec | J | Medium · Long; Mile · Medium (optional) |
| Satsuki Sho | 2000 | Medium | Apr | C | Medium · Long (TC) |
| Oka Sho | 1600 | Mile | Apr | C | Mile · Medium (TT) |
| NHK Mile Cup | 1600 | Mile | May | C | Sprint · Mile; Mile · Medium (optional) |
| Japanese Oaks | 2400 | Medium | May | C | Mile · Medium (TT) |
| Tokyo Yushun (Japanese Derby) | 2400 | Medium | May | C | Medium · Long (TC) |
| Shuka Sho | 2000 | Medium | Oct | C | Mile · Medium (TT) |
| Kikuka Sho | 3000 | Long | Oct | C | Medium · Long (TC) |
| Takamatsunomiya Kinen | 1200 | Sprint | Mar | S | Sprint · Mile (SC) |
| Osaka Hai | 2000 | Medium | Mar | S | Medium · Long (SS); Mile · Medium |
| Tenno Sho (Spring) | 3200 | Long | Apr | S | Medium · Long (SS) |
| Victoria Mile | 1600 | Mile | May | S | Mile · Medium; Sprint · Mile (optional) |
| Yasuda Kinen | 1600 | Mile | Jun | S (C/S†) | Mile · Medium (MC); Sprint · Mile (MC) |
| Takarazuka Kinen | 2200 | Medium | Jun | C/S | Medium · Long (SS, GP); Mile · Medium (optional) |
| Sprinters Stakes | 1200 | Sprint | Sep | C/S | Sprint · Mile (twice; SC) |
| Tenno Sho (Autumn) | 2000 | Medium | Oct | C/S | Medium · Long (SA); Mile · Medium |
| Queen Elizabeth II Cup | 2200 | Medium | Nov | C/S | Mile · Medium (optional) |
| Japan Cup | 2400 | Medium | Nov | C/S | Medium · Long (SA; Classic optional) |
| Mile Championship | 1600 | Mile | Nov | C/S | Sprint · Mile (twice; MC); Mile · Medium (MC) |
| Arima Kinen | 2500 | Long | Dec | C/S | Medium · Long (twice; SA, GP) |

**Dirt** (12):

| G1 | m | Distance | Month | Year | In calendar |
|---|---|---|---|---|---|
| Zen-Nippon Junior Yushun | 1600 | Mile | Dec | J | Dirt |
| Japan Dirt Derby | 2000 | Medium | Jul | C | Dirt |
| Mile Championship Nambu Hai | 1600 | Mile | Oct | C/S | Dirt (Senior; Classic optional) |
| JBC Classic | 2000 | Medium | Nov | C/S | Dirt (twice) |
| JBC Ladies' Classic | 1800 | Mile | Nov | C/S† | Dirt (optional) |
| JBC Sprint | 1200 | Sprint | Nov | S (C/S†) | Dirt, for a sprinter (§1.5) |
| Champions Cup | 1800 | Mile | Dec | C/S | Dirt (twice; DC) |
| Tokyo Daishoten | 2000 | Medium | Dec | C/S | Dirt (Senior; Classic optional) |
| Kawasaki Kinen | 2100 | Medium | Feb | S | Dirt (optional) |
| February Stakes | 1600 | Mile | Feb | S | Dirt (DC) |
| Kashiwa Kinen | 1600 | Mile | May | S | Dirt |
| Teio Sho | 2000 | Medium | Jun | S | Dirt |

**By distance:**
- **turf:** sprint 2, mile 7, medium 10, long 3;
- **dirt:** sprint 1, mile 6, medium 5, long 0.
