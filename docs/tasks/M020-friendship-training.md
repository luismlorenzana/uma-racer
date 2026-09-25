# Milestone 20 — Friendship Training

**Outcome:** Bond Recall's memory grid is replaced by **Friendship Training**, a Balatro-style roguelite in which you
train one card through a short season of weeks and races. A clear earns that card **one star in one scenario**.

Decisions: D146 (the game and its rules of engagement), built on D147 (stars) and D148 (tickets), which landed with
M019. Research: [Roguelite Card Minigame](../research/roguelite-card-minigame.md).
Owner: Claude. **All numbers below are tuning drafts**; the balance bot (T063) sets them.

| Task | Scope |
|---|---|
| T063 | The game: engine, balance bot, screens, reachable as a beta beside Bond Recall |
| T064 | Scenario twists: each scenario's run carries its original mechanic |
| T065 | Cutover: every Bond link opens Friendship Training; Bond Recall is deleted |

## Fixed choices (D146)

- **Target and price:** a run names one card and one scenario, costs **1 ticket** (D148), and a clear gives that card
  **+1★ there**. There is no partial progress: a loss costs the ticket and nothing else.
- **Owned cards only.** Runs never show unowned cards; unlocking stays tickets and coupons (D130).
- **Spark Match is untouched** and stays the only way to raise a Training Level.
- **Length grows with the star being earned**, so early stars are quick and the fifth is a real run.
- **Seeded and resumable:** the run is a pure function of its seed and the player's choices, so a reload resumes it
  exactly and cannot reroll a friendlier draw.

## The game (T063)

### A run

A run is a short **season of stages**. Each stage is **two training weeks and a race**:

| Earning | Stages | Races | About |
|---|---|---|---|
| 1★ | 1 | G3 | 5 min |
| 2★ | 2 | G3, G2 | 8 min |
| 3★ | 2 | G3, G2 | 8 min |
| 4★ | 3 | G3, G2, G1 | 12 min |
| 5★ | 3 | G3, G2, G1 (harder targets) | 12 min |

Races are drawn from the scenario's real calendar at each grade, like the career stages (D137). Missing any week's
or race's target ends the run.

### The deck

- **Starting deck (12):** two copies of the **main card** and two of each other card in the set the run was launched
  from. A set with fewer than six cards is topped up from owned, era-eligible cards chosen by the seed.
- **Rewards:** after each training week, **pick 1 of 3** owned, era-eligible cards to add a copy of, or skip.
- **Card strength** grows with the card's own stars in this scenario, `× (1 + 0.1 × stars)`, so bonding one card makes
  the next run easier.

### A training week

1. **Pick a facility** from three offered (Speed, Stamina, Power, Guts, Wit). Each shows its target and its fan
   payout.
2. **Hand of 7**, with **3 trains** and **2 redraws** (discard up to five and draw back).
3. **Train:** select 1–5 cards. The best **formation** they make scores:
   `(card points + formation points) × (formation mult + bonuses)`.

| Formation | Rule | Points | Mult |
|---|---|---|---|
| Solo | anything | 5 | 1 |
| Duo | two copies of one card | 10 | 2 |
| Friendship | two cards of the facility's type | 15 | 2 |
| Trio | three copies of one card | 30 | 3 |
| **Rainbow** | three or more cards of the facility's type | 30 | 3, +1 per card past three |
| Full team | all five stat types | 40 | 4 |
| Rainbow team | five cards of the facility's type | 60 | 7 |

- **Card points:** 10 on its own facility, 5 elsewhere. Friend and Group cards score 7 anywhere and count as any type.
- **Each card's trait** comes from its strongest effect-profile weight, so 312 cards need no hand-written rules:

| Strongest weight | Trait |
|---|---|
| Friendship Bonus | +1 mult on its own facility |
| Training Bonus | +6 points |
| Stat Bonus | +4 points, +2 more on its own facility |
| Skill Point Bonus | +1 fan when played |
| Specialty Priority | counts twice towards a Rainbow |
| Hint Frequency | draw a card after the train |
| Race Bonus | +50% points in races |
| Initial Stats | +10 points on the week's first train |

### The main card

- It is **always in the opening hand**.
- Each train it joins fills its **friendship gauge**. At 3, it is **bonded for the rest of the run**: it counts as the
  facility's type everywhere, and its **signature** switches on. The signature is its unique effect's kinds from the
  original data, turned into the matching trait at ×1.5.
- This is the fantasy: training *with* the card until it lights up, as rainbow training did in the original.

### Races

The same play with **4 trains**, no facility choice, and a higher target. The course sets the favoured types (Sprint:
Speed and Power · Mile: Speed and Wit · Medium: Speed and Stamina · Long: Stamina and Guts · dirt adds Power), which
score as on-facility. One **rival rule** from a list of about eight applies (a front-runner halves your first train, a
heavy track dampens Speed, and so on). Winning a race offers **1 of 3 skills**.

### Skills (the relics)

