# 06 · Cards and bonds

> **Status: approved design, 2026-10-14; first written 2026-10-13 (D329).** Every SSR open from the start, no stars and no card levels,
> bonding a card to an Uma at the Dojo, what a bond costs by era, card sets and presets, Race Bonus, and the Card
> Library. Every number is a **draft** that the loop simulation ([12](12-economy-and-pacing.md) §12) tunes and then
> pins in tests.

Today a card has to be **owned** (a Card Select Coupon, D198) and **starred** (0–3★ from Friendship Training, D200,
D255) before it pays in full. Both go. Every card is open and pays its maximum, and the one thing that stands between a
card and an Uma's set is a **bond**: a passive Dojo session that ties that card to that Uma for the rest of her tier.
The collection stops being "which cards do I have" and becomes "which cards has each Uma trained with".

## 1. Every card open, at full value

- **Every SSR is open from the start.** All 312 cards in today's pack, plus any a content update adds. There is no
  ownership, no starter set, no Card Select Coupon and no coupon at a card's first 3★. D198 (coupons as the only
  unlock) and D130's ticket price are superseded; the card template's `obtain` field no longer matters.
- **No stars and no card levels.** Every card pays today's **3★ values**: node pay 100%, full Race Bonus and the
  card's unique-effect bonus. D200 and D255 (stars) are superseded; D130 (no card level) stands.
- **Friendship Training is removed**, with the stars it paid for and D199's "card training stands on its own" lens.
  "Bond" keeps its name, but now means the Dojo session below.

What a card is worth after the rework:

| Property | Effect | Changed? |
|---|---|---|
| **Type** | How a node splits its value: Speed 70/Power 30, Stamina 70/Guts 30, Power 70/Stamina 30, Wit 70/Speed 30, Guts 60/Speed 20/Power 20 (D180) | No |
| **Era** | `eraPct = max(40, 100 − 5 × (T − era))` against the scenario at tier position *T* (D126) | No |
| **Skills** | Each node it fills pays its next white and next gold (D182) | No |
| **Friend and Group** | Pay Skill Points per node instead of stats (D132) | Always at full value |
| **Race Bonus** | Multiplies the Racing EXP a race pays (§4) | Always full; no star curve |
| **Stars** | — | **Removed**: `starPct` is 100 everywhere |

So a card node pays `nodeValue × eraPct × buffPct`, and a Friend or Group node `spNodeValue × eraPct`. Era is now the
**only** card quality, which is what makes a newer card better and what a bond's price follows (§2).

**Rival fields.** Today's rivals carry a typical set at 2★, 84% a node (`TYPICAL_CARD_STARS = 2`). Every owner's card is
now at 100%, so the fields need rebasing; [04](04-tiers-and-promotion.md) owns tier scaling and rival strength.

## 2. Bonds

A **bond** is one card unlocked for one Uma. The rules:

- **A card goes in an Uma's card set only once it is bonded to her** (D329). Unbonded cards can be browsed, compared
  and planned with, never slotted.
- **One Dojo session unlock per bond.** The Dojo, its rooms and how sessions run are [05](05-training-hub.md)'s.
  A bond is one unlock in a session: one exact dish, (180 + 15(*g*−1)) × *k* minutes. No substitutions: a higher-grade dish
  never pays for a lower-grade bond ([08](08-item-catalogue-and-recipes.md)).
- **The bond lasts her whole tier** and **resets at promotion** with everything else on the Uma (D327).
- **Per Uma.** Bonding a card to five Umas takes five sessions.
- **She can bond any card her current scenario allows**: era ≤ *T*, her scenario's position in the 15 (§3). A card of a
  later era shows "Opens in scenario 3 · Trackblazer" and cannot be bonded ahead.
- **A bond is never undone or refunded.** There is no reason to: bonds have no limit.

### The dish: family by card type

