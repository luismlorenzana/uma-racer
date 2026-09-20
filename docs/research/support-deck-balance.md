# Support Deck and Training balance follow-up

Date: 2026-09-17. Task: T010 (spec archived in git history). Every checked-in id, template, effect weight,
skill, stat, and seed is invented. The harness does not read `/content`, private packs, or original-game data.

## Method

Run `pnpm sim:cards -- 300`. The first matrix applies the actual generated card projection and deterministic Training rules
to weak (LB0/Lv1), mid (LB2/Lv12), and mature (LB4/Lv25) six-card tier-3 stat decks. A greedy, reload-stable strategy picks
the facility with the highest currently applied gain until TL10. It reports turns, applied gains, total stat gain, learned
versus available invented hints, and active generated Race Bonus.

The G1 follow-up uses 300 paired deterministic seeds per row, a 12-runner 2,400 m field, the strongest Pace aptitude, full
tier-1 player caps, the pinned player Form curve, a mature synthetic player kit with four card-learned skills, and the
documented four-skill NPC baseline shape. This is intentionally a single sensible matchup rather than T008's broad
all-distance/all-strategy average.

## Results

| Deck | Turns to TL10 | Average applied gain | Total stat gain | Hints learned/available | Race Bonus |
|---|---:|---:|---:|---:|---:|
| Weak | 17 | 135.5 | 2,122 | 4 / 6 | 0.0% |
| Mid | 17 | 164.6 | 2,529 | 3 / 6 | 20.6% |
| Mature | 17 | 212.3 | 3,162 | 5 / 6 | 33.8% |

TL10 timing is controlled by the pinned 36/54 Training EXP values, so card maturity properly separates gain throughput,
hint outcomes, and Race Bonus rather than inventing a faster Training-Level curve. Fixed-seed hint counts are not expected
to be monotonic in one short run; the mature deck still exposes all six possible hints and learned five by TL10.

The sensible G1 row measured **30.3% wins at k=0 and 27.7% at k=9**, versus the aspirational 35%→65%. This confirms that
manual deck building and a mature supported skill loadout alone do not close the target, and the narrower row is not
monotonic. Recommendation: keep the pinned Form and race constants, then revisit the target after scenario promotion,
inheritance, player skill refresh/cost selection, and representative stat allocation exist. No hidden player modifier was
added.

## T024 Friend/Group regression — 2026-09-20

T024 fixed the stale harness fixture so the synthetic Uma explicitly starts her scenario, then added two wildcard shapes:
the sixth stat card is replaced by an otherwise identical Friend or Group card. Both broad types use the same generated
profile here, so identical rows are expected. The ordinary stat rows remain the T010 baseline exactly.

| Deck / build | Turns to TL10 | Average applied gain | Total stat gain | Hints learned/available | Race Bonus |
|---|---:|---:|---:|---:|---:|
| Stat / weak | 17 | 135.5 | 2,122 | 4 / 6 | 0.0% |
| Stat / mid | 17 | 164.6 | 2,529 | 3 / 6 | 20.6% |
| Stat / mature | 17 | 212.3 | 3,162 | 5 / 6 | 33.8% |
| Friend / weak | 19 | 129.1 | 2,247 | 5 / 6 | 0.0% |
| Friend / mid | 17 | 161.9 | 2,503 | 4 / 6 | 20.6% |
| Friend / mature | 17 | 210.0 | 3,137 | 6 / 6 | 33.8% |
| Group / weak | 19 | 129.1 | 2,247 | 5 / 6 | 0.0% |
| Group / mid | 17 | 161.9 | 2,503 | 4 / 6 | 20.6% |
| Group / mature | 17 | 210.0 | 3,137 | 6 / 6 | 33.8% |

All nine decks reach TL10 within the documented 25 ordinary turns. Reliable attendance plus a five-way stat split gives
the weak broad deck more total stat coverage but no friendship Training EXP, so it takes two more turns; mid and mature
decks still finish in 17. The unchanged G1 control again measured **30.3% at k=0 and 27.7% at k=9** across 300 seeds, as
expected because T024 changes neither race inputs nor the existing stat-deck projection.

## T025 scenario-modifier regression — 2026-09-20

