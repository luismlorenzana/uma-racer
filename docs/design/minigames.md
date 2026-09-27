# Minigames

> Numbers marked as tuning baselines are checked-in and pinned. T074 may retune Rival Circuit only through the design,
> decision-log and domain-test process required by AGENTS.md. Names remain provisional.

Minigames are the **third pillar** of the game, beside Collection and Racing. They are the only way to raise a
Training Level and the only way to earn a card's stars. There is no other training loop: no turns, no
facilities, no energy, no per-turn RNG (D120).

| Minigame | Raises | Board |
|---|---|---|
| **Spark Match — Rival Circuit** | Training Level 1 → 10 of the active scenario | continuous-drag puzzle battle |
| **Friendship Training** | one card by one star in one scenario | a roguelite deck of support cards |

Both are **seeded and replay-stable**. Spark Rival Circuit is a pure replay of its encounter, seed and persisted
actions; Friendship Training replays its frozen setup and saved choices. Reloading mid-run restores the same state and
cannot reroll a friendlier one. Neither uses `Math.random`.

Both are **lazy-loaded routes**. Spark Match loads its own PixiJS scene under the existing route; Friendship Training is
DOM and CSS. Neither may push the main bundle past the 180 KB gzip budget.

---

## Spark Match — Rival Circuit

Spark Match is a three-wave sparring battle, not a race. Move one orb through many cells, build several matches in one
path, and use their strategy advantage to break a rival's **Resolve** before her pressure empties the trainee's
temporary **Drive** (D169). Two training rivals lead to one boss rival.

The public name remains **Spark Match**; **Rival Circuit** distinguishes this ruleset from the retired adjacent-swap
game. It remains the only way to raise the active scenario's Training Level.

### Board and movement

The board is **6 columns × 5 rows** with six orb kinds:

| Orb | Match result |
|---|---|
| Front · Pace · Late · End | Damage in that running strategy |
| **Spark** | Neutral damage and charge for **Spark Shift**; carries the trainee's icon |
| **Recovery** | Restore Drive, up to the run maximum |

Press an orb and drag it through the board. Entering an orthogonally **or diagonally** adjacent cell swaps the held orb
with the orb there. A path may revisit a cell. Planning before touching is unlimited; a **seven-second movement clock**
begins on the first cell transition. Releasing or timing out fixes the path and resolves every horizontal or vertical
line of three or more, then refills and resolves cascades until the board is stable.

The initial board is a seeded, match-free shuffle with exactly five of each orb. Refills are uniform seeded draws. A drag
path is bounded to 256 cells and a resolution to 64 cascade steps; reaching the path cap resolves like timeout, while a
cascade-cap breach is an engine error caught by tests/simulation rather than silently truncating a turn.

Fast pointer samples may cross more than one cell. The controller expands them through one documented, deterministic
grid traversal before it sends the path to the engine. A cancelled or interrupted pointer restores the pre-turn board,
costs no turn and writes no action. Only one pointer may own a drag.

### Strategy advantage

The four running strategies form one ring:

```text
Pace ──beats──► Front ──beats──► End ──beats──► Late ──beats──► Pace
```

An advantaged attack deals **1.5×**, a resisted attack **0.67×**, and either opposite-style matchup **1×**. Spark
damage is always neutral. Strategy aptitude modifies only that strategy's attack; the T071 baseline is S 1.10, A 1.00,
B 0.95, C 0.90, D 0.85, E 0.80, F 0.75, G 0.70. This is a puzzle-battle reading of aptitude and has no effect on the
race engine.

Every orb also has a glyph and accessible label. Colour is never the only carrier of strategy or state.

### Turn resolution

The engine resolves one accepted drag in this order:

1. Find all matches on the released board and clear them simultaneously.
2. Apply gravity, fill from the run's seeded stream, and repeat until no cascade remains.
3. Total each attack style, Recovery and Spark charge. One connected match is one combo; all cascades count toward the
   same turn's combo multiplier.
4. Apply attacks in Front, Pace, Late, End, then Spark order; a defeated rival cannot act.
5. Apply Recovery, capped at maximum Drive, and charge Spark Shift.
6. Advance the rival countdown. At zero, execute the already displayed intent and reset its countdown.
7. Check victory, loss and the **eight-player-turn bound for the current wave**.