<!-- live:bond-dishes -->
| Card type | Dojo room | Dish family | Dish id at grade *g* (grade 1 name) |
|---|---|---|---|
| Speed | Speed | Sweets | `dish-sweets-<g>` (Honeycomb Cake) |
| Stamina | Stamina | Fruits | `dish-fruits-<g>` (Apple Tart) |
| Power | Power | Fish | `dish-fish-<g>` (Carp Grill) |
| Guts | Guts | Nuts & Seeds | `dish-nuts-seeds-<g>` (Peanut Cookies) |
| Wit | Wit | Herbs & Spices | `dish-herbs-spices-<g>` (Basil Curry) |
| Friend, Group | Friend & Group | Grains | `dish-grains-<g>` (Wheat Bread) |
<!-- /live -->

### The dish: grade by era

**A card first eligible in the tier's scenario *p* needs grade 2*p*−1.** Cards from before the tier count as *p* = 1:

```
p     = max(1, era − 5 × (tier − 1))
grade = 2p − 1                       (1, 3, 5, 7 or 9)
```

So the newest cards of each scenario cost the most, and every older card costs grade 1. The table is the Training Hub's
rules (`bondGrade` in `@racer/domain/rework/training`, D344).

<!-- live:bond-grades -->
| Card era (JP scenario) | Tier 1 grade | Tier 2 grade | Tier 3 grade |
|---|---|---|---|
| 1 · URA Finale | **1** | 1 | 1 |
| 2 · Unity Cup | **3** | 1 | 1 |
| 3 · Trackblazer | **5** | 1 | 1 |
| 4 · Our Grand Concert | **7** | 1 | 1 |
| 5 · Grand Masters | **9** | 1 | 1 |
| 6 · Project L'Arc | — | **1** | 1 |
| 7 · U.A.F. Ready GO! | — | **3** | 1 |
| 8 · Great Food Festival | — | **5** | 1 |
| 9 · Run! Mecha Umamusume | — | **7** | 1 |
| 10 · The Twinkle Legends | — | **9** | 1 |
| 11 · Design Your Island | — | — | **1** |
| 12 · Yukoma Hot Springs | — | — | **3** |
| 13 · Beyond Dreams | — | — | **5** |
| 14 · Tracen Diner | — | — | **7** |
| 15 · Japan's next | — | — | **9** |
<!-- /live -->

"—" means the card is not eligible anywhere in that tier. Today's pack (2026-10-02, aggregates only) holds 52, 24, 27,
27 and 24 cards of eras 1–5, then 28, 19, 19, 15 and 16 of eras 6–10, and 18, 14, 15 and 14 of eras 11–14; none is era 15
yet. The code may not read the private pack, so the counts stay in this sentence. The odd grade is the scenario's lower one, which an average
Uma's Farm Level opens as that scenario starts ([12](12-economy-and-pacing.md) §6), so a new era's cards are bondable
from the scenario's first day. Session time follows the grade: 180, 210, 240, 270 or 300 minutes.

Examples in tier 1: Kitasan Black [Fire at My Heels] (Speed, era 1) takes `dish-sweets-1` and 3 hours. Riko Kashimoto
[Planned Perfection] (Friend, era 2) takes `dish-grains-3` and 3½ hours. Satono Diamond [Special Dreamers!] (Wit,
era 3) takes `dish-herbs-spices-5` and 4 hours. In tier 2 all three are grade 1.

### How many bonds

<!-- live:bond-counts -->
| Scenario of the tier | 1 | 2 | 3 | 4 | 5 | Tier |
|---|---|---|---|---|---|---|
| Bonds in the layer (README) | 6 | 3 | 3 | 3 | 3 | **18** |
| Bonded by the end of the scenario | 6 | 9 | 12 | 15 | 18 | |
<!-- /live -->

- **The 18 is the pacing assumption, not a cap.** The owner may bond **any number** of cards to an Uma. The planner and
  [12](12-economy-and-pacing.md)'s model count 18, and "[Scenario] Fully Trained" counts 6, 9, 12, 15 and 18
  ([05](05-training-hub.md) §11). More bonds only cost more dishes and Uma-time, which the anchor already prices.
- **What a typical build needs.** A set is six cards per distance preset, and a typical Uma races two distances. The
  stamina ladder's Mile and Medium sets share five cards (two Speed, Stamina, Wit, Friend) and differ in one (a second
  Wit or a Power), so **two presets take 7–12 bonds**: 7 when they share, 12 when they share nothing.
