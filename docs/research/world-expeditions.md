# World Expeditions — international racing-scene research

- **Status:** planning research, not an implementation contract
- **Researched:** 2026-09-28
- **Scope:** candidate race pools and a recommended definition of Expedition success

World Expeditions would let an Uma take one of her scenario-trained builds into a focused international racing campaign.
They are deliberately not replacements for core scenarios: this document does not give them constellations, Training
Levels, new stats, or a second progression ladder. It identifies racing scenes deep enough to support repeated races in
one surface-and-distance specialty without requiring the player to run an entire national calendar.

The names below are working game names. Unless a source explicitly calls a set a series, the grouping is our proposed
curation rather than a claim that racing authorities award that championship in the real world.

## Recommended completion size

An Expedition should offer meaningful choice rather than require a calendar sweep:

| Size | Minimum eligible race families | Wins for success | Optional share at the minimum |
|---|---:|---:|---:|
| **Standard Expedition** | 8 | **5 distinct races** | 3 of 8 (37.5%) |
| **Grand Expedition** | 12 | **8 distinct races** | 4 of 12 (33.3%) |

Five-of-eight is long enough to establish a specialty while still fitting a compact jurisdiction such as Dubai or South
Korea. Eight-of-twelve makes the deeper American, British, Australian, and European pools feel like major campaigns
without making every race mandatory. Adding races to a pool does not raise its success threshold automatically.

Planning assumptions:

- Wins are by **one Uma** and count once per distinct race family; repeating the same race cannot fill two slots.
- The listed pool is the set a future implementation may select from, not a requirement to schedule every race in one run.
- A success is the 5- or 8-win threshold. A complete sweep may later be a title or hidden badge, but is not ordinary
  completion.
- Exact attempt, retry, reward, unlock, and calendar rules are intentionally deferred.

This 62.5–66.7% completion ratio is the research recommendation to carry into the eventual design pass. It is not yet a
pinning-test value or a change to the shipped game.

## Distance vocabulary

The tables use Uma Racer's existing bands:

| Band | Normalized distance |
|---|---:|
| Sprint | ≤ 1,400 m |
| Mile | 1,401–1,800 m |
| Medium | 1,801–2,400 m |
| Long | ≥ 2,401 m |

Imperial races sit close to several boundaries: seven furlongs is about 1,408 m, 1⅛ miles about 1,811 m, and 1½ miles
about 2,414 m, while authorities commonly publish metric equivalents of 1,400, 1,800, and 2,400 m. The tables retain the
authority's conventional metric equivalent and mark boundary races where relevant. A future importer must preserve the
official race-year distance and apply one documented normalization rule; it must not silently choose the more convenient
band.

## Candidate set

| Surface and focus | Expedition | Size | Pool | Success |
|---|---|---|---:|---:|
| Dirt Sprint/Mile | United States Speed Championship | Grand | 12 | 8 wins |
| Dirt Sprint/Mile | South Korean Sprint Circuit | Standard | 8 | 5 wins |
| Dirt Mile/Medium | American Dirt Classics | Grand | 12 | 8 wins |
| Dirt Mile/Medium | Dubai Dirt Classics | Standard | 9 | 5 wins |
| Turf Sprint/Mile | Hong Kong Speed & Mile | Standard | 10 | 5 wins |
| Turf Sprint/Mile | Australian Speed & Mile | Grand | 12 | 8 wins |
| Turf Sprint/Mile | British Speed & Mile | Grand | 12 | 8 wins |
| Turf Mile/Medium | British Champions | Grand | 12 | 8 wins |
| Turf Mile/Medium | Hong Kong Crown & Cup | Grand | 13 | 8 wins |
| Turf Mile/Medium | Australian Mile & Championship | Grand | 13 | 8 wins |
| Turf Medium/Long | Australian Cups | Grand | 12 | 8 wins |
| Turf Medium/Long | British Classics & Stayers | Grand | 12 | 8 wins |
| Turf Medium/Long | France: Road to the Arc & Stayers | Grand | 14 | 8 wins |

Some boundary races appear in more than one candidate pool. That is intentional during research: it exposes where one
imported race can support multiple potential Expeditions. Before implementation, the design pass should either assign each
family to one Expedition or explicitly allow shared families.

## Dirt Sprint/Mile

### United States Speed Championship

**Recommendation:** Grand Expedition · **8 distinct wins from 12**