The T071 simulator baseline is below. These are checked-in tuning constants, not private content fields. `pnpm sim:spark`
and the domain test pin them; any change follows AGENTS.md's design/decision/domain-test rule.

| Constant/formula | T071 baseline |
|---|---|
| Maximum Drive | 100 |
| Match shape | `1 + 0.25 × (orbs − 3)` |
| Whole-turn combo | `1 + 0.20 × (combos − 1)` |
| Style attack per match | `round(40 × shape × combo × aptitude × matchup)` |
| Spark attack per match | `round(30 × shape × combo)` |
| Recovery per match | `round(6 × orbs × combo)` |
| Spark charge | cleared Spark orb count; ready at 9 |
| Delay | +3 remaining requirement; ready threshold capped at 15 |
| Difficulty factor | `1 + 0.01 × (tier − 1) + 0.015 × (TL − 1)` |
| Wave Resolve | `round([500, 650, 900][wave] × difficulty)` |
| Base Pressure | `round([12, 16, 24][wave] × difficulty)` before recipe modifiers |

### Spark Shift

Spark matches fill one visible run-scoped gauge. At full charge, **Spark Shift** is a separate player action: it converts
every Spark orb currently on the board into the trainee's highest-aptitude strategy orb. Ties use Front, Pace, Late, End
order. The converted board does not resolve until the next drag, so the player still has to route it. Shift never consumes
a turn or permits a second drag, and rival **Delay** may add charge to the remaining requirement but cannot empty earned
charge.

### Rivals and intent

Every rival shows portrait, name, primary strategy, current/max Resolve, countdown and next intent before the player
touches the board. Four base archetypes make the first read predictable: **Rush** (Front), **Tracker** (Pace), **Surge**
(Late) and **Finisher** (End).

| Intent | Contract |
|---|---|
| **Pressure** | Remove the displayed amount of Drive |
| **Guard** | Reduce the next turn's damage unless the displayed combo threshold is met |
| **Convert** | Change a displayed, bounded orb kind into another using seeded cell order |
| **Delay** | Add the displayed charge requirement to Spark Shift |
| **Enrage** | Permanently increase later Pressure after the displayed trigger |
| **Change style** | Change strategy, weakness and resistance at a Resolve threshold |

Private candidates choose one checked-in recipe; their opening strategy is the template's stable best strategy. The four
style recipes require a matching best strategy, while adaptive/boss accept any:

| Recipe | Script |
|---|---|
| `rush-pressure` (Front) | countdown 2; Pressure; below half, Enrage once to ×1.5 later Pressure |
| `tracker-guard` (Pace) | countdown 3; Guard by 50% unless 4 combos, then Pressure, repeat |
| `surge-convert` (Late) | countdown 2; convert up to 4 orbs that beat it into its own style, then Pressure, repeat |
| `finisher-delay` (End) | countdown 3; Delay +3, then ×1.5 Pressure, repeat |
| `adaptive-duel` | countdown 2; Pressure; below half, change once to resist trainee's best strategy |
| `circuit-boss` | countdown 2; Guard → Convert → Pressure; one adaptive phase below half |

Intent has no hidden target selection. A status must be visible on the rival or gauge for its entire lifetime. A wave ends
immediately at zero Resolve. A run ends in a loss at zero Drive or when the eighth player turn finishes without clearing
the wave; no ninth drag begins.

### Training EXP and levelling

Wave EXP budgets are **500 / 650 / 800**. An uncleared wave pays
`floor(budget × Resolve removed / max Resolve)`; clearing pays that wave's exact budget. A full circuit adds 50, plus
`min(100, 10 × max(0, total combos − completed drags))`, plus up to 100 proportional to Drive remaining. A loss gets
no bonuses and is capped at 45% of the 1,950 wave-budget total. This prevents a high-Resolve rival, healing or stalling from
being an unintended EXP farm and makes a full clear substantially more efficient than repeatedly losing late.

The pinned balance target is **about 2,200 Training EXP for a competent three-wave clear**, with losses retaining only the
bounded progress actually earned. Training EXP resolves greedily and surplus carries:

```
targetExp(n) = 1000 + 350 × (n − 1)        n = the level you are leaving, 1–9
```

| Leaving TL | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| EXP to next | 1000 | 1350 | 1700 | 2050 | 2400 | 2750 | 3100 | 3450 | 3800 |