- **What the 18 buys.** Scenario 1's six fill her first preset. The next three give her second preset its own cards.
  The last nine follow the eras: each scenario of tier 1 brings 24–27 newer cards, which pay 5% more a node for every
  era they are newer, so swapping two or three of them in each scenario is worth a bond.
- **Dish demand.** [08](08-item-catalogue-and-recipes.md) counts a representative 3 bonds of each card type a tier,
  each at its layer's lower grade. Real decks lean Speed and Wit, carry one Friend (so Grains stays light), and most
  bonds are grade 1 by the era rule, so 08's bond grades are an upper bound.

### Worked example: a Mile Uma's first week

In scenario 1 of tier 1 only era-1 cards are eligible, so every bond is grade 1 and 3 hours. She needs two Speed cards,
a Stamina, two Wit and a Friend (the ladder's Mile set):

| Session | Room | Bonds | Dishes | Time |
|---|---|---|---|---|
| 1 | Speed | Kitasan Black [Fire at My Heels], Sakura Bakushin O [Eat Fast! Yum Fast!] | 2 × `dish-sweets-1` | 6 h |
| 2 | Wit | Fine Motion [Wave of Gratitude], a second Wit card | 2 × `dish-herbs-spices-1` | 6 h |
| 3 | Stamina | Super Creek [Piece of Mind] | `dish-fruits-1` | 3 h |
| 4 | Friend & Group | Tazuna Hayakawa [Tracen Reception] | `dish-grains-1` | 3 h |

18 hours of sessions, one at a time (an Uma holds one session, [05](05-training-hub.md) §2). She can race throughout.
Until she has six bonds her set has empty slots, which pay nothing, and her tree's per-card cap (3 nodes on 12) leaves
nodes empty, which is the visible reason to finish bonding.

## 3. Card sets and presets

- **Six slots per distance preset.** An Uma has four presets per tier, Sprint, Mile, Medium and Long (D252's shape,
  per tier now: [03](03-uma-progression.md)). A race reads the preset of its distance (D254).
- **Only bonded cards.** A slot accepts a card bonded to her. All four presets draw on the same bonds.
- **Era gating stays.** The scenario at tier position *T* accepts cards with era ≤ *T* ([Scenarios](../design/scenarios.md#era-windows)).
  Bonds already follow it, so a bonded card is always eligible.
- **No duplicate card and no two cards of the same character** in one set.
- **Per-card node cap** `ceil(N / 6) + 1` (D134): 3, 4, 5, 5 and 6 on trees of 12–28 ([05](05-training-hub.md) §4).
- **Replacing a card hands its nodes to the replacement; removing a card empties its nodes** (D129). Swapping a
  bonded card in is free and instant outside a race.
- **Advancing a scenario** keeps every set and assignment ([03](03-uma-progression.md) §6, [05](05-training-hub.md) §4). Older cards' `eraPct` drops 5
  points a scenario, which the card set tab shows as a dimmed node value beside a "newer cards available" hint.

## 4. Race Bonus

Today a card's Race Bonus raises the **Uma EXP** a race pays while the card is in the race's set, from 1★, following
the star curve to full at 3★:

```
win EXP         = winExp[grade] × (1 + Σ Race Bonus of the race preset's cards)     2nd–3rd: 25% of that
card Race Bonus = 0.0486 × (1 + 0.08 × (era − 1)) × weight × (1.25 if its unique effect is Race Bonus)
```

`weight` is the card's generated profile weight, 0.5–1.5, or 0 when the card has no Race Bonus. Every card now pays its
full value. On today's pack, 250 of 312 cards have a Race Bonus and 13 also have it as a unique effect:

| Scenario (eligible cards) | Average card | An average set of six | The best six |
|---|---|---|---|
| 1 (52) | +4.4% | +26% | +47% |
| 5 (154) | +5.1% | +30% | +58% |
| 10 (251) | +5.8% | +35% | +75% |
| 14 (312) | +6.9% | +42% | +89% |

**Race Bonus keeps paying Racing EXP, and does not pay Prize Money.**
- Prize Money is the anchor currency (1 Prize Money ≈ 1 Uma-minute, D331). A card multiplier on it would make set
  choice an economy lever and invite swapping sets before races, a chore.
- Racing EXP is per Uma and bounded by her career's level holds, so a bonus only shortens a scenario's racing.
- [09](09-racing-rewards-and-exchange.md) should size its EXP table with a typical +25–40% included, as today's "G1 with
  +33% Race Bonus" row does, so 1,800 EXP still takes about 14 races ([12](12-economy-and-pacing.md) §8).

## 5. Card focus

**Running-style focus** (Front Runner, Pace Chaser, Late Surger, End Closer, Generalist) and **distance focus** (Sprint,
Mile, Medium, Long, Generalist) stay exactly as today ([Support cards](../design/support-cards.md#card-focus), D201,
D236), with their icons (D238, D251) and the authored `card-focus.json` corrections. A focus is a **browsing
category**, never a bonus: it is how the owner finds a Late, Long set in two taps.

## 6. The Card Library

The Card Library is a place in the **Town Hall** ([11](11-hub-and-places.md), D333). It replaces the Cards tab and uses
the shared album chrome ([Collection](../design/collection.md#albums)): sticky search, Sort and Filter, filter chips,
saved views, three view modes, compare and long-press actions.

**Lens and Uma.** A chip row picks the **lens**: **All**, or one of the playable scenarios (14 until the 15th ships, D131). A second control picks an
**Uma**: when one is set, the lens follows her scenario and every tile shows her bond state. The Library opens on the
featured Uma.

| | Options |
|---|---|
| **Sorts** | Era/release, newest first (default) · type · character · card name · per-node pay in the lens · Race Bonus · Umas bonded |
| **Filters** | Type · running style · distance · era · bonded to her / not bonded / bondable now (with an Uma) · bonded to any Uma · in a set · has Race Bonus · new |
| **Search** | Name, character and skill text ("Corner Recovery" finds every card that pays it) |

**Tiles** use the four corners as today (D238): distance top left, running style top right, type bottom left. The
bottom-right pill, which held stars, now shows:
- with no Uma chosen, **how many Umas are bonded** to the card in their current tier (hidden at 0);
- with an Uma chosen, a **bond mark** if she is bonded, or **the dish grade she needs** ("G5" on the family's colour),
  or a lock if the card's era is past her scenario.

**NEW** marks a card a content update added since the owner last opened it (device-local, as today).

**The card page** (`/town/card-library/card/:cardId`, [11](11-hub-and-places.md) §7):
1. **The illustration**, full width, cropped 4:5, name over its foot, type icon on the art. A tap opens the art viewer.
2. **Chips:** type, era ("Era 3 · Trackblazer"), running style, distance.
3. **What it pays:** its split with the stat icons; its per-node pay in the lens scenario, and the `eraPct` it keeps in
   each later scenario of the tier; Skill Points per node for Friend and Group; its Race Bonus ("+4.9% Racing EXP").
4. **Skills:** its golds first, highlighted, then its whites, each marked with the node that pays it ("2nd node").
5. **Bond cost:** the dish and time per tier ("Tier 1: `dish-herbs-spices-5`, 4 h · Tiers 2–3: `dish-herbs-spices-1`,
   3 h").
6. **Bonded to:** each Uma bonded in her current tier, with her tier and scenario, the presets that hold the card and
   its nodes; then the Umas who could bond it now.
7. **Bond**, in the thumb zone.

**Bonding from the card page:**
1. **Bond** opens the Uma picker, filtered to Umas who can bond this card now: its era is open in her scenario and she is
   not bonded to it. Each row shows the dish, the Warehouse stock and the minutes. A busy Uma shows "Busy until 14:20"
   and offers **Queue** where [02](02-check-ins-and-notifications.md)'s queues allow it. Umas who cannot bond it are
   listed below with the reason ("Already bonded", "Opens in scenario 3").
2. Picking an Uma opens the **Dojo session sheet** ([05](05-training-hub.md) §8) with her, this card and the card type's
   room chosen. The owner can add more bonds of the same type to the same session.
3. **Start** returns to the card page, where the card shows "In session · bonds 01:30".

**The card set tab** of an Uma's build uses the same Library, with the lens on her scenario and "bonded to her" on.
Below her bonded cards, a **Bond more** section lists eligible unbonded cards, each with its dish and a Bond button.
There is no weaker parallel picker.

## 7. Badges and achievements

Badges and titles stay, scenario-linked (D122). Achievements that count removed things retire ([13](13-removals-and-plan-changes.md) §1).
For cards:

| Today | Criterion | After the rework |
|---|---|---|
| **Card Collector** (Trainer) | SSR cards owned: 10/25/50/100/all | **Retires.** Replaced by **Card Partners**: distinct cards ever bonded, to any Uma in any tier: 10/25/50/100/200 |
| **Maxed Out** (Trainer) | Cards at 3★: 1/5/15/40/100 | **Retires**: no stars |
| **[Era] Complete** (Trainer) | Own every card of that era | **Becomes [Era] Bonded**: every card of that era bonded at least once, to any Uma |
| **[Type] Complete** (Trainer) | Own every card of that type | **Becomes [Type] Bonded**: every card of that type bonded at least once |
| **Coupon Clipper** (Trainer) | Coupons redeemed | **Retires**: no coupons |
| Trainer profile meters | Cards x/y, maxed cards x/y | **Cards bonded x/312**; maxed cards removed |
| **Era Loyalist** (per Uma) | Completed a scenario using only cards whose era equals its position *T* (1–15) | **Stays**, read from the sets of every race she ran in that scenario |
| **Full House** (per Uma) | Filled every card node of one constellation | **Stays** |
| Album quick filters *Maxed*, *Unowned*, *Equippable at my tier* | | **Retire**; *Bondable now* replaces the last |

Friendship Training's planned badges never shipped and are dropped. "Ever bonded" is recorded as a bounded Trainer fact
(the set of card ids) in the same commit as the bond's Collect, so it survives promotion.

## 8. Scenario buffs

Today's buffs that read stars or Friend and Group cards, Grand Masters' **Fragments** (3★ cards pay +8%) and Tracen
Diner's **Orders**, and Project L'Arc's **Expedition**, which needs a new name, are [04](04-tiers-and-promotion.md)'s.

## 9. What is saved

| Where ([13](13-removals-and-plan-changes.md) §6) | What |
|---|---|
| `umas/{outfitId}` | `bonds`: the card ids bonded in her current tier. Each preset's `cardSet` (six ids or empty) and node assignments by node id |
| `umas/{outfitId}` promotion history | The bonded ids of each finished tier, for history |
| `work/{outfitId}` | A running Dojo session, as any session ([05](05-training-hub.md) §9) |
| `badges/trainer` | The set of card ids ever bonded, for Card Partners and the [Era]/[Type] Bonded one-offs |

There is **no per-account card entity**: no `cards/{cardId}`, no stars, no coupon flags. Bonds start, speed up, recall
and collect with the session operations; a set edit is one ordinary Uma write.

## 10. Edge cases

- **A stale screen.** Start re-checks that she is not already bonded and not already bonding this card; a second device's
  bond shows as a refusal naming the session, never a second bond.
- **The same card twice in one session**, or in two sessions for one Uma, is refused.
- **A 0-stock Warehouse.** The Bond button still opens the picker; each row shows "0 in Warehouse · Cook" and links to the
  Kitchen recipe.
- **Promotion.** Bonds, sets and assignments reset with the rest of the Uma ([04](04-tiers-and-promotion.md)). A running
  Dojo session is recalled first and its dishes return.
- **An Uma bought mid-tier** starts with no bonds; her first set takes six grade-1 bonds, about 18 hours.
- **Racing with an incomplete set** is allowed. An empty slot pays nothing; Race Bonus counts only the cards present.
- **A card a content update removes** keeps its bond as a diagnostic, never counted in Library totals, and its set slot
  shows empty.

## 11. Decided here

| Choice | Why |
|---|---|
| Every card pays 3★ values: node 100%, full Race Bonus, unique-effect bonus | D329; the owner considers every card max limit broken |
| A bond can only be made for a card her current scenario allows | Bonds follow the layers; the grade then always matches dishes the Farm can make |
| Bond grade = 2*p*−1 with *p* = max(1, era − 5(tier − 1)) | Newer cards cost more; older ones cost grade 1 in every later tier |
| Any number of bonds; 18 a tier is the pacing assumption | Bonds already cost dishes and time; a cap would only add a rule |
| Bonds are never undone or refunded | Unlimited bonds leave nothing to recover |
| Race Bonus pays Racing EXP only, never Prize Money | Keeps the anchor currency clean and set-swapping pointless |
| The Card Library keeps today's lens chips, adds an Uma control, and replaces the stars pill with bond state | One browsing chrome; the tile answers "can she use it" |
| Card Collector, Maxed Out and Coupon Clipper retire; Card Partners and [Era]/[Type] Bonded replace them | Collection becomes bonding, so its achievements count bonds |
| Era Loyalist reads the sets of every race in the scenario | Four presets mean several sets per scenario |
| No per-account card entity | Every card is open; bonds live on Umas ([13](13-removals-and-plan-changes.md)) |
| `remainingUnlocks` takes the cards the owner has chosen to bond; the rest of each layer's pacing count shows as "pick cards", oldest layer first, with bonds made or pending counted toward it (D344) | [02](02-check-ins-and-notifications.md) §6 cascades only chosen bonds; the caller (a screen, or the loop simulation's deck) supplies the choice |
| The card buff applies to a Friend or Group card's SP, as today (D344) | 03 §8 and §1 omit it from the SP formula, but 03 §8 calls Friend and Group "unchanged" and D165 buffs every card node |
| A bond's layer is its card's first eligible scenario *p*; a card past her scenario refuses with the scenario that opens it, a card past her tier with its own tier's scenario (D344) | One rule for the grade and the lock; 18 a tier stays a count, not a cap |
| A Dojo session reads each bonded card's type and era from the content (`cards`), never from the request (D344) | The dish and grade follow the card; a request can't name a cheaper one |
| A card set refuses an unbonded card, a card twice, a character twice, a card past her scenario and a seventh card; replacing a card in its slot hands its nodes over, removing one empties them, exactly as today's `withCardSet` (D129, D344) | §3's rules; the hand-over is today's, proven by a parity test |
| Lineage picks go only in open slots, from Umas the account owns, never herself, under D250's repeat rules and Legends (D344) | [05](05-training-hub.md) §5 pays "a filled open slot" |
| A loadout keeps her unique first and checks the rest against the preset's derived library and SP; one over her SP is refused unless it costs no more than the one it replaces (D196, D344) | Today's rules; the unique is always equipped and costs nothing |
| Cross-task acceptance #2 (demand equals [08](08-item-catalogue-and-recipes.md) §7) belongs to the loop simulation (D344) | 08 §7 puts 9 of 18 bonds at even grades, which the era rule can't produce; the simulation rewrites 08 §7 |
| §2's "Cards" column leaves the live block for a sentence (D344) | It counts the private pack, which code may not render |

## 12. Done when

- The domain has no card ownership, stars, coupons or Friendship Training; every card node pays `nodeValue × eraPct ×
  buffPct`, and tests pin the type splits, era decay and Race Bonus at full value.
- A card set refuses a card not bonded to that Uma, a duplicate card or character, and a card past the scenario's era.
- A Dojo session bonds a card with its family's dish at grade 2*p*−1, and tests pin the era-to-grade table for all
  three tiers.
- Bonds survive scenario advances, reset at promotion, and an Uma can hold more than 18.
- Race EXP uses the race preset's full Race Bonus; Prize Money ignores it.
- The Card Library browses all cards with the sorts and filters in §6; with an Uma chosen every tile shows her bond
  state, and Bond on a card page opens the Dojo session sheet pre-filled.
- Card Partners and [Era]/[Type] Bonded are earned from bond Collects, and no removed achievement appears.