**Identity:** the deepest dirt-speed pool, moving between the major American sprint regions before two Breeders' Cup
finals.

| Candidate race | Published distance | Uma band | Role |
|---|---:|---|---|
| Churchill Downs Stakes | 1,400 m / 7 f | Sprint/Mile boundary | Early senior sprint |
| Metropolitan Handicap | 1,600 m / 1 mi | Mile | Headline dirt mile |
| Alfred G. Vanderbilt Handicap | 1,200 m / 6 f | Sprint | Saratoga sprint |
| Bing Crosby Stakes | 1,200 m / 6 f | Sprint | California sprint qualifier |
| Forego Stakes | 1,400 m / 7 f | Sprint/Mile boundary | Extended sprint |
| Pat O'Brien Stakes | 1,400 m / 7 f | Sprint/Mile boundary | Dirt Mile qualifier |
| Vosburgh Stakes | 1,400 m / 7 f | Sprint/Mile boundary | New York sprint qualifier |
| Phoenix Stakes | 1,200 m / 6 f | Sprint | Kentucky sprint qualifier |
| Santa Anita Sprint Championship | 1,200 m / 6 f | Sprint | West-coast sprint final |
| San Diego Handicap | 1,700 m / 1 1/16 mi | Mile | Two-turn mile test |
| Breeders' Cup Sprint | 1,200 m / 6 f | Sprint | Sprint championship |
| Breeders' Cup Dirt Mile | 1,600 m / 1 mi | Mile | Mile championship |

This is a curated championship, but the Breeders' Cup already supplies real Sprint and Dirt Mile qualification paths plus
the Dirt Dozen. It is the strongest option if race density matters more than keeping venue count small.

### South Korean Sprint Circuit

**Recommendation:** Standard Expedition · **5 distinct wins from 8**

**Identity:** a compact official sprint ladder at Seoul and Busan, supplemented by two short-mile races.

| Candidate race | Distance | Uma band | Role |
|---|---:|---|---|
| Segye Ilbo Trophy | 1,200 m | Sprint | Domestic opener |
| Busan Ilbo Trophy | 1,200 m | Sprint | Official Sprinter Series leg 1 |
| SBS Sports Sprint | 1,200 m | Sprint | Official Sprinter Series leg 2 |
| SROA Chairman's Trophy | 1,200 m | Sprint | Official Sprinter Series leg 3 |
| KRA Cup Sprint | 1,200 m | Sprint | Korea Premier sprint |
| Korea Sprint | 1,200 m | Sprint | International final |
| International Newspaper Cup | 1,400 m | Sprint | Extended sprint |
| Owners' Cup | 1,600 m | Mile | Mile capstone |

The first three named series legs are an official sweep. The wider eight-race set is our curation and gives the Expedition
enough choice for 5-of-8 success.

## Dirt Mile/Medium

### American Dirt Classics

**Recommendation:** Grand Expedition · **8 distinct wins from 12**

**Identity:** the American three-year-old Crown and the older-horse route into the Breeders' Cup Classic.

| Candidate race | Published distance | Uma band | Role |
|---|---:|---|---|
| Kentucky Derby | 2,000 m / 1 1/4 mi | Medium | Triple Crown leg 1 |
| Preakness Stakes | 1,900 m / 1 3/16 mi | Medium | Triple Crown leg 2 |
| Belmont Stakes | canonical 2,400 m / 1 1/2 mi | Medium/Long boundary | Triple Crown leg 3 |
| Haskell Stakes | 1,800 m / 1 1/8 mi | Mile/Medium boundary | Three-year-old summer classic |
| Travers Stakes | 2,000 m / 1 1/4 mi | Medium | Three-year-old summer final |
| Pennsylvania Derby | 1,800 m / 1 1/8 mi | Mile/Medium boundary | Three-year-old autumn test |
| Pegasus World Cup | 1,800 m / 1 1/8 mi | Mile/Medium boundary | Older-horse opener |
| Stephen Foster Stakes | 1,800 m / 1 1/8 mi | Mile/Medium boundary | Classic qualifier |
| Whitney Stakes | 1,800 m / 1 1/8 mi | Mile/Medium boundary | Saratoga championship |
| Pacific Classic | 2,000 m / 1 1/4 mi | Medium | West-coast championship |
| Jockey Club Gold Cup | 2,000 m / 1 1/4 mi | Medium | New York championship |
| Breeders' Cup Classic | 2,000 m / 1 1/4 mi | Medium | Final |

