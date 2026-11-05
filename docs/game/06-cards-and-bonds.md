# 06 · Cards and bonds

> **Status: generation 3, the rules built (T153, D382).** The Card Library that shows each card's effects is T157's,
> and the Bonds screen T158's. The research is [05 · card mechanics](../research/drawing-board/05-card-mechanics.md)
> §1–§3. How the effects price a session is [05](05-the-build.md) §4.

Support cards are the original's SSRs with their **real effects**. Each one you own counts at its top level, trains
where you post it, and has a **bond track** with each Uma that fills as you pour Bond into it.

Code: `packages/domain/src/build/` (`effects.ts`, `bond.ts`, `power.ts`), and the master adapter
(`packages/domain/src/master/adapter.ts`) that reads the cards.

## 1. Owned cards, at their top level

- **SSRs only.** Unlocking one takes a Card Ticket; cards are account-wide.
- **Every card counts at its top level:** an SSR's level 50, its maximum limit break. Its unique effect switches on at
  level 1, 30 or 40, so every unique is on.
- **The numbers are the original's,** each effect's value at the card's top level, read from the private content
  pack. They never appear in git; the domain's tests use invented cards.
- **Era:** a card's era is the latest scenario released on or before its JP release ([04](04-tiers-and-scenarios.md)
  §3). A career takes only cards of its scenario's era or older.

## 2. The effects and what each does here

Effect ids are the original's (05 §1).

| Id | Effect | Here |
|---|---|---|
| 1 | Friendship Bonus | Multiplies a session when the card is at its own type's branch with bond 80 or more |
| 2 | Mood Effect | Scales mood, fixed at Great (+20%) |
| 3–7 | Speed … Wit Bonus | Flat, added to the base of each stat its branch trains |
| 8 | Training Effectiveness | Adds up across the cards at a session |
| 9–13 | Initial Speed … Wit | Added once to her stats per deck card |
| 14 | Initial Friendship Gauge | Where its bond track starts |
| 15 | Race Bonus | Raises what races pay (T154) |
| 17 | Hint Levels | Its hints arrive at level 1 + Hint Levels |
| 18 | Hint Frequency | A hint every round(20 ÷ (1 + Hint Frequency)) bond |
| 28 | Energy Cost Reduction | Cuts the drill cost of pips in its branch |
| 30 | Skill Point Bonus | Flat, added to a session's base SP |
| 31 | Wit Friendship Recovery | Takes whole drills off a Wit pip while the card is in friendship |
| 32 | Initial Skill Points | SP once per deck card |
| 41 | All Stats Training Bonus | A Stat Bonus on every stat |
| 16, 19, 25, 26, 27 | Fan Bonus, Specialty Priority, Event Recovery, Event Effectiveness, Failure Protection | Shown on the card; nothing here. There are no fans, wandering cards, card events or failures |

## 3. Unique effects

A plain unique effect (an id under 100) is always on and works as §2, except that a unique **Friendship Bonus**
multiplies apart from the card's own. The conditional ones are translated where the tree has a reading for them:

| Id | The original | Here |
|---|---|---|
| 101 | One or two effects at bond ≥ a threshold | The same, at the card's bond |
| 102 | Training Effectiveness at bond ≥ a threshold, off its specialty | The same, while posted off its own type's branch |
| 103 | Training Effectiveness with enough card types in the deck | The same, counting the deck's types |
| 105 | Initial stat of each deck card's type, per card; Friend and Group cards to every stat | The same, from the deck |
| 106 | An effect per friendship training with it, up to a count | Per session bought in its branch while it's in friendship, up to the count |
| 109 | An effect per so much bond across every card | Per so much bond across the deck |
| 110 | An effect per other card at the same training | Per other card posted to its branch |
| 111 | An effect per level of the current facility | Per level of the pip |
| 113 | An effect during a friendship training | On a pip of its branch where any card is in friendship |
| 115 | An effect for every card in the deck | Every deck card gets it (for example a higher starting gauge) |
| 117 | An effect scaling with the facilities' combined level | Scaling with the tree's combined facility level (5 to 25) |
| 120 | At bond ≥ a threshold, Stat Bonus per deck card of each type (capped); Friend and Group cards give SP | The same, from the deck |
| 121 | Extra bond for every card in training, more at its own facility | A pour into any deck card's track gains (7 + its extra) ÷ 7, with the larger extra for cards at its own branch (§4) |

These are dropped and still shown on the card: fans (104), energy (107, 108, 114), failure (112), skills learned by
category (116), appearances and Specialty Priority (118, 119), and a buff to the next turn's cards (122). The readings
of every conditional follow umamusu.wiki's support-effects module (D382). The dropped ids, as the code lists them:

<!-- live:build-dropped-uniques -->
104, 107, 108, 112, 114, 116, 118, 119, 122
<!-- /live -->

## 4. Bond tracks

- **One track per (Uma, tier, card),** 0–100. A track starts at the card's Initial Friendship Gauge (and any deck-wide
  gauge, 115) when Bond is first poured into it; until then it reads as that start.
- **Pouring:** Bond comes from the career's wallet, into a deck card's track. A pour past 100 takes only the Bond that
  fills it. The extra-bond unique (121) multiplies a pour by (7 + its extra) ÷ 7, 7 being what a training together pays
  the gauge in the original.
- **The stops:**
  - **a hint** at every multiple of round(20 ÷ (1 + Hint Frequency)): 20 at none, 14 at 40%, 10 at 100%. A track's
    start pays no stop it already passed. Each hint gives:
    - the card's **next hint skill** in its list order, wrapping round, at level 1 + Hint Levels;
    - every **non-skill hint reward** the card has (a stat, or SP), when the card's level meets the reward's gate.
  - **80, friendship:** the card multiplies sessions at its own type's branch.
  - **100, the event chain:** its event skills are hinted, golds included.
- **What hints give is hers for the tier,** whether or not the card stays in her deck: the hinted skills join her
  library ([05](05-the-build.md) §8) and the rewards her stats and SP. Hint levels for one skill add up across cards,
  to 5.
- With unlimited play every track reaches 100. Bond sets the pace, not the ceiling.

## 5. Card power and the refit

**Card power** is the stat gain a card adds to the **reference session**: a level-3 pip at its own type's branch, alone
there, at bond 80, for an Uma with no growth, in a fixed reference deck (one card of each type and a Friend, all at
bond 80, the tree at level 3 throughout). Friend and Group cards train at Wit and never reach friendship, so they're
scored on their own scale and compared only with each other.

`sim:decks` picks its median and strong decks by power ([05](05-the-build.md) §10). Release 3's **refit** brings a card
up to the median power of its type in the newest era; it isn't built yet.
