# Milestone 20 — Friendship Training

**Outcome:** Bond Recall's memory grid is replaced by **Friendship Training**, a Balatro-style roguelite in which you
train one card through a short season of weeks and races. A clear earns that card **one star in one scenario**.

Decisions: D146 (the game and its rules of engagement), built on D147 (stars) and D148 (tickets), which landed with
M019; D168 closes the spec's open lists (skill rules, rival rules, the hand, a run's lifecycle, the twists).
Research: [Roguelite Card Minigame](../research/roguelite-card-minigame.md). Owner: Claude. **All numbers below are
tuning drafts**; the balance bot (T063) sets them.

**Dependency:** M022 (T071–T074) lands first. Friendship Training reuses its versioned, device-local action journal and
expected-action-count append port; it does not add a competing Dexie journal migration.

| Task | Scope |
|---|---|
| T063 | The game: engine, balance bot, screens, reachable as a beta beside Bond Recall |
| T064 | Scenario twists: each scenario's run carries its buff's theme as a run rule |
| T065 | Cutover, once the owner has played it: every Bond link opens Friendship Training; Bond Recall is deleted |

## Fixed choices (D146)

- **Target and price:** a run names one card and one scenario, costs **1 ticket** (D148), and a clear gives that card
  **+1★ there**. There is no partial progress: a loss costs the ticket and nothing else.
- **Owned cards only.** Runs never show unowned cards; unlocking stays tickets and coupons (D130).
- **Spark Match stays separate** and remains the only way to raise a Training Level. M022 replaces its adjacent-swap
  rules with Rival Circuit before this milestone begins; Friendship Training does not share combat, rewards or UI with it.
- **Length grows with the star being earned**, so early stars are quick and the fifth is a real run.
- **Seeded and resumable:** the run is a pure function of its setup and the player's choices, so a reload resumes it
  exactly and cannot reroll a friendlier draw.

## The game (T063)

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
| **Rainbow** | three or more on-type cards | 30 | 3, +1 per card past three |
| Full team | all five stat types | 40 | 4 |
| Rainbow team | five on-type cards | 60 | 7 |

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

The same play with **4 trains**, no facility choice, and a target about twice a week's. The course sets two
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
- Reachable from the card page as **Friendship Training (beta)** beside Bond until T065.

## Scenario twists (T064)

Each scenario's run carries **its buff's theme** (D165) as one run rule, so a scenario has one identity in both
places. Drafts, each with a sim row:

| Scenario | Twist |
|---|---|
| URA Finale | **Foundation:** none, the base game |
| Unity Cup | **Team Spirit:** a train with five different characters adds +3 mult |
| Trackblazer | **Climax:** each race won adds +1 mult to every later train |
| Our Grand Concert | **Performance:** each week's train earns its facility's note; with all five, the next train scores × 2 and the notes reset |
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

## Cutover (T065)

When the owner has played T063 and T064 and prefers them: every Bond button (card page, Cards tab lens, card set,
node sheet) opens Friendship Training; `/minigames/bond-recall` redirects there; Bond Recall's code, tests and docs
are deleted, and minigames.md describes Friendship Training as the card minigame.

## Tests

- Engine: every formation is detected and scored; traits apply; the gauge bonds at 3; each race's favoured types and
  rival rule; each skill rule and twist; shop prices; loss on a missed target.
- Determinism: the same setup and actions give the same state; replaying a stored action list reproduces a run; an
  invalid action list is rejected at commit.
- Persistence: a reload mid-week resumes exactly; a committed run cannot be committed twice.
- `sim:training` holds its clear-rate table.
- The screens fit 375 × 667 and 390 × 844 with no clipping, and the hand stays in the thumb zone.

## Out of scope

- Unowned cards in runs, scouting, or any new unlock path (D146).
- Training Level progress from runs: Spark Match owns it.
- Meta-progression inside the minigame (permanent run upgrades); the stars are the progression.