The Belmont's venue and distance have changed temporarily during reconstruction, so its family needs race-year variants
rather than one hard-coded course row. Triple Crown sweep and eight-win Expedition success would be separate concepts.

### Dubai Dirt Classics

**Recommendation:** Standard Expedition · **5 distinct wins from 9**

**Identity:** a single-venue Carnival covering proper dirt miles before rising through 1,900–2,000 m classics.

| Candidate race | Distance | Uma band | Role |
|---|---:|---|---|
| Dubai Creek Mile | 1,600 m | Mile | Carnival opener |
| Firebreak Stakes | 1,600 m | Mile | Senior mile |
| UAE 2000 Guineas | 1,600 m | Mile | Three-year-old mile |
| Burj Nahaar | 1,600 m | Mile | Godolphin Mile preparation |
| Godolphin Mile | 1,600 m | Mile | Mile final |
| Al Maktoum Challenge | 1,900 m | Medium | Senior classic preparation |
| Al Bastakiya | 1,900 m | Medium | Three-year-old classic preparation |
| UAE Derby | 1,900 m | Medium | Three-year-old final |
| Dubai World Cup | 2,000 m | Medium | Overall final |

This is the best compact Dirt Mile/Medium alternative. Several races have different age conditions in reality; whether an
Expedition enforces those conditions is a later design question.

## Turf Sprint/Mile

### Hong Kong Speed & Mile

**Recommendation:** Standard Expedition · **5 distinct wins from 10**

**Identity:** two clean specialties at Sha Tin: the official Speed Series and a sequence of major miles.

| Candidate race | Distance | Uma band | Role |
|---|---:|---|---|
| Centenary Sprint Cup | 1,200 m | Sprint | Speed Series leg 1 |
| Queen's Silver Jubilee Cup | 1,400 m | Sprint | Speed Series leg 2 |
| Sprint Cup | 1,200 m | Sprint | Champions Day preparation |
| Chairman's Sprint Prize | 1,200 m | Sprint | Speed Series leg 3 |
| Sha Tin Trophy | 1,600 m | Mile | Mile preparation |
| Jockey Club Sprint | 1,200 m | Sprint | International-races preparation |
| Jockey Club Mile | 1,600 m | Mile | International-races preparation |
| Champions Mile | 1,600 m | Mile | Spring mile final |
| Hong Kong Sprint | 1,200 m | Sprint | International sprint final |
| Hong Kong Mile | 1,600 m | Mile | International mile final |

Five wins allow a pure Sprint route, a Mile-heavy route, or a mixed speed route without requiring every official series
leg.

### Australian Speed & Mile

**Recommendation:** Grand Expedition · **8 distinct wins from 12**

**Identity:** Australia's unusually deep straight and turning sprint scene, followed by its major open miles.

| Candidate race | Distance | Uma band | Role |
|---|---:|---|---|
| Black Caviar Lightning | 1,000 m | Sprint | Pure-speed opener |
| Newmarket Handicap | 1,200 m | Sprint | Flemington sprint |
| William Reid Stakes | 1,200 m | Sprint | Melbourne sprint |
| T. J. Smith Stakes | 1,200 m | Sprint | Sydney autumn sprint final |
| Doomben 10,000 | 1,200 m | Sprint | Brisbane sprint |
| Kingsford-Smith Cup | 1,300 m | Sprint | Brisbane extended sprint |
| All Aged Stakes | 1,400 m | Sprint | Sprint-to-mile bridge |
| The Everest | 1,200 m | Sprint | Sydney spring sprint final |
| Champions Sprint | 1,200 m | Sprint | Melbourne spring sprint final |
| Doncaster Mile | 1,600 m | Mile | Sydney mile final |
| King Charles III Stakes | 1,600 m | Mile | Sydney spring mile |
| Champions Mile | 1,600 m | Mile | Melbourne mile final |

This pool has the strongest pure Turf Sprint depth in the research set. The slot-based entry system of The Everest is part
of its real-world identity, but need not become an Expedition mechanic.

### British Speed & Mile

**Recommendation:** Grand Expedition · **8 distinct wins from 12**

**Identity:** straight-course speed, major summer miles, and separate Sprint and Mile finals on Champions Day.