The full TL1→10 curve is 21,600 EXP, so the target remains roughly **ten good clears**. A run can cross more than one
level. A loss is real—the encounter ends—but the ticket is not made worthless because partial EXP is still committed.
At TL10, a run cannot be started for that Uma and scenario.

Levelling unlocks constellation nodes immediately ([Constellations](constellations.md#unlock-schedule)); the
post-run summary names exactly which nodes opened.

The result first states **Circuit cleared** or the loss reason, then shows EXP earned, before/after Training Level and bar,
every level crossed, and every newly opened constellation node **by its real name**. Each opened node links back to that
Uma's constellation.

### Cost and rewards

**1 training ticket per run** (D148). A day's 10 tickets take about one Uma to TL10, which keeps tickets the pacing
currency they have always been ([Economy](economy.md)).

Training EXP and node unlocks are its only progression outputs. Rivals are sparring partners: a run never grants Uma EXP,
finishes a career goal, creates a race record, pays a race ticket, or advances race badges and milestones.

### Encounter content

Each of the fourteen scenarios has an authored private roster of eligible ordinary rivals and bosses. The gitignored
input is `content/overrides/spark-rivals.json`; the content pipeline resolves its private Uma template ids and emits a
hashed `spark-rivals` pack. Definitions choose an archetype, intent script and optional phase-two strategy. Resolve,
Pressure and EXP budgets come from checked-in tier/TL curves so private content cannot silently change balance.

The importer rejects missing ids, an encounter with the trainee as its own rival, duplicate rivals in one run, a scenario
without enough eligible rivals, unknown intents and a boss with no complete script. Checked-in fixtures are small and
synthetic. A production publication is incomplete until every scenario validates.

If an older publication has no rival pack, the client deterministically composes two rivals and a boss from the loaded
Uma catalogue, excluding the trainee's character, and records a diagnostic. The fallback must start a playable run; it is
not permission to check original-game data into git or to skip publishing the private roster.

### Determinism, journal and commit

The pure engine contract is:

```text
state = replay(encounter, seed, actions)
```

A drag action stores its ordered cell path and movement duration clamped to the allowed clock; Spark Shift is its own
action. The engine owns initial fills, skyfalls, seeded conversions and rival choices. It has no React, PixiJS, DOM, wall
clock or `Math.random` dependency.

The device-local `minigameRuns` row carries an engine version and an action list bounded to 64 entries. Each action appends in one Dexie
transaction under the expected prior action count, so two stale screens cannot both advance a run. Reload replays the
same board, wave, Drive, Resolve, gauges and intent. `commitRun` replays that stored journal and computes Training EXP; it
does not trust a score supplied by the screen. Completion remains idempotent by `runId`. The journal does not sync and
does not change the cloud save schema.

An open run created by the retired adjacent-swap version keeps its reservation, ticket and seed, but starts Rival Circuit
with an empty action list. It is never charged again. Already completed rows remain historical records.

### Presentation and touch

The route is `/minigames/spark-match/:umaId` and remains lazy. Presentation is hybrid:

- **PixiJS 8** owns the 30 orb sprites, held orb, swaps, clear/fall/cascade sequence, pooled particles, attacks, rival
  reactions and damage/recovery numbers.
- **React DOM** owns navigation, wave label, Drive/Resolve/Spark gauges, strategy and intent, tutorial, accessible live
  announcements and result actions.
- **Pointer Events** on the canvas own one active drag using `setPointerCapture`; the canvas uses `touch-action: none`,
  ignores a second pointer, handles `pointercancel` and `lostpointercapture`, and does not set React state on each move.

The held orb is drawn slightly above the finger; displaced orbs slide into the previous cell. Resolution animation follows
steps already produced by the engine and temporarily locks input. Sprites and effect objects are pooled, canvas resolution
is capped to useful art density, the ticker pauses when hidden, and all movement uses elapsed milliseconds. The target is a
stable 60 fps on the owner's iPhone, with 120 Hz presentation where Safari supplies it; game results never depend on refresh
rate. Reduced motion shortens travel and removes nonessential particles without removing board-state feedback.

At 390 × 844 the entire run has no page scroll, the board remains square-celled, HUD and board avoid the safe areas, and
every DOM control is at least 44 pt. Physical-device validation must cover finger occlusion, edge/system gestures, pointer
cancellation, background/resume and sustained frame pacing; browser emulation alone is not acceptance.

---

## Friendship Training — card stars

The card minigame (D146, D177): a Balatro-style run that trains one card through a season of weeks and races. A clear
is **one star in one scenario**, for one ticket, all or nothing. D168 closed its lists, D173 gave it a sense of place,
and the numbers are tuning drafts held by `pnpm sim:training`, which keeps the bot's clear rates near 90 / 85 / 80 / 75
/ 70% for 1★–5★ and every scenario twist within its band. The engine is `packages/domain/src/friendship-*.ts`; the
screens are `apps/web/src/screens/minigames/friendship/`.

### Fixed choices (D146)

- **Target and price:** a run names one card and one scenario, costs **1 ticket** (D148), and a clear gives that card
  **+1★ there**. There is no partial progress: a loss costs the ticket and nothing else.
- **Owned cards only.** Runs never show unowned cards; unlocking stays tickets and coupons (D130).
- **Spark Match stays separate** and remains the only way to raise a Training Level. M022 replaces its adjacent-swap
  rules with Rival Circuit before this milestone begins; Friendship Training does not share combat, rewards or UI with it.
- **Length grows with the star being earned**, so early stars are quick and the fifth is a real run.
- **Seeded and resumable:** the run is a pure function of its setup and the player's choices, so a reload resumes it
  exactly and cannot reroll a friendlier draw.

### A run

A run is a short **season of stages**. Each stage is **two training weeks and a race**:

| Earning | Stages | Races | About |
|---|---|---|---|
| 1★ | 1 | G3 | 5 min |
| 2★ | 2 | G3, G2 | 8 min |
| 3★ | 2 | G3, G2 (harder targets) | 8 min |
| 4★ | 3 | G3, G2, G1 | 12 min |
| 5★ | 3 | G3, G2, G1 (harder targets) | 12 min |

Each stage's race is drawn by the seed from the real races of its grade. Missing any week's or race's target ends
the run.

### The deck

- **Starting deck (12):** two copies of the **main card** and two of each other card in the set the run was launched
  from. A set with fewer than six cards is topped up from owned, era-eligible cards chosen by the seed.
- **Rewards:** after each training week, **pick 1 of 3** owned, era-eligible cards to add a copy of, or skip.
- **Card strength** grows with the card's own stars in this scenario, `× (1 + 0.1 × stars)`, so bonding one card makes
  the next run easier.

### An encounter

Every week and every race is an **encounter**: the whole deck is shuffled, the main card goes into the hand, and the
hand fills to 7. Scoring an encounter's target ends it at once; every train left unused pays 2 fans.

### A training week

1. **Pick a facility** from three offered (three different stat types). They differ: an easy one (target × 0.9, 2
   fans), a standard one (× 1, 3 fans) and a hard one (× 1.15, 4 fans), so the choice is type against payout.
2. **Hand of 7**, with **3 trains** and **2 redraws** (discard up to five and draw back).
3. **Train:** select 1–5 cards. Every selected card scores its points, and the best **formation** the selection
   makes sets the rest: `(card points + formation points) × (formation mult + bonuses)`.

| Formation | Rule | Points | Mult |
|---|---|---|---|
| Solo | anything | 5 | 1 |
| Duo | two copies of one card | 10 | 2 |
| Friendship | two on-type cards | 15 | 2 |
| Trio | three copies of one card | 30 | 3 |
| **Rainbow** | three or more on-type cards | 30 | 3, +1 per card past three, up to 5 |
| Full team | all five stat types | 40 | 4 |
| Rainbow team | five on-type cards | 60 | 6 |

- **On-type** means the card's type is the facility's. Friend and Group cards count as any type, and so fill a gap in
  a Full team.
- **Card points:** 10 on-type, 5 elsewhere; Friend and Group cards score 7 anywhere. Then × the card's strength.
- **Each card's trait** comes from its strongest effect-profile weight, so the 312 cards need no hand-written rules:

| Strongest weight | Trait | Cards |
|---|---|---|
| Friendship Bonus | +1 mult on its own facility | 68 |
| Training Bonus | +6 points | 67 |
| Race Bonus | +50% card points in races | 52 |
| Specialty Priority | counts twice towards a Rainbow | 43 |
| Stat Bonus | +4 points, +2 more on its own facility | 34 |
| Hint Frequency | draw a card after the train | 28 |
| Skill Point Bonus | +1 fan when played | 13 |
| Initial Stats | +10 points on the encounter's first train | 7 |

### The main card

- It is **always in the opening hand**.
- Each train it joins fills its **friendship gauge**. At 3, it is **bonded for the rest of the run**: it counts as
  on-type everywhere, and its **signature** switches on: its unique effect's kinds from the original data, as the
  matching traits at ×1.5 (a unique effect with no matching kind repeats the card's own trait at ×1.5).
- This is the fantasy: training *with* the card until it lights up, as rainbow training did in the original.

### Races

The same play with **4 trains**, no facility choice, and its own target. The course sets two
favoured types, which count as on-type:

| Distance | Turf | Dirt |
|---|---|---|
| Sprint | Speed, Power | Power, Guts |
| Mile | Speed, Wit | Speed, Power |
| Medium | Speed, Stamina | Speed, Power |
| Long | Stamina, Guts | Stamina, Power |

One **rival rule** applies, drawn by the seed:

| Rival rule | Effect |
|---|---|
| Front-runner | your first train scores half |
| Heavy going | Speed cards score half their card points |
| Marked | the main card's trait and signature are off |
| Fast pace | one redraw fewer |
| Crowded field | hand size 6 |
| Stamina test | trains of fewer than three cards score half |
| Traffic | Rainbow, Full team and Rainbow team get −1 mult |
| Duel | the target is 25% higher, and you get a fifth train |

Winning a race offers **1 of 3 skills**. After every race but the last, the shop opens.

### Skills (the relics)

- **Five slots.** A full bar can replace a slot or skip. Offers come from the main card's hint skills first, then the
  other deck cards' hints, then the learnable white and gold pool.
- **A skill's rule is generated from its data**: its effect and where it fires pick one of twelve rules, and gold
  skills are stronger than white. When a skill has several effects, the first of start, recovery, vision, lane,
  acceleration, speed, stats, debuff decides.

| Rule | From | White | Gold |
|---|---|---|---|
| Gate | start (gate) skills | a race's first train × 1.5 | × 2 |
| Second Wind | recovery | +1 redraw each encounter | +2 |
| Vision | vision | +1 hand size | +1 hand size and +1 redraw |
| Positioning | lane | +1 train in races | +1 train and +1 mult in races |
| Kick | acceleration | +4 points per card trained | +6 |
| Corner | speed at a corner | an encounter's first train × 1.5 | × 2 |
| Straight | speed on a straight | +20 points on a train of four or more | +30 |
| Spurt | speed late in the race | +3 mult on an encounter's last train | +5 |
| Surge | any other speed skill | +2 mult on a train with a Speed card | +3 |
| Aptitude | stat (green) skills | +5 points per card of the stat it raises | +8 |
| Pressure | debuffs | the rival rule lifts after your first train | the rival rule is off |
| Form | anything else | +10 points on every train | +15 |

- **The skill's name and its race effect are shown with its run rule**, so the run teaches what the skill does on track.

### Fans and the shop

- **Fans** are the run's currency: a week's payout, 5 for a race, +2 per unused train, and the Skill Point trait.
- **The shop** opens after each race but the last. It sells a card copy (4), a removal (3), an upgrade of +5 points to
  one copy (3), a white skill (6), a gold skill (8) and a reroll of the copy and skills (2). Fans vanish at the end of
  the run.

### The hand at 390 × 844 (D168)

Seven full-art cards will not fit in one row, and a fan hides the art, so the hand is **two rows**: 4 over 3, each
card its full 3:4 illustration at about 80 × 107 pt, uncropped. Eight or nine cards (Vision) make 4 over 4 or 5 over
4 at the width that fits. A card's face carries its type icon (top left) and its points here (bottom right); the
main card wears its gauge (three pips) and, once bonded, a gold ring. **Tap** selects (the card lifts and rings);
**long-press** opens its sheet: trait, signature, points on this facility. The hand sits in the thumb zone above
**Redraw** and **Train**; the target, score bar and live readout ("Rainbow · 45 × 4 = 180") sit above it. At
375 × 667 the cards shrink to about 72 × 96 pt and nothing scrolls.

### A run's lifecycle (D168)

- **Begin** spends the ticket and freezes the run's **setup**: the deck's cards with their types, traits, signatures
  and strengths, the reward and skill pools, the chosen races and the twist. The run replays from that setup, so a
  content update mid-run cannot change it.
- **Every choice is saved** on the run's local row as it is made. Leaving or reloading resumes exactly where the run
  was; the Start screen says **Resume**. One open run per card and scenario; different cards can each have one.
- **Give up** (behind a confirm) ends the run as a loss. The ticket stays spent.
- **Runs are local.** The ticket and a cleared star sync; a run in progress stays on the device that began it.
- **The commit replays** the setup and the saved choices, and grants the star only if the replay clears.
- **Journal implementation:** use M022's generic local action-journal port and expected-action-count append. Do not add a
  second Dexie migration or parallel journal service; Friendship Training's frozen setup remains part of its own row.

### Balance (`pnpm sim:training`)

A headless bot plays seeded runs for each star (greedy best formation, redraws towards on-type cards, simple shop
choices). Targets are tuned until the bot clears about **90% / 85% / 80% / 75% / 70%** for 1★–5★; a person who plans
ahead does better. The table is printed and gated like `sim:careers`.

### Screens

A lazy DOM route, `/minigames/friendship-training/:cardId?tier&uma&return`, with Motion `m.*` and transforms only.

- **Start:** the main card's art (D144), stars now → next, run length, the scenario's twist, cost, **Begin · 1
  ticket** (or **Resume**).
- **Week choice:** three facility cards with target and payout.
- **Training and races:** as laid out above, with the skills bar under the header.
- **Reward, skill, shop and result** screens, the result celebrating the star.
- **How to play:** an illustrated guide, opened once by itself, then from the start screen and the run's menu (the
  menu also holds Give up), at the page that fits the moment; its numbers come from the rules module.
- **A sense of place** (D173): a season map across the top, and a scene where the main card's character trains at
  the facility or runs the race, with the friendship hearts and each train's result rising above them.
- Reachable from every **Bond** button: the card page, the Cards tab's scenario lenses, the Training scene's card set and a constellation node's sheet (D177).

### Scenario twists

Each scenario's run carries **its buff's theme** (D165) as one run rule, so a scenario has one identity in both
places. Drafts, each with a sim row:

| Scenario | Twist |
|---|---|
| URA Finale | **Foundation:** none, the base game |
| Unity Cup | **Team Spirit:** a train with five different characters adds +1 mult |
| Trackblazer | **Climax:** each race won adds +1 mult to every later train |
| Our Grand Concert | **Performance:** each train earns a note for every stat type in it; with all five, the next train scores × 2 and the notes reset |
| Grand Masters | **Fragments:** each train earns a fragment, two with a card at 4★ or more; at eight, the next train scores × 1.5 |
| Project L'Arc | **Expedition:** winning a race takes its first favoured type with you: on-type for the rest of the run |
| U.A.F. Ready GO! | **Genres:** the same facility in consecutive weeks adds +1 mult per week of the streak |
| Great Food Festival | **Cooking:** each week's facility gives its ingredient; three of a kind cook a dish, × 1.2 for the next three trains |
| Run! Mecha Umamusume | **Research:** each cleared week upgrades its facility, +10% there per level for the rest of the run |
| The Twinkle Legends | **Legends:** one other card of the set plays as if at 5★ |
| Design Your Island | **Construction:** before the first week, build two facilities; they pay +5 points per card |
| Yukoma Hot Springs | **Soak:** after each race, the next stage's weeks get +1 redraw |
| Beyond Dreams | **Shared Light:** the two facility types trained least get +1 mult |
| Tracen Diner | **Orders:** each week posts a formation; filling it pays 3 fans |

### What it never does

- Unowned cards in runs, scouting, or any new unlock path (D146).
- Training Level progress from runs: Spark Match owns it.
- Meta-progression inside the minigame (permanent run upgrades); the stars are the progression.

---

## What this replaces

Deleted outright, with the save fields that carried them:

- The training turn: the deterministic card deal, facility choice, gain formula, crowd and friendship
  multipliers, and the 1200 soft-cap halving on gains.
- Skill hint rolls. Skills now come from node assignments ([Constellations](constellations.md#skills)).
- Card EXP and the 1–25 level curve.
- **Bond Recall**, the match-2 memory game that first earned card stars, retired by Friendship Training (D177). Its
  links redirect, and a run left open there gave its ticket back.
- Scenario modifiers as training-gain multipliers. A scenario's identity is now its cap profile, its
  constellation shape and slot count, and its buff ([Scenarios](scenarios.md#scenario-buffs)).