- **Five slots.** They are offered after races and in the shop, from the main card's hint skills first, then the
  scenario's skill pool.
- **A skill's rule is generated from its data**: the effect it has in races picks one of about ten archetypes, and gold
  skills are stronger than white. For example, a speed-up gives +2 mult to trains with a Speed card, recovery gives +1
  redraw a week, a corner skill doubles the first train each week, and vision gives +1 hand size.
- **The skill's name and its race effect are shown with its run rule**, so the run teaches what the skill does on track.

### Fans and the shop

- **Fans** are the run's currency: +2 per unused train, and the Skill Point trait.
- **The shop** opens after each race. It sells a card copy (4), a removal (3), an upgrade of +5 points (3), a white skill
  (6), a gold skill (8) and a reroll (2). Fans vanish at the end of the run.

### Determinism and persistence

- **One seeded RNG** for every shuffle, offer and rival rule, derived from the run seed with a stream per purpose (lift
  `packages/race/src/rng.ts` into the domain or share it). Never `Math.random`.
- **State = replay(seed, actions).** The run stores only the list of the player's choices (facility, cards trained,
  redraws, rewards, purchases) in the run's local row, appended after each action. A reload replays them.
- **The outcome** is committed through the existing minigame host (`kind: 'friendship-training'`), which validates it
  by replaying the actions, so a committed clear is always a real one.

### Balance (`pnpm sim:training`)

A headless bot plays seeded runs for each star (greedy best formation, redraws towards Rainbow, simple shop choices).
Targets are tuned until the bot clears about **90% / 85% / 80% / 75% / 70%** for 1★–5★; a person who plans ahead does
better. The table is printed and gated like `sim:careers`.

### Screens

A lazy DOM route, `/minigames/friendship-training/:cardId?tier&uma&return`, with Motion `m.*` and transforms only.

- **Start:** the main card's art (D144), stars now → next, run length, cost, **Begin · 1 ticket**.
- **Week choice:** three facility cards with target and payout.
- **Training:**
  - Top: week, target and a score bar.
  - Middle: the facility banner and a live readout ("Rainbow · 45 × 4").
  - Bottom (the thumb zone): the hand of 7 full-art cards, and **Train** and **Redraw**. Selecting a card lifts it.
- **Reward, race, shop and result** screens, the result celebrating the star.
- Reachable from the card page as **Friendship Training (beta)** beside Bond until T065.

## Scenario twists (T064)

Each scenario's run adds one rule from the original scenario, reviving the training-turn designs of D116–D118 as run
rules. These are drafts, each with a sim row:

| Scenario | Twist |
|---|---|
| URA Finale | none: the base game |
| Unity Cup | **Team:** a train with five different characters adds +3 mult |
| Trackblazer | **Items:** the shop sells one-use items (+1 train, +2 mult, redraw a full hand) |
| Our Grand Concert | **Notes:** each train earns its facility's note; five different notes play a performance that doubles the next train |
| Grand Masters | **Fragments:** every train earns one; the eighth scores ×1.5 |
| Project L'Arc | **Stamps:** five stamps make one type count as on-facility for the rest of the run |
| U.A.F. Ready GO! | **Genres:** facilities carry a colour; the same colour in a row adds +1 mult per streak |
| Great Food Festival | **Cooking:** facilities give ingredients; three of a kind cook a dish, ×1.2 for three trains |
| Run! Mecha Umamusume | **Research:** points upgrade a facility, +10% per level for the rest of the run |
| The Twinkle Legends | **Legends:** one card in the deck plays as if at 5★ |
| Design Your Island | **Construction:** pick two facilities to build; they pay +5 points per card |
| Yukoma Hot Springs | **Soak:** after each race, restore one redraw for the next stage |
| Beyond Dreams | **Shared light:** the two types you have trained least get +1 mult |
| Tracen Diner | **Orders:** each week posts an order (a formation); filling it pays fans |

## Cutover (T065)

When the owner has played T063 and T064 and prefers them: every Bond button (card page, Cards tab lens, card set,
node sheet) opens Friendship Training; `/minigames/bond-recall` redirects there; Bond Recall's code, tests and docs
are deleted, and minigames.md describes Friendship Training as the card minigame.

## Tests

- Engine: every formation is detected and scored; traits apply; the gauge bonds at 3; each race's favoured types and
  rival rule; shop prices; loss on a missed target.
- Determinism: the same seed and actions give the same state; replaying a stored action list reproduces a run; an
  invalid action list is rejected at commit.
- Persistence: a reload mid-week resumes exactly; a committed run cannot be committed twice.
- `sim:training` holds its clear-rate table.
- The screens fit 375 × 667 and 390 × 844 with no clipping, and the hand stays in the thumb zone.

## Out of scope

- Unowned cards in runs, scouting, or any new unlock path (D146).
- Training Level progress from runs: Spark Match owns it.
- Meta-progression inside the minigame (permanent run upgrades); the stars are the progression.