| Candidate race | Published distance | Uma band | Role |
|---|---:|---|---|
| King Charles III Stakes | 1,000 m / 5 f | Sprint | Royal Ascot pure sprint |
| Queen Elizabeth II Jubilee Stakes | 1,200 m / 6 f | Sprint | Royal Ascot sprint |
| July Cup | 1,200 m / 6 f | Sprint | Summer sprint |
| Nunthorpe Stakes | 1,000 m / 5 f | Sprint | Pure-speed championship |
| Sprint Cup | 1,200 m / 6 f | Sprint | Autumn sprint |
| British Champions Sprint | 1,200 m / 6 f | Sprint | Sprint final |
| 2000 Guineas | 1,600 m / 1 mi | Mile | Classic mile |
| Lockinge Stakes | 1,600 m / 1 mi | Mile | Senior mile opener |
| Queen Anne Stakes | 1,600 m / 1 mi | Mile | Royal Ascot mile |
| Falmouth Stakes | 1,600 m / 1 mi | Mile | Fillies-and-mares mile |
| Sussex Stakes | 1,600 m / 1 mi | Mile | Summer mile final |
| Queen Elizabeth II Stakes | 1,600 m / 1 mi | Mile | Champions Day mile final |

Britain supplies the most prestigious balanced Sprint/Mile pool, but its many distinct course configurations make it more
expensive than Hong Kong.

## Turf Mile/Medium

### British Champions

**Recommendation:** Grand Expedition · **8 distinct wins from 12**

**Identity:** the British Mile and Middle Distance divisions, ending in separate Champions Day finals.

| Candidate race | Published distance | Uma band | Role |
|---|---:|---|---|
| 2000 Guineas | 1,600 m / 1 mi | Mile | Colts' classic mile |
| 1000 Guineas | 1,600 m / 1 mi | Mile | Fillies' classic mile |
| Lockinge Stakes | 1,600 m / 1 mi | Mile | Senior mile opener |
| Queen Anne Stakes | 1,600 m / 1 mi | Mile | Royal Ascot mile |
| St James's Palace Stakes | 1,600 m / 1 mi | Mile | Three-year-old mile |
| Sussex Stakes | 1,600 m / 1 mi | Mile | Summer mile final |
| Queen Elizabeth II Stakes | 1,600 m / 1 mi | Mile | Mile championship |
| Prince of Wales's Stakes | 2,000 m / 1 1/4 mi | Medium | Royal Ascot medium |
| Eclipse Stakes | about 2,000 m / 1 1/4 mi | Medium | Generational medium test |
| Juddmonte International | about 2,050 m / 1 5/16 mi | Medium | York medium final |
| Champion Stakes | 2,000 m / 1 1/4 mi | Medium | Champions Day medium final |
| King George VI & Queen Elizabeth Stakes | 2,400 m / 1 1/2 mi | Medium/Long boundary | Distance capstone |

The real British Champions Series has separate Sprint, Mile, Middle Distance, Long Distance, and Fillies & Mares
categories. This proposed Expedition intentionally takes only the Mile and Middle Distance core.

### Hong Kong Crown & Cup

**Recommendation:** Grand Expedition · **8 distinct wins from 13**

**Identity:** three official structures sharing one 1,600–2,400 m range: the Four-Year-Old Classic Series, Triple Crown,
and international Mile/Cup/Vase.

| Candidate race | Distance | Uma band | Role |
|---|---:|---|---|
| Hong Kong Classic Mile | 1,600 m | Mile | Four-Year-Old Series leg 1 |
| Hong Kong Classic Cup | 1,800 m | Mile | Four-Year-Old Series leg 2 |
| Hong Kong Derby | 2,000 m | Medium | Four-Year-Old Series leg 3 |
| Stewards' Cup | 1,600 m | Mile | Triple Crown leg 1 |
| Hong Kong Gold Cup | 2,000 m | Medium | Triple Crown leg 2 |
| Champions & Chater Cup | 2,400 m | Medium | Triple Crown leg 3 |
| Champions Mile | 1,600 m | Mile | Spring mile final |
| QEII Cup | 2,000 m | Medium | Spring medium final |
| Jockey Club Mile | 1,600 m | Mile | International-races preparation |
| Jockey Club Cup | 2,000 m | Medium | International-races preparation |
| Hong Kong Mile | 1,600 m | Mile | International mile final |
| Hong Kong Cup | 2,000 m | Medium | International cup final |
| Hong Kong Vase | 2,400 m | Medium | International distance final |

