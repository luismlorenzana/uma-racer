# 05 · The build

> **Status: generation 3, the rules built (T153, D382).** The screens that show them (Tree · Deck · Bonds · Skills) are
> T158's, and the stages and races that fill the wallet are T154's and T155's. The model is
> [05 · card mechanics](../research/drawing-board/05-card-mechanics.md) §3–§4. Cards and their bond tracks are
> [06](06-cards-and-bonds.md).

An Uma's career is built by hand. The stages and races pay **resources** into the career's wallet; the owner spends
them in her **tree**. Every session in the tree pays what the original game's training formula gives, computed from the
real effects of the support cards **posted** to that branch. Nothing is random and nothing runs on a clock.

Code: `packages/domain/src/build/` (`@racer/domain/build`).

## 1. The wallet

Each career has a wallet with three resources:
- **Drills** in five colours, one per stat. They buy pips in the branch of that colour.
- **Bond**, poured into one deck card's bond track at a time ([06](06-cards-and-bonds.md) §4).
- **SP** that stages and races pay. Skills spend it together with the SP the build itself earns (§8).

## 2. The deck and posting

- **The deck** holds six owned SSRs whose era allows the career's scenario (T = 1 for URA Finale: cards of era 1).
  Every card counts at its top level (an SSR's level 50).
- **Posting:** each deck card trains at one branch.
  - By default it goes to its own type's branch. Friend and Group cards go to Wit.
  - A branch seats five cards, as a facility does. A card posts once.
  - A new deck card whose default branch is full goes to the first branch with a free seat (Speed, Stamina, Power,
    Guts, Wit).
- **Changing the deck or a post** keeps every bought pip. What the pips pay is read again from the new deck (§5).
- The deck refuses, in plain words: a seventh card, a card twice, a card not unlocked, and a card from a later era.

## 3. The tree

Five branches, one per facility. Each branch climbs facility levels 1 to 5, and each level is four **pips**, as the
original levels a facility every four uses. A pip is one training session.

- **Order:** pips open in order. The next level opens when its four pips are bought.
- **Cost:** a pip costs drills of its branch's colour by level. Energy Cost Reduction on the cards posted there cuts it
  (summed, rounded up). Wit Friendship Recovery takes whole drills off a Wit pip while that card is in friendship. A
  pip never costs less than one drill.
- **Camp nodes:** two of them, open once any branch reaches level 3 (its first eight pips bought). Each Camp is four
  level-5 sessions in the branch the owner picks, like the original's summer camps. They are the tree's free choices.
  The two may share a branch.

<!-- live:build-pip-costs -->
| Level | A pip | The level's four pips |
|---|---|---|
| 1 | 20 drills | 80 drills |
| 2 | 22 drills | 88 drills |
| 3 | 24 drills | 96 drills |
| 4 | 26 drills | 104 drills |
| 5 | 28 drills | 112 drills |

A Camp node costs 4 level-5 sessions: 112 drills before cuts. A full branch costs 480 drills.
<!-- /live -->

<!-- live:build-rules -->
| Rule | Value |
|---|---|
| Deck | 6 owned SSRs whose era allows the scenario, at card level 50 |
| Seats per branch | 5 |
| The tree | 5 branches × 5 levels × 4 pips = 100 pips |
| Camp nodes | 2, open once a branch reaches level 3; each 4 level-5 sessions in the branch you pick |
| Mood | fixed at Great: +20%, scaled by Mood Effect |
| Headcount | +5% a card posted to the branch |
| Friendship | an own-type card at bond 80 or more |
| The scale s(T) | T1: 1 |
| Bond track | 0–100, from the card's Initial Friendship Gauge |
| A hint | every round(20 ÷ (1 + Hint Frequency)) bond |
| Extra bond | a pour × (7 + the extra) ÷ 7 |
| Skills held | 64 |
| SP a URA Finale career spends | 2,000 |
<!-- /live -->

## 4. What a session pays

One session at a branch and level pays, for each stat that facility trains:

```
gain[stat] = floor( s(T) × (Base[stat] + Σ Stat Bonus[stat])
                  × Π over cards in friendship of (1 + Friendship) × (1 + Unique Friendship)
                  × (1 + 0.20 × (1 + Σ Mood Effect))
                  × (1 + Σ Training Effectiveness)
                  × (1 + 0.05 × cards posted there)
                  × (1 + her Growth[stat]) )
gain[SP]   = the same on Base SP + Σ Skill Point Bonus, without growth
```

In words:
- **Base** is URA Finale's facility table at the pip's level, the same in every scenario.
- **Stat Bonus** adds flat, before every multiplier, and only to stats the facility trains. A Power Bonus counts at
  Speed, which trains Power; a Wit Bonus doesn't.
- **Friendship** multiplies for each own-type card at bond 80 or more. A card's unique Friendship Bonus multiplies
  apart from its own. Friend and Group cards never reach friendship.
- **Mood** is fixed at Great (+20%), and Mood Effect scales it.
- **Training Effectiveness** adds up across the cards there. Each card present adds 5%.
- **Growth** is her growth rate for that stat. It doesn't touch SP.
- **s(T)** is one scale per scenario: 1 at URA Finale. Each later scenario's row is set by its `sim:decks` run.
- **Floors:** each stat is rounded down per session, as the original does.

The facility table (URA Finale's, public game mechanics; D382 cites the sources):

<!-- live:build-facilities -->
| Facility | Level | Speed | Stamina | Power | Guts | Wit | SP |
|---|---|---|---|---|---|---|---|
| **Speed** | 1 | 11 | | 6 | | | 4 |
| | 2 | 12 | | 6 | | | 4 |
| | 3 | 13 | | 6 | | | 4 |
| | 4 | 14 | | 7 | | | 4 |
| | 5 | 15 | | 8 | | | 4 |
| **Stamina** | 1 | | 10 | | 6 | | 4 |
| | 2 | | 11 | | 6 | | 4 |
| | 3 | | 12 | | 6 | | 4 |
| | 4 | | 13 | | 7 | | 4 |
| | 5 | | 14 | | 8 | | 4 |
| **Power** | 1 | | 6 | 9 | | | 4 |
| | 2 | | 6 | 10 | | | 4 |
| | 3 | | 6 | 11 | | | 4 |
| | 4 | | 7 | 12 | | | 4 |
| | 5 | | 8 | 13 | | | 4 |
| **Guts** | 1 | 5 | | 5 | 8 | | 4 |
| | 2 | 5 | | 5 | 9 | | 4 |
| | 3 | 5 | | 5 | 10 | | 4 |
| | 4 | 6 | | 5 | 11 | | 4 |
| | 5 | 6 | | 5 | 13 | | 4 |
| **Wit** | 1 | 2 | | | | 10 | 5 |
| | 2 | 2 | | | | 11 | 5 |
| | 3 | 2 | | | | 12 | 5 |
| | 4 | 3 | | | | 13 | 5 |
| | 5 | 4 | | | | 14 | 5 |
<!-- /live -->

**A worked example, with made-up cards.** A Speed level-2 pip (12 Speed, 6 Power, 4 SP) for an Uma with Speed growth
+20%. Three cards are posted to Speed:
- A (Speed, bond 85): Speed Bonus +1, Friendship 25%, Mood Effect 30%, Training Effectiveness 10%, SP Bonus +1;
- B (Speed, bond 60): Power Bonus +1, Friendship 30%, Training Effectiveness 5%;
- C (Wit, posted off type): Training Effectiveness 15%, Friendship 35%, Energy Cost Reduction 15%.

The multipliers are friendship 1.25 (A only), mood 1.26, effectiveness 1.30 and headcount 1.15: 2.3546 in all. The pip
pays ⌊13 × 2.3546 × 1.2⌋ = **36 Speed**, ⌊7 × 2.3546⌋ = **16 Power** and ⌊5 × 2.3546⌋ = **11 SP**, for
⌈22 × 0.85⌉ = 19 drills. Once B reaches bond 80, it pays 47 / 21 / 15. With C posted to Wit instead, 31 / 13 / 9. The
domain's tests reproduce every number here.

## 5. Derived when read

What the bought pips pay is never stored. It's recomputed from the current deck, posts and bonds whenever it's read:
- swapping a card, moving one, or a card reaching bond 80 changes every bought and open pip at once;
- **purchase order never matters**: the same pips with the same deck pay the same.
- **Every pip previews** its level, its cost, its gain (stats and SP) and the part of the gain her caps would throw
  away, before it's bought. Buying it pays exactly the preview. A Camp previews the same way.

A few unique effects read the whole tree (the combined facility level, sessions in a branch): buying a pip can then
raise other pips too, and the preview counts that.

## 6. Her stats and the caps

```
stat = min( cap(T), star-5 base + Σ deck Initial stats + Σ bought sessions + hint stat rewards )
```

- The **caps** are her scenario's ([04](04-tiers-and-scenarios.md) §2): 1,200 a stat at URA Finale.
- **Initial stats** count once per deck card, with the uniques that add to them ([06](06-cards-and-bonds.md) §3).
- **Hint stat rewards** are what her bond tracks' hints paid ([06](06-cards-and-bonds.md) §4).

## 7. The racing build

`deriveRacingBuild(career, uma, cards, bonds)` gives what a race reads, and it is the only input the race hand-off
reads:
- **stats:** §6, capped;
- **aptitudes:** her template's grades (aptitude points arrive with Summer Camp, in a later release);
- **skills:** the skills she bought, up to 64. Her unique is equipped on its own at the race.

Winning the URA Finals freezes it on the career as her URA Finale racing build (T154).

## 8. Skills

- **Her library** is her own skills (her open awakening skills, her innate skills and her story events' skills) plus
  every skill her bond tracks hinted. A hinted gold brings its white. Her unique isn't bought: it's equipped on its
  own.
- **Cost:** `round(costSp × (1 − d))`, with *d* by hint level (the table below). Hints for one skill from any of her
  tracks add up, to level 5.
- **A gold needs its white,** and a ◎ its ○: the lower skill is bought first.
- **SP:** a career earns the wallet's SP (stages and races), every bought session's SP, the deck's Initial Skill
  Points and the hints' SP rewards. What it **spends** is capped at the scenario's SP cap (2,000 at URA Finale).
  Changing the deck can leave her having spent more than she now earns: no bought skill is lost, but nothing more can
  be bought until she earns it back.
- A skill that does nothing in this game's races (one aimed only at rivals, or one needing mechanics the engine lacks)
  can't be bought. Nor can a 65th.

<!-- live:build-hint-discounts -->
| Hint level | Discount | A 100 SP skill costs |
|---|---|---|
| 0 | 0% | 100 SP |
| 1 | 10% | 90 SP |
| 2 | 20% | 80 SP |
| 3 | 30% | 70 SP |
| 4 | 35% | 65 SP |
| 5 | 40% | 60 SP |
<!-- /live -->

## 9. The operations

Every change is an operation through `commitOperation`, idempotent by its id
([architecture](architecture.md#the-save-and-sync)). Each reads one open career; a finished career's build is frozen
and refuses them all.

| Operation | Input | Does | Refuses |
|---|---|---|---|
| `set-deck` | `careerId`, `deck` (card ids) | Sets the deck; new cards get default posts | More than six, a card twice, a card not unlocked or from a later era |
| `post-card` | `careerId`, `cardId`, `branch` | Moves a deck card to a branch | Not in the deck, the branch full, already there |
| `buy-pips` | `careerId`, `branch`, `count` (1–20), or `camp: true` | Buys the branch's next pips in order, or the next Camp in it, spending drills | The branch complete, too many pips, too few drills; Camps closed or both bought |
| `pour-bond` | `careerId`, `cardId`, `amount` | Pours Bond into a deck card's track ([06](06-cards-and-bonds.md) §4) | Not in the deck, too little Bond, the track full |
| `buy-skill` | `careerId`, `skillId` | Buys a skill at its hinted cost | Not in her library, already bought, her unique, its lower skill not bought, no SP cost, no effect in races, 64 held, over the SP cap, too little SP |

## 10. Keeping it balanced: `sim:decks`

`pnpm sim:decks` buys every pip (100 sessions, Camps aside) for every Uma with three decks, and reports each deck's
share of the scenario's cap budget:
- **empty:** no cards;
- **median, bonded:** each stat type's median card by power ([06](06-cards-and-bonds.md) §5) and the median Friend or
  Group card, every track poured to 100;
- **strong, bonded:** each stat type's strongest card and the strongest stat card left, every track at 100.

<!-- live:build-deck-bands -->
| Deck | Share of the cap budget | At T1 |
|---|---|---|
| Median, bonded | 55%–77% | 3,300–4,620 |
| Strong, bonded | 70%–90% | 4,200–5,400 |
| Any deck | never all five stats capped | |
<!-- /live -->

It fails when a band drifts or any deck caps all five stats. It reads the private pack when one is present locally
(`MASTER_DIR`, or `../uma-platform/content/release`), and invented cards otherwise; the domain's tests run the
invented cards in CI. It prints aggregate shares only: no card id, name or value goes in git.