T025 added five mature synthetic controls to the same harness. Tier-2 baseline and organic rows use the same deterministic
five-card deals; the forced row is an explicit upper-bound fixture that places all five cards at Speed and selects that
facility every turn. Tier-3 Climax begins with exactly four earned items and arms only those first four turns. No case runs
past the ordinary 25-turn pacing bound, and all modifiers still use the normal caps.

| Scenario case | Turns to TL10 | Average applied gain | Total stat gain | Bursts/items used |
|---|---:|---:|---:|---:|
| Tier 2 baseline | 17 | 175.1 | 2,655 | 0 |
| Tier 2 organic Team Spirit | 17 | 175.1 | 2,655 | 0 |
| Tier 2 forced Team Spirit | 17 | 191.4 | 2,814 | 17 |
| Tier 3 baseline | 17 | 219.6 | 3,235 | 0 |
| Tier 3 Climax (four items) | 17 | 227.4 | 3,347 | 4 |

The fixed organic seed happened not to deal a three-card facility, so that row intentionally matches baseline and proves
Team Spirit does not leak a passive gain. The forced row proves the +10 all-stat upper-bound path without shortening the
pinned TL10 curve; four Climax uses add 112 total stats across the run without changing its 17-turn timing.

`pnpm sim:balance` remained byte-for-byte on the pre-T025 race harness and produced the same deterministic 200-seed
quick-regression rows: tier-1 1,200 m wins **11/79/72/38** at k=0 and **17/76/67/40** at k=9; 1,600 m wins
**16/72/58/54** at k=0 and **19/73/56/52** at k=9 for Front/Pace/Late/End. HP-empty stayed 0% and max-spurt 100% in all
four rows. This is expected: modifier state and gains never enter race input construction or the engine.

## T026 scenario-modifier regression — 2026-09-20

T026 adds tier-4 coverage, tier-5 cadence, and tier-6 aptitude controls to the same mature synthetic harness. Grand Concert
organic play follows the greedy facility choice; its forced row rotates through all five facilities to establish a bounded
three-Performance case. Grand Masters receives fragments on the documented eight-turn cadence. Project L'Arc claims each
ready five-stamp expedition against the first eligible invented aptitude; as expected, that changes aptitudes but not the
Training-gain row.

| Scenario case | Turns to TL10 | Average applied gain | Total stat gain | Modifier events |
|---|---:|---:|---:|---:|
| Tier 4 baseline | 17 | 212.7 | 3,210 | 0 |
| Tier 4 organic Performances | 17 | 217.5 | 3,247 | 1 |
| Tier 4 forced five-facility rotation | 18 | 215.1 | 3,456 | 3 |
| Tier 5 baseline | 17 | 230.2 | 3,407 | 0 |
| Tier 5 Goddess Fragments | 17 | 240.3 | 3,570 | 2 |
| Tier 6 baseline | 17 | 244.6 | 3,638 | 0 |
| Tier 6 Expedition | 17 | 244.6 | 3,638 | 3 |

All ordinary/organic rows retain the 17-turn Training-Level curve and every row remains below the 25-turn bound. The forced
Concert rotation takes one extra turn because it deliberately picks low-value facilities to finish sets; its +246 total
stat difference is the bounded reward for doing so. Masters adds 163 stats through two predictable bursts. L'Arc completes
three aptitude upgrades without leaking into stat/SP gains. All nine T024 deck rows and five T025 rows remain unchanged,
and the separate 300-seed G1 control remains **30.3% at k=0 / 27.7% at k=9**.

The full `pnpm sim:balance` matrix also remained deterministic: its original quick rows stayed **11/79/72/38** and
**17/76/67/40** at 1,200 m, then **16/72/58/54** and **19/73/56/52** at 1,600 m for k=0/k=9. Across all 2,400 simulated
races, every strategy won in all 12 rows, HP-empty was 6.0%, max-spurt was 92.9%, and the worst strategy row was 56.5%.
The long-recovery control stayed **54.6% → 51.8% HP empty** and **167.3 s → 164.5 s finish**. Tier-6 Expedition aptitude
changes are ordinary saved race inputs after the player claims them; none of the three modifiers changes race-engine code.