This is the most internally coherent pool in the research. Eight-win success does not itself award any of the three real
sweeps; those remain separate accomplishment candidates.

### Australian Mile & Championship

**Recommendation:** Grand Expedition · **8 distinct wins from 13**

**Identity:** the major Australian miles feeding into its 2,000–2,040 m weight-for-age championships.

| Candidate race | Distance | Uma band | Role |
|---|---:|---|---|
| Australian Guineas | 1,600 m | Mile | Three-year-old mile |
| All-Star Mile | 1,600 m | Mile | Melbourne autumn mile |
| George Ryder Stakes | 1,500 m | Mile | Sydney mile preparation |
| Doncaster Mile | 1,600 m | Mile | Sydney autumn mile final |
| Queen of the Turf Stakes | 1,600 m | Mile | Fillies-and-mares mile |
| Makybe Diva Stakes | 1,600 m | Mile | Melbourne spring mile |
| Epsom Handicap | 1,600 m | Mile | Sydney spring mile |
| King Charles III Stakes | 1,600 m | Mile | Sydney spring mile final |
| Champions Mile | 1,600 m | Mile | Melbourne mile final |
| Ranvet Stakes | 2,000 m | Medium | Sydney medium preparation |
| Queen Elizabeth Stakes | 2,000 m | Medium | Sydney medium final |
| Cox Plate | 2,040 m | Medium | Melbourne weight-for-age final |
| Champions Stakes | 2,000 m | Medium | Melbourne season final |

This overlaps Australian Speed & Mile at its 1,600 m boundary and Australian Cups at 2,000–2,040 m. That overlap would
make imported content efficient, but final ownership of those race families needs an explicit design decision.

## Turf Medium/Long

### Australian Cups

**Recommendation:** Grand Expedition · **8 distinct wins from 12**

**Identity:** a broad 2,000–3,200 m campaign culminating in the Caulfield–Melbourne Cups axis.

| Candidate race | Distance | Uma band | Role |
|---|---:|---|---|
| Australian Cup | 2,000 m | Medium | Melbourne autumn medium |
| Ranvet Stakes | 2,000 m | Medium | Sydney preparation |
| Queen Elizabeth Stakes | 2,000 m | Medium | Sydney medium final |
| Tancred Stakes | 2,400 m | Medium | Sydney distance test |
| Doomben Cup | 2,000 m | Medium | Brisbane medium final |
| The Metropolitan | 2,400 m | Medium | Sydney spring cup |
| Cox Plate | 2,040 m | Medium | Weight-for-age championship |
| Caulfield Cup | 2,400 m | Medium | Cups double leg 1 |
| Moonee Valley Gold Cup | 2,500 m | Long | Melbourne Cup qualifier |
| Sydney Cup | 3,200 m | Long | Sydney staying final |
| Brisbane Cup | 3,200 m | Long | Brisbane staying final |
| Melbourne Cup | 3,200 m | Long | Overall final |

Australia has the cleanest natural escalation from Medium races into true Long races. The real Caulfield–Melbourne Cups
double is a strong separate accomplishment candidate.

### British Classics & Stayers

**Recommendation:** Grand Expedition · **8 distinct wins from 12**

**Identity:** 2,400 m classics followed by Britain's unusually deep flat-staying calendar.

| Candidate race | Published distance | Uma band | Role |
|---|---:|---|---|
| Derby | 2,400 m / 1 1/2 mi | Medium/Long boundary | Colts' classic |
| Oaks | 2,400 m / 1 1/2 mi | Medium/Long boundary | Fillies' classic |
| Coronation Cup | 2,400 m / 1 1/2 mi | Medium/Long boundary | Senior Epsom test |
| Hardwicke Stakes | 2,400 m / 1 1/2 mi | Medium/Long boundary | Royal Ascot distance test |
| King George VI & Queen Elizabeth Stakes | 2,400 m / 1 1/2 mi | Medium/Long boundary | Summer distance final |
| Yorkshire Cup | about 2,800 m / 1 3/4 mi | Long | Stayer opener |
| Gold Cup | about 4,000 m / 2 1/2 mi | Long | Extreme-stamina centerpiece |
| Goodwood Cup | about 3,200 m / 2 mi | Long | Summer staying final |
| Lonsdale Cup | about 3,300 m / 2 mi 1/2 f | Long | York stayer test |
| Doncaster Cup | about 3,600 m / 2 1/4 mi | Long | Stayer test |
| St Leger | about 2,900 m / 1 mi 6 1/2 f | Long | Three-year-old staying classic |
| British Champions Long Distance Cup | 3,200 m / 2 mi | Long | Season final |

This should be intentionally harder for non-stayers than Australian Cups. It is the strongest candidate for an Expedition
whose identity is genuinely Long rather than merely ending with one long race.

### France: Road to the Arc & Stayers

**Recommendation:** Grand Expedition · **8 distinct wins from 14**

**Identity:** France's 1,850–2,400 m road to the Arc, its two major staying races, and exactly three adjacent European
invitational races.

| Candidate race | Distance | Uma band | Region | Role |
|---|---:|---|---|---|
| Prix d'Ispahan | 1,850 m | Medium | France | Early medium test |
| Prix Ganay | 2,100 m | Medium | France | Older-horse opener |
| Prix du Jockey Club | 2,100 m | Medium | France | Three-year-old classic |
| Grand Prix de Saint-Cloud | 2,400 m | Medium | France | Summer distance final |
| Grand Prix de Paris | 2,400 m | Medium | France | Three-year-old distance final |
| Prix Foy | 2,400 m | Medium | France | Arc Trial for older horses |
| Prix Niel | 2,400 m | Medium | France | Arc Trial for three-year-olds |
| Prix Vermeille | 2,400 m | Medium | France | Arc Trial / fillies-and-mares final |
| Prix de l'Arc de Triomphe | 2,400 m | Medium | France | Main final |
| Prix Royal-Oak | about 3,100 m | Long | France | Autumn staying final |
| Prix du Cadran | about 4,000 m | Long | France | Extreme-stamina final |
| Irish Champion Stakes | 2,000 m | Medium | Ireland | European invitation 1 |
| Irish St Leger | 2,800 m | Long | Ireland | European invitation 2 |
| Grosser Preis von Baden | 2,400 m | Medium | Germany | European invitation 3 |

The three non-French races are deliberately capped at three so this remains a French Expedition rather than a generic
Europe catalog. They add one elite 2,000 m race, one true staying race, and one 2,400 m continental championship.

## Research conclusions

The requested set is viable as 13 distinct Expeditions. The strongest division of labor is:

- **United States and South Korea** for repeatable dirt speed;
- **United States and Dubai** for dirt Mile/Medium depth;
- **Hong Kong, Australia, and Britain** for three meaningfully different Turf Sprint/Mile identities;
- **Britain, Hong Kong, and Australia** for Mile/Medium campaigns;
- **Australia, Britain, and France/Europe** for Medium/Long campaigns.

The pools should not be reduced to only the success threshold. Eight or twelve available families are what let an Uma
with uneven aptitude, an unfinished build, or a failed race still finish an Expedition through another path.

## Work required before a design milestone

1. **Source and licensing audit.** Facts, imported rows, caches, and any images stay in the private ignored content
   pipeline. Checked-in tests use synthetic race families only.
2. **Race-year normalization.** Freeze canonical family ids separately from sponsor names, temporary venues, distance
   changes, and local grade labels.
3. **Course geometry inventory.** Determine which venues have authoritative turns, straights, slopes, direction, and
   surface data sufficient for engine v7. A race without geometry cannot use a fictional oval silently.
4. **Band boundary decision.** Define how furlongs and locally rounded metric distances become the game's integer metres.
5. **Pool ownership.** Resolve repeated boundary races across same-country Expeditions.
6. **Eligibility decision.** Decide whether real age/sex/restricted-bred conditions are flavor, route constraints, or
   intentionally ignored for the game's all-Uma roster.
7. **NPC/content decision.** The current generic Uma rival system can populate fields; no foreign real-horse roster is
   required for the first version.
8. **Name collision.** The Project L'Arc scenario already has a constellation buff named `Expedition`. Use **World
   Expeditions** as this feature's working UI label, and resolve the buff name before both can appear in the same player
   vocabulary.
9. **Scenario context.** Decide how an Expedition selects a trained unit, attributes its records to that scenario under
   D122/D190, and treats an earlier unit's no-EXP rule without creating a progression loophole.
10. **Implementation design.** Only after the research above should a design doc fix run lifecycle, persistence, unlocks,
    rewards, retries, and accomplishment semantics.

## Official sources consulted

All links were checked during the 2026-09-28 research pass. Schedules and sponsored names will change; the future content
pipeline must version them.

### United States and international qualification

- [Kentucky Derby — Triple Crown](https://www.kentuckyderby.com/triple-crown/)
- [Breeders' Cup — 2026 Challenge Series by division](https://www.members.breederscup.com/documents/challenge/ChallengeScheduleByDivision.pdf)
- [Breeders' Cup — World Championships race schedule](https://members.breederscup.com/Championships/RaceSchedule)
- [Breeders' Cup — Dirt Dozen](https://members.breederscup.com/DirtDozen)

### South Korea

- [Korea Racing Authority — principal races](https://race.kra.co.kr/globalEn/racingPrincipal.do)
- [Korea Racing Authority — series structure](https://race.kra.co.kr/chulmainfo/SeriesRaceOperationInfo.do?Act=05&Sub=1&meet=1)
- [Korea Racing Authority — 2026 racing plan](https://race.kra.co.kr/down/raceplan2026_20260516.pdf)

### Dubai

- [Dubai Racing Club — 2024–25 Carnival schedule and conditions](https://dubairacingclub.com/sites/default/files/uploads/Race%20Schedule%20%26%20Condition%202024-5.pdf)
- [Dubai Racing Club — 2025 Dubai Creek Mile](https://dubairacingclub.com/race-results-replays/dubai-racing-carnival-race-5-dubai-creek-mile-sponsored-by-nakheel-listed-1600m-dirt/)
- [Dubai Racing Club — 2026 Firebreak Stakes](https://dubairacingclub.com/race-results-replays/dubai-racing-carnival-race-2-firebreak-stakes-presented-by-longines-tb-group-3-1600m-dirt/)
- [Dubai Racing Club — World Cup race positions and distances](https://dubairacingclub.com/wp-content/uploads/2025/03/2025-Dubai-World-Cup-Brochure.pdf)
- [Emirates Racing Authority — 2026 Al Maktoum Challenge](https://emiratesracing.com/racecard/2026-01-23/6/entries)

### Hong Kong

- [Hong Kong Jockey Club — Four-Year-Old Classic Series](https://racingnews.hkjc.com/english/2026/03/23/hong-kong-jockey-club-raises-four-year-old-classic-series-purse-to-hk56-million/)
- [Hong Kong Jockey Club — Triple Crown](https://racingnews.hkjc.com/english/2026/01/13/romantic-warrior-trials-as-triple-crown-chase-begins-in-stewards-cup/)
- [Hong Kong Jockey Club — Speed Series](https://racingnews.hkjc.com/english/2026/03/24/ka-ying-rising-trials-ahead-of-sprint-cup-as-fwd-champions-day-approaches/)
- [Hong Kong Jockey Club — International Races](https://racingnews.hkjc.com/english/2025/11/26/2025-longines-hong-kong-international-races-selected-runners/)

### Australia

- [Australian Turf Club — 2026 Sydney Autumn program](https://racing.australianturfclub.com.au/Content/PDF/2026-sydney-autumn-program.pdf)
- [Racing Victoria — 2026 Spring Racing Carnival](https://www.racingvictoria.com.au/news/2026/07/16/2026-spring-programs-announced)
- [Victoria Racing Club — Black Caviar Lightning](https://www.vrc.com.au/latest-news/2026-black-caviar-lightning-contenders/)
- [The Everest — official site](https://www.theeverest.com.au/)

### Britain, France, Ireland, and Germany

- [The Jockey Club — British Classics](https://www.thejockeyclub.co.uk/the-racing/racing-explained/flat-racing/what-is-a-classic/)
- [British Champions Day — race information](https://britishchampionsday.com/race-information/)
- [France Galop — 2026 Group and Listed schedule](https://www.france-galop.com/sites/default/files/2026-02/groupes_listed_plat_2026_v7.pdf)
- [France Galop — 2026 major meetings](https://www.france-galop.com/sites/default/files/2025-12/num_calendrier-parieur-2026-12-12.pdf)
- [Irish Champions Festival — 2026](https://www.irishchampionsfestival.ie/)
- [IFHA — ranked international race distances](https://www.ifhaonline.org/resources/WTGradedRanking/LWGRank.asp?batch=6)
