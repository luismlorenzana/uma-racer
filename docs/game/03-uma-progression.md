# 03 · Uma progression

> **Status: as built, phase 3 (generation 2, D361); first written 2026-10-13 (D327, D328).** How one Uma progresses
> inside a tier: her Racing Level, the five scenarios she climbs, her career in each, advancing, her one build per tier,
> and the stats she races with. The tables marked live are rendered from the rules; the sims named in each section pin
> their numbers.

Tiers, promotion and the per-scenario numbers (caps, node values, Extra Stats values, buffs) are on
[04](04-tiers-and-promotion.md). What a session unlocks and the layer contents are on [05](05-training-hub.md), bonds on
[06](06-cards-and-bonds.md), Farm Level on [07](07-farm.md), and what a race pays on
[09](09-racing-rewards-and-exchange.md).

## 1. An Uma inside one tier

Each Uma is in exactly one tier and one scenario of it. She has **two levels**, both 1–50 and both reset at promotion:

| | Racing Level | Farm Level |
|---|---|---|
| Earned by | Races only (this page) | Farm work only ([07](07-farm.md)) |
| Does | Holds her career, gates the advance to the next scenario and the Expedition | Opens ingredient grades for her Farm jobs |
| Feeds stats | No | No |

Her stats come from her **unlocks**, which the Training Hub opens one session at a time ([05](05-training-hub.md)).

```
Tier 1     scenario 1     scenario 2     scenario 3     scenario 4     scenario 5     World Expedition
Racing     Lv 1 ─ 10  ▶   Lv 11 ─ 20 ▶   Lv 21 ─ 30 ▶   Lv 31 ─ 40 ▶   Lv 41 ─ 50 ▶   8 wins ▶ promotion (04)
Layers     [1]            [1][2]         [1][2][3]      [1][2][3][4]   [1][2][3][4][5]
Build      one build: four distance presets, carried forward automatically at each advance
```

Two rules shape everything below (D328):
- **Unlocks last for the whole tier.** Entering scenario *s* opens its layer; layers 1 to *s* − 1 stay, done or not.
- **Racing is never blocked.** An Uma does one passive thing at a time (a Farm job or a session), but can always race.

## 2. Racing Level and Racing EXP

Racing Level runs **1–50 per tier**, ten levels per scenario. It replaces today's permanent Uma Level 1–140 (D121, D241).

### The curve (as today, D241)

Within each scenario the levels cost the same as today: `expToNext = 100 + 25 × levelsIntoScenario`, where
`levelsIntoScenario = (Racing Level − 1) mod 10`.

<!-- live:racing-curve -->
| Level into the scenario | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|
| EXP to the next | 100 | 125 | 150 | 175 | 200 | 225 | 250 | 275 | 300 | **1,800** |
<!-- /live -->

Nine paid steps take her from the scenario's first level to its gate (level 10*s*). The tenth step, from 10*s* to
10*s* + 1, is **the advance itself** (§5). The README's "180 a level" is this curve's average, not a flat cost.

### EXP per finish (as today)

<!-- live:racing-exp -->
| Finish | Debut / Maiden | Pre-OP / OP | G3 | G2 | G1 |
|---|---|---|---|---|---|
| 1st | 40 | 60 | 80 | 110 | 150 |
| 2nd or 3rd | 10 | 15 | 20 | 28 | 38 |
| 4th or worse | 0 | 0 | 0 | 0 | 0 |
<!-- /live -->

- A win pays `winExp × (1 + Σ Race Bonus)` over the cards in the race's preset. Every card now pays its **full Race
  Bonus** (today's 3★ value, D329), so a set can add up to about +33%.
- 2nd and 3rd pay a quarter of the win, rounded.
- [09](09-racing-rewards-and-exchange.md) lists the same table beside Prize Money. If the sim moves a value, both pages
  change together.

| A scenario's 1,800 EXP is about | G1 wins (150) | with +33% Race Bonus (200) | G2 wins (110) |
|---|---:|---:|---:|
| Wins | 12 | 9 | 17 |

So an Uma runs about **12–16 races a scenario**: her six goal races among them, plus some 2nd and 3rd places. That's
[12](12-economy-and-pacing.md) §8's "about 14 races a scenario".

### Holds, the gate and the bank (as today)

Her career ([§4](#4-her-career-in-each-scenario)) holds two levels of each scenario:

| Hold | Racing Level in tier 1 scenario *s* | Released by |
|---|---|---|
| Maiden hold | 10(*s*−1) + 2 | Winning her Maiden goal (a G3) |
| Trials hold | 10(*s*−1) + 5 | Winning both Trials goals (two G2s) |
| **The gate** | 10*s* | Completing her career, then **advancing** (§5) |

- **At a hold** she banks EXP up to one short of the next level. The race that wins the goal releases the bank at once.
- **At the gate** she banks up to 100 EXP, the next scenario's first step, which applies when she advances. Past that,
  race EXP is not counted.
- **At Racing Level 50** (the tier's last gate) there is no next scenario. EXP stops and nothing banks. Her next step
  is the World Expedition ([10](../rework/10-expeditions.md)).
- **Level-ups pay nothing of their own,** except the gate: D148's Training Ticket per level is gone
  ([13](../rework/13-removals-and-plan-changes.md)), and each scenario gate an Uma reaches still pays 1 Uma Shard (D336,
  [04](04-tiers-and-promotion.md) §6). Races pay Prize Money ([09](09-racing-rewards-and-exchange.md)).

### Lifetime level, for lists and badges

Lists and level badges need one number across tiers. **Lifetime level = 50 × (tier − 1) + Racing Level**, so tier 2's
Racing Level 13 is lifetime 63. Uses:
- **Lists.** Every Uma list still starts with the highest (D181), so tier 3 sorts above tier 2, and inside a tier the
  higher Racing Level comes first.
- **Badges.** The level badges (10 / 25 / 50 / 75 / 100) read the lifetime level, so they keep their meaning.
- **Tiles.** A tile shows "T2 · Lv 13", never "63".

## 3. Scenarios inside a tier

Scenario *s* of tier *t* is the game's scenario **T = 5(*t* − 1) + *s***, numbered by JP release as today. It covers
Racing Levels **10(*s* − 1) + 1 … 10*s*** of the tier. The full map, with the 15th scenario, is on
[04](04-tiers-and-promotion.md) §1.

| *s* | Racing Levels | Tier 1 (T) | Tier 2 (T) | Tier 3 (T) | Layer adds ([05](05-training-hub.md)) |
|---|---|---|---|---|---|
| 1 | 1–10 | URA Finale (1) | Project L'Arc (6) | Design Your Island (11) | 27 unlocks, tree of 12 |
| 2 | 11–20 | Unity Cup (2) | U.A.F. Ready GO! (7) | Yukoma Hot Springs (12) | 23, tree of 16 |
| 3 | 21–30 | Trackblazer (3) | Great Food Festival (8) | Beyond Dreams (13) | 21, tree of 20 |
| 4 | 31–40 | Our Grand Concert (4) | Run! Mecha Umamusume (9) | Tracen Diner (14) | 19, tree of 24 |
| 5 | 41–50 | Grand Masters (5) | The Twinkle Legends (10) | Japan's 15th (15) | 17, tree of 28 |

**What the scenario she is in decides:**

| Thing | Rule | Owner |
|---|---|---|
| **Cap profile** | Today's per-scenario caps, plus the 15th by the +250 rule | [04](04-tiers-and-promotion.md) §7 |
| **Scenario buff** | One per scenario, reviewed for the rework | [04](04-tiers-and-promotion.md) §8 |
| **Card era window** | Her set takes bonded cards with era ≤ T; era decay is measured against T | §8, [06](06-cards-and-bonds.md) |
| **Constellation tree** | The scenario's silhouette at 12, 16, 20, 24 or 28 card nodes; the node value follows from T's cap budget | [05](05-training-hub.md), [04](04-tiers-and-promotion.md) §7 |
| **Open layers** | Layers 1 … *s*: she can start sessions only for unlocks in them | [05](05-training-hub.md) |
| **SP cap** | Today's ladder by T (2,000 at T1 to 5,000 at T14, 5,200 at T15) | §8 |
| **Career** | A fresh career, frozen when she arrives | §4 |
| **Rivals** | The typical Uma of T | §9 |

She can't train ahead: scenario *s* + 1's layer opens only when she advances into it. The next tree doesn't exist for
her yet, and its unlocks need the next scenario's dish grades ([README](README.md#grades-follow-scenarios)).

## 4. Her career in each scenario

Careers are unchanged ([Scenario Careers](../design/scenario-goals.md), goal plan v4, D137, D138, D194). Each scenario gives
her a fresh career written for her profile:

| Stage | Racing Levels into the scenario | Goal | Releases |
|---|---|---|---|
| **Maiden** | 1–2 | Win one G3 in her profile | Level 3 |
| **Trials** | 3–5 | Win two G2s, one at each of her two distances | Level 6 |
| **Main** | 6–10 | Win three G1s: the scenario's G1 set, topped up from her own career | The advance |

- **Frozen on arrival.** A career is frozen when she arrives in the scenario: on unlock (tier 1 scenario 1), on
  advance, or on promotion (scenario 1 of the next tier). It reads her current build's aptitudes, so lineage carried
  from the scenario before shapes her profile as it does today.
- **Rotation by T.** Race picks and the G1 set rotation use the game's scenario number T, so each of the fifteen
  scenarios brings different races, as today's "tier *n* starts *n* places in".
- **Goals can be won early.** A G1 won at level 1 counts. Retries are free.
- **Goals pay nothing of their own.** No tickets, no stats, and no Inspiration tokens: D322's goal-paid tokens are
  superseded by D326 ([13](../rework/13-removals-and-plan-changes.md)).
- **Closed on leaving.** Advancing closes the career. Its goals are complete by then, because the advance requires it.
  At the tier's last scenario the career closes when she is promoted ([04](04-tiers-and-promotion.md)).
- `pnpm sim:careers` keeps generating a career for every Uma at every T (14 until the 15th ships) and checks
  every stage is winnable by a build with that scenario's full layer (§9).

## 5. Advancing to the next scenario

### When she can

She can advance when **all three** hold:
1. her Racing Level is at the scenario's gate (10*s*);
2. every goal of her career is won;
3. she is not in the tier's last scenario (there the next step is the Expedition, [10](../rework/10-expeditions.md)).

Then:
- **The Stable tile** shows its "ready" dot, and the Scenario Gate ([11](11-hub-and-places.md)) lists her.
- **Advancing is explicit:** the owner chooses when (as today).
- **Advancing is free.** D148's `5 × tier` Training Tickets are gone.
- **Her layer doesn't have to be done.** An unfinished layer stays open (§10.3).

### What changes and what carries

| Changes at the advance | Carries inside the tier |
|---|---|
| Racing Level: gate + 1, and the banked EXP applies | Every unlock: open nodes (as a count), Inspiration slots and golds, Extra Stats nodes bought |
| Cap profile and SP cap: the new scenario's | Every bond ([06](06-cards-and-bonds.md)) |
| Scenario buff: the new scenario's | The four presets: set, card and lineage assignments, active Extra Stats, loadout (§6) |
| Card era window: era ≤ T + 1, and era decay against T + 1 | Farm Level and Farm EXP ([07](07-farm.md)) |
| Constellation: the new silhouette, four more card nodes, a new node value | Her running work and queue: sessions, Farm jobs, reserved inputs |
| A new layer opens: nodes, Inspiration, Extra Stats, bonds ([05](05-training-hub.md)) | Unfinished unlocks of earlier layers |
| A fresh career, frozen now | Badges, titles, records and race defaults |
| Rivals: the new scenario's fields (§9) | Prize Money, the Warehouse, Speed Tickets (account-wide) |

### She is weaker on arrival, on purpose

Her unlocks carry, but each card node is worth less in the bigger tree:
- the same cap budget is spread over more nodes;
- her cards age one era;
- the old scenario's buff stops and the new one may not suit her yet.

The new layer is what makes her strong again. This is today's "a scenario is a career run" (D121), much gentler: she
arrives with 73–88% of the new scenario's full build instead of a fresh CL1 tree ([04](04-tiers-and-promotion.md) §7).

**Worked example.** Base 100 in every stat, growth +10% Speed and Stamina. A Medium preset with a
Speed, Stamina, Power, Guts and Wit card and one Friend card, two nodes each. Her two parent slots are filled, and her
five Extra Stats singles are one per stat (+40 each, D338).

| | Speed | Stamina | Power | Guts | Wit | Average | SP |
|---|---|---|---|---|---|---|---|
| URA Finale, layer 1 done (node 283, Foundation ×1.5 on Extra) | 907 | 783 | 839 | 669 | 556 | 751 | 2,000 |
| **Unity Cup on arrival** (12 of 16 nodes, node 212, cards one era old at 95%, Team Spirit +4%) | 693 | 601 | 643 | 517 | 433 | 577 | 1,632 |
| Unity Cup, layer 2 done (four nodes to the stat cards, 9 Extra Stats active) | 963 | 871 | 892 | 600 | 600 | 785 | 1,872 |

On arrival she's ahead of Unity Cup's lower grades but not yet ready for its G1s. Layer 2 makes her a G1 favourite
again. Fields are today's (§9).

### The Advance sheet

Opened from her profile or the Scenario Gate. It shows:
- **The move:** "URA Finale → Unity Cup", with both crests and "Racing Lv 10 → 11".
- **Stats before and after** for the selected preset: the five stats, SP and the new caps. A tab per preset.
- **The new layer** as counts: "4 constellation nodes · 4 Inspiration golds · 2 grandparent slots · 10 Extra Stats nodes · 3 bonds".
- **Unfinished earlier unlocks**, if any: "Layer 1: 23 of 27. The rest stay open."
- **The new buff**, in one line, and **the new career**: her G3, two G2s and three G1s, by name.
- **Free.** Nothing is spent.
- **Buttons:** Advance, or Not yet.

After Advance:
- the "<Scenario> Graduate" badge plays;
- the profile opens on the new scenario with her new career's first goal;
- the constellation opens on the new silhouette, its new nodes shown as "opens next" sockets.

### What is saved

`advance-scenario` is one operation ([13](../rework/13-removals-and-plan-changes.md) §6) on `umas/{outfitId}`:
- scenario + 1 and Racing Level 10*s* + 1, with the bank applied;
- the old career closed;
- the new career frozen;
- the presets rewritten by the carry (§6).

The API re-runs it with the domain package and refuses it unless the three conditions hold on the server's copy. A
retry returns its first receipt, so a lost reply never advances her twice.

## 6. One build per tier

### Four presets per tier

An Uma keeps **one build per tier**: four distance presets, Sprint, Mile, Medium and Long, as today (D252–D254), but
per tier rather than per scenario.

| Each preset holds | Shared by her four presets |
|---|---|
| Card set: up to six bonded, era-eligible cards, no duplicate character | Open card nodes (a count) |
| Card-node assignments | Inspiration slots and golds open |
| Lineage picks: who sits in each open Inspiration slot (D250's pick rules) | Extra Stats nodes bought |
| Which bought Extra Stats nodes are active, up to the scenario's capacity | Bonds |
| Skill loadout | Her career, Racing Level and Farm Level |

As today:
- her profile selects a preset, and every training screen edits it;
- a race uses the preset of its distance (D254);
- her running style stays one per Uma.

As built (T138): the selected preset is `raceDefaults.selectedPreset`, written by **`set-race-defaults`** with her
preferences (§7). The profile's Overview and Skills tabs switch it, and its Skills tab prices a loadout as `set-loadout`
does (`loadoutSummary`), so the SP line reads "SP 160 / 267" and an over-SP pick reads `over-sp`'s words.

### The carry at the advance (automatic)

Today's Load button (D288) becomes an automatic step of the advance, for all four presets at once:

- **Card nodes, by position in the unlock order.** Nodes open breadth-first ([05](05-training-hub.md)), so she arrives
  with the same number open. Open node *k* of the old tree takes its card to open node *k* of the new tree: the same
  node id, `n1` … `nk`, in every silhouette.
  - The per-card cap never falls between scenarios (3, 4, 5, 5, 6), so no card overflows.
  - Every card keeps exactly its node count, so the stats mostly move only by node value, era and buff.
  - D288's proportional spread is not used: it maps a 12-node tree onto a 16-node one and would drop the cards at the
    ends of the branches.
- **Card set:** unchanged. The era window only widens (era ≤ T + 1), so every card stays eligible.
- **Lineage picks:** unchanged. The six slots are the same in every scenario.
- **Active Extra Stats:** unchanged. The capacity rises (7, 9, 11, 13, 15), and the new room fills with bought nodes
  that were off, oldest purchase first. The owner can switch any of them, free.
- **Loadout:** unchanged, in its order. The library is the same, since the cards hold the same counts. If the new SP
  doesn't cover it, the equipped skills race in equip order while they fit (D132, D196), and the profile says so.

### New nodes

A node opened by a session joins all four presets. In each preset it takes the card of the set holding the **fewest
nodes under its cap**, with ties to the earlier card in the set. If every card is at its cap or the set is empty, it
stays empty. The owner can change it any time, free.

So a finished session needs no visit to the constellation, which keeps check-ins under a minute
([02](02-check-ins-and-notifications.md)). This is a recommendation to [05](05-training-hub.md), which owns sessions.

### Trained units are retired

D190 kept every unlocked scenario as a trained unit that could still race. That's gone (D328, superseding D121, D190
and D288):
- **She races as her current scenario**, always: its caps, its buff, its tree, its fields.
- **Nothing is kept** of the earlier scenario's build except what carries above. There is nothing to choose and no
  scenario picker on the profile or at Race Select.
- **Old records stay.** Her earlier careers, races, badges and titles stay as history.

### Races stay scenario-linked (D122)

- Every race result records the scenario she ran it in. The scenario number T also tells its tier.
- Winning the Arima Kinen in Trackblazer and again in Our Grand Concert are still two accomplishments.
- Badges and titles count as today. [04](04-tiers-and-promotion.md) §9 adds the tier and Expedition awards.

## 7. What an Uma is made of

Her save in plain words. It maps to `umas/{outfitId}` and `work/{outfitId}`
([13](../rework/13-removals-and-plan-changes.md) §6).

| Part | In plain words | At promotion | Owner |
|---|---|---|---|
| **Where she is** | Her tier (1–3) and scenario of the tier (1–5) | Next tier, scenario 1 | 03, [04](04-tiers-and-promotion.md) |
| **Racing** | Racing Level 1–50, EXP into the level, any banked EXP | Back to 1 | 03 |
| **Farm** | Farm Level 1–50 and Farm EXP | Back to 1 | [07](07-farm.md) |
| **Unlocks** | How many card nodes are open; which Inspiration slots and golds are open; which Extra Stats nodes she bought | Cleared | [05](05-training-hub.md) |
| **Bonds** | Which cards are bonded to her in this tier | Cleared (kept in promotion history) | [06](06-cards-and-bonds.md) |
| **Presets** | Four builds: card set, card-node assignments, lineage picks, active Extra Stats, loadout | Emptied (her unique stays) | 03 |
| **Career** | This scenario's frozen goals and their outcomes; earlier careers closed, as history | A new one; history kept | 03 |
| **Expedition** | Her progress in the tier's World Expedition | A new tier's, empty | [10](../rework/10-expeditions.md) |
| **Work** | Her running job or session and its queue, with reserved inputs | See [04](04-tiers-and-promotion.md) §5 | [02](02-check-ins-and-notifications.md), [05](05-training-hub.md), [07](07-farm.md) |
| **Promotion history** | One entry per tier left: when, which Expedition, her final build in brief | Grows | [04](04-tiers-and-promotion.md) |
| **Race defaults** | Preferred distance, surface and running style; the selected preset | Kept | 03 |
| **Records** | Race results, skill history, badges, titles, trophies (their own logs and entity) | Kept | [Badges](../design/badges.md) |

**Not stored, as today:** stats, aptitudes, SP and the skill library. They are derived when read (§8).

**Race defaults as built (T138).** `set-race-defaults { umaId, selectedPreset?, preferences? }` sets the selected preset,
her preferences, or both; `preferences: null` goes back to the recommendation. Until she sets them, the profile shows
today's recommendation from her career aptitudes and the race catalogue (`racePreferencesOf`), the one her career was
frozen with. Changing them never refreezes the career she is in: they shape the next one (§4). Her Racing EXP bar fills
toward `racingExpToNext`: the next level's cost, the next scenario's first step at a gate, nothing at the tier's last gate.

## 8. Derived stats after the rework

Stats stay **derived** from her build every time they're read (D121). The rework removes:
- **card stars:** every card pays today's 3★ value, 100% (D329);
- **Constellation Level** (D326);
- **the fixed 240-point Extra pool:** Extra Stats become flat node values from the Gym ([05](05-training-hub.md)).

For one preset in scenario T (tier *t*, scenario *s*, *N* = 12, 16, 20, 24 or 28 card nodes):

```
nodeValue(T)  = round((0.60 × capBudget(T) − E(t, s)) / N)           E is 05's extraBudget; table in 04 §7
cardRaw(stat) = Σ open card nodes holding a stat card:
                  nodeValue(T) × eraPct(card, T) × (100 + buffPct)% × share[type][stat]
extra(stat)   = Σ active Extra Stats nodes' value for the stat        flat; tier values in 04 §7
derived(stat) = min( cap(T)[stat], round( base[stat] + cardRaw(stat) × (1 + growth[stat]) + extra(stat) ) )

eraPct        = max(40, 100 − 5 × (T − era(card)))                    as today (D126)
```

| Part | Rule | Changed from today |
|---|---|---|
| **Base stats** | The template's 5★ base stats (D152) | Unchanged |
| **Card nodes** | Full value × era × buff, split by card type (Speed 0.70/0.30 and the rest, D180) | No star percentage; node values from the new tree sizes |
| **Friend and Group cards** | Pay SP instead of stats (D132); Orders adds a quarter as stats | Unchanged |
| **Growth rates** | Multiply card points only | Unchanged |
| **Extra Stats** | Flat values per active node: tier 1 single +40, Duo +20/+20, Sun +8 to all five (D338); ×1.25 in tier 2, ×1.5 in tier 3 | Was 6 × 40 from crops. Not multiplied by growth or any buff except Foundation (as D314 did for Farm Extra) |
| **Scenario buff** | One whole percentage on card nodes, as today (D165) | Rules reviewed on [04](04-tiers-and-promotion.md) §8 |
| **Caps** | Clamp each stat; never reduce one | Unchanged |
| **Per-card cap** | `ceil(N / 6) + 1`: 3, 4, 5, 5, 6 (D134) | New tree sizes |
| **Aptitudes** | Lineage only, capped at A (D123) | Unchanged |

**Skill points.** CL raised the 40% baseline. It now follows the open card nodes:

```
baselineSP(T) = round(0.40 × spCap(T) × openCardNodes / N)
spNodeValue(T) = round(0.60 × spCap(T) / ceil(N / 6))
SP            = min( spCap(T), baselineSP(T) + Σ Friend/Group nodes × spNodeValue(T) × eraPct )
```

So the Observatory still pays SP as CL did, and a Friend or Group card on its fair share pays the other 60% (D133).
In URA Finale, 12 open nodes give 800 SP, and a Friend card on two nodes adds 1,200, reaching the 2,000 cap.

**Exact integers.** Every factor stays a whole percentage. Every Extra Stats node value is a whole number (D338), held like the
percentages, and the stat rounds once at the end, so the invariance rule still holds exactly: moving a card between
nodes never changes a total (D126).

`pnpm sim:builds` re-runs the stamina ladder on the new trees: every distance's deck must still hold a full
spurt at every T ([05](05-training-hub.md) §12). The Extra Stats now carry 200–900 points instead of 240, which is more
room for stamina from a tier's second scenario on. A tier's first Gym layer holds one single per stat, so there they
can't lean.

## 9. Racing difficulty: unchanged

The owner's rule (D336): **don't touch the handicaps.** Rivals are built exactly as today (D152, D159, D191): **a
typical trained Uma of her scenario**, handicapped by the race's grade.

| Grade | Handicap | Rivals race at |
|---|---|---|
| Debut, Maiden | 35% | 65% of a trained Uma |
| Pre-OP, OP | 30% | 70% |
| G3 | 25% | 75% |
| G2 | 15% | 85% |
| G1 | 5% | 95% |

- **The rival formula doesn't change either**, including its card factor. Today's typical Uma carries cards at 84% a
  node (`TYPICAL_CARD_STARS = 2`, D200). The constant stays at 84% even though stars are gone for the owner: it's the
  rivals' build, not a star. A fully trained Uma, whose cards now always pay 100%, keeps **exactly today's edge**: a
  real contest at G1 that she's favoured in, and favoured below it.
- **The typical Uma reads the new trees.** Her nodes come from the re-authored sizes (12–28) and their node values
  ([04](04-tiers-and-promotion.md) §7), and her Extra Stats are the scenario's capacity. So rivals stay matched to
  each scenario's budget, as today.
- **Difficulty assumes a fully trained Uma.** The owner finishes the passive layer first and then races the career,
  so the game is tuned for that and not for any timetable. An Uma can race at any point with whatever she has
  unlocked. A brand-new or just-promoted Uma mostly loses until her first unlocks land, and that's expected.
- `pnpm sim:careers` re-measures the typical Uma on the new trees and checks today's target: a fully trained
  build wins the Maiden G3 and Trials G2s and is favoured in her G1s. The handicaps stay the owner's one-line lever
  (D159), as today.

**Measured** (T133, D349). Each stage's race on a full-layer build: every card node of the tree open with current-era
cards at 100%, her open Inspiration slots filled and Extra Stats at capacity. Best case of the distance's sets and the
four running styles, 20 races a cell in 12-runner fields, in % (sprint · mile · medium · long). A bold rate misses §12's
target:

<!-- live:rework-career-rates -->
| T | Scenario | Maiden G3 (won) | Trials G2 (90% or more) | Main G1 (60–100%) | Targets |
|---|---|---|---|---|---|
| 1 | URA Finale | 100 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | 95 · 95 · 100 · 100 | met |
| 2 | Unity Cup | 100 · 100 · 100 · 100 | 95 · 95 · 100 · 100 | 80 · 85 · 100 · 100 | met |
| 3 | Trackblazer | 100 · 100 · 100 · 100 | 100 · 95 · 100 · 100 | 95 · 85 · 100 · 100 | met |
| 4 | Our Grand Concert | 100 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | 100 · 95 · 100 · 100 | met |
| 5 | Grand Masters | 100 · 100 · 100 · 100 | 95 · 100 · 100 · 100 | 95 · 90 · 100 · 100 | met |
| 6 | Project L'Arc | 100 · 100 · 100 · 100 | 95 · 95 · 100 · 100 | 85 · 90 · 100 · 100 | met |
| 7 | U.A.F. Ready GO! | 100 · 100 · 100 · 100 | 95 · 100 · 100 · 100 | 90 · 90 · 100 · 100 | met |
| 8 | Great Food Festival | 100 · 100 · 100 · 100 | 95 · 100 · 100 · 100 | 95 · 95 · 100 · 100 | met |
| 9 | Run! Mecha Umamusume | 100 · 100 · 100 · 100 | 95 · 90 · 100 · 100 | 95 · 85 · 100 · 100 | met |
| 10 | The Twinkle Legends | 100 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | 95 · 95 · 100 · 100 | met |
| 11 | Design Your Island | 100 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | 85 · 95 · 100 · 100 | met |
| 12 | Yukoma Hot Springs | 100 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | 100 · 95 · 100 · 95 | met |
| 13 | Beyond Dreams | 100 · 100 · 100 · 100 | 95 · 95 · 100 · 100 | 95 · 95 · 100 · 95 | met |
| 14 | Tracen Diner | 100 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | 95 · 80 · 95 · 95 | met |
<!-- /live -->

**The rivals' Extra Stats.** The typical Uma's Extra Stats are the scenario's full capacity, not discounted by her 84%
card factor, so her trained stat grows faster late in each tier than today's: 642 → 728 across tier 1, against today's
650 → 689. It doesn't cost a fully trained Uma her edge. Her G1s at scenarios 4 and 5 of each tier are won 80–100% of
the time, best case, as everywhere else, so the formula stays as it is (D336).

The G1 grid of the stamina ladder's sets (`pnpm sim:builds`, 200 races a cell), the pace rate and the best
running style's:

<!-- live:rework-g1-rates -->
| T | Scenario | Sprint 1,400 m | Mile 1,600 m | Medium 2,400 m | Long 3,000 m |
|---|---|---|---|---|---|
| 1 | URA Finale | 66% / 68% | 56% / 64% | 90% / 96% | 99% / 99% |
| 2 | Unity Cup | 66% / 67% | 65% / 70% | 88% / 95% | 96% / 98% |
| 3 | Trackblazer | 66% / 66% | 59% / 68% | 83% / 89% | 88% / 89% |
| 4 | Our Grand Concert | 66% / 66% | 60% / 61% | 91% / 95% | 100% / 100% |
| 5 | Grand Masters | 69% / 69% | 66% / 66% | 95% / 96% | 99% / 100% |
| 6 | Project L'Arc | 71% / 71% | 67% / 73% | 88% / 92% | 97% / 97% |
| 7 | U.A.F. Ready GO! | 71% / 71% | 66% / 71% | 76% / 82% | 90% / 95% |
| 8 | Great Food Festival | 64% / 66% | 64% / 69% | 84% / 85% | 79% / 88% |
| 9 | Run! Mecha Umamusume | 69% / 74% | 64% / 65% | 89% / 97% | 98% / 100% |
| 10 | The Twinkle Legends | 69% / 69% | 53% / 58% | 87% / 92% | 96% / 98% |
| 11 | Design Your Island | 73% / 75% | 72% / 77% | 86% / 89% | 91% / 97% |
| 12 | Yukoma Hot Springs | 71% / 72% | 65% / 70% | 77% / 84% | 78% / 92% |
| 13 | Beyond Dreams | 74% / 80% | 62% / 66% | 72% / 77% | 72% / 86% |
| 14 | Tracen Diner | 73% / 73% | 58% / 58% | 82% / 85% | 91% / 96% |
<!-- /live -->

## 10. Edge cases

1. **An Uma bought mid-tier.** Every new Uma starts at tier 1, scenario 1, Racing Level 1, Farm Level 1, whenever she's
   bought. The roster's progress doesn't matter. What helps her catch up:
   - Her first layer is the tier's cheapest (grade 1–2 dishes, [12](12-economy-and-pacing.md) §5), and the shared
     Warehouse often already holds them.
   - Her Inspiration slots take any Uma ever owned, so her parents are strong from the start.
   - She can race at once, though she mostly loses until her first unlocks land (§9).
   - Her Farm Level 1 limits only the jobs she runs herself. Other Umas cook her higher grades.

   With a 0-stock Warehouse she gathers grade 1 herself. Her first unlock then lands within about a day.
2. **Her training lags behind her racing.** Racing Level and unlocks are independent, so this is allowed:
   - Holds and goals already tie her career to her strength: a G1 against a full-layer field is hard on a half layer.
   - If she wins anyway (skills, a good draw), she may advance.
   - Every unfinished unlock of every earlier layer stays open.
   - The planner lists them oldest layer first: they use cheaper dishes and lift her most per hour
     ([02](02-check-ins-and-notifications.md)).
3. **At the gate with an incomplete layer: she may advance.** Decided, because:
   - racing is never blocked (D328);
   - nothing is lost: the layer stays open for the rest of the tier;
   - she has already won three G1s against full-layer fields, so she's strong enough to start a new career;
   - forcing a full layer would let a slow Farm block racing progress.

   The Advance sheet names what's unfinished, and the arrival stats show its cost.
4. **Racing an "old scenario's" race.** There are none to run:
   - she races only as her current scenario;
   - a race that was a goal earlier can be run again, but counts in the current scenario: a new win, and maybe a
     Two-Time title;
   - an old result replays from its own stored inputs (scenario, build snapshot, engine version), unchanged;
   - Expedition races run as her current (last) scenario, tagged as the Expedition ([10](../rework/10-expeditions.md)).
5. **Waiting at the gate.** Allowed, without limit:
   - she keeps racing her current scenario's fields with her finished build, which she may out-class;
   - EXP banks to 100 and stops;
   - Prize Money keeps coming under [09](09-racing-rewards-and-exchange.md)'s anti-grind rule.

   This is how the owner can let a strong Uma earn while her neighbours catch up.
6. **Advancing with work running.** Sessions and Farm jobs continue. A session started for a layer-1 node opens the
   next node in the new tree's unlock order, which is the same node by count.
7. **An empty set.** She can race; her stats are base plus Extra Stats. A new node stays empty until a card is bonded
   and set.
8. **Offline, stale screen and retries.**
   - **Offline:** the advance applies locally at once. The API re-runs it on sync. If the server's copy disagrees (a
     race from another device not yet seen), the server's answer wins and the screen reloads.
   - **Stale screen:** if a race or session changed her after the Advance sheet opened, the advance is refused and
     the sheet redraws with her current numbers under "Her build changed." The Advance button stays, so one more tap
     advances. Nothing is half-applied.
   - **During a race:** the advance waits until the race's result commits.
9. **A promoted Uma** arrives at scenario 1 of her new tier with nothing but her records ([04](04-tiers-and-promotion.md)
   §4). Everything on this page then starts again.

## 11. Decided here

| Choice | Why |
|---|---|
| Racing EXP curve and EXP per finish unchanged (100 … 300 a level, 1,800 a scenario) | The owner asked for "as today"; it already gives about 14 races a scenario, which [12](12-economy-and-pacing.md) assumes |
| The advance supplies the scenario's tenth level; the gate banks 100 | Today's rule; README's "180 a level" is the average |
| Level-ups pay nothing of their own, except the gate's Uma Shard (D336) | Training Tickets are gone; races pay Prize Money; Shards stay the normal unlock |
| Lifetime level = 50 × (tier − 1) + Racing Level for lists and level badges | Keeps D181's "highest first" and the level badges meaningful across tiers |
| Scenario *s* + 1's layer opens only on advancing | Its tree and dish grades belong to that scenario |
| Advancing is explicit and free, and allowed with an incomplete layer | D328; nothing is lost, and the career already proves her strength |
| Carry by position in the unlock order (node *k* → node *k*), all four presets, automatically | Same open count; per-card caps never fall; D288's proportional spread would drop cards |
| A newly opened node takes the set's card with the fewest nodes under its cap | A finished session needs no constellation visit (recommendation to [05](05-training-hub.md)) |
| Lineage picks stay per preset | A sprint preset's parents lift sprint aptitudes (D253) |
| New Extra Stats capacity fills with bought-but-off nodes, oldest first | The advance never leaves capacity idle; switching stays free |
| Baseline SP = 40% of the SP cap × open nodes ÷ tree nodes | Replaces CL's baseline; the Observatory pays SP as CL did |
| Rivals and grade handicaps exactly as today, including the rivals' 84% card factor; D191's minimum over 15 scenarios | The owner's rule (D336); a fully trained Uma keeps today's edge, and the same typical Uma serves the Expeditions ([10](../rework/10-expeditions.md)) |
| Difficulty assumes a fully trained Uma; no special fields for new Umas | The owner trains first, then races (D336) |
| The rivals' Extra Stats stay the scenario's full capacity, not discounted by their 84% card factor (D349) | Measured on full-layer builds, every career cell meets §12's targets at T = 1–14, scenarios 4 and 5 included; D336 fixes the formula |
| Each gate pays 1 Uma Shard, once per Uma per gate per tier (D340) | D336, [04](04-tiers-and-promotion.md) §6 and [13](../rework/13-removals-and-plan-changes.md) §2 over the first draft, which removed it |
| The gate's bank applies at the advance, through the new career's holds (D340) | Today's advance sets EXP to 0; the rework's gate banks the next scenario's first step for this |
| The rules are ports, each held to today's by a parity test: Racing EXP restates `addUmaRaceExp`, goal settlement `evaluateScenarioGoals`; career generation and every constant are imported (D340) | Today's functions take today's whole save and stop at Uma Level 140, not at each tier's last gate |
| A career's aptitudes come from the selected preset's lineage, its filled open slots (D340) | As from today's active preset (D252): lineage carried from the scenario before shapes her next career |
| Lifetime level equals today's Uma Level at the same T, so today's level helpers (holds, the planner) take it unchanged (D340) | 50(*t* − 1) + Racing Level is 10(T − 1) + level into the scenario |
| **Race again** stays enabled at a gate (T141) | §10.5: waiting at the gate is allowed and keeps paying Prize Money |
| Legacy counts the selected preset's parents at each arrival (unlock, advance, promotion), when her career freezes (T141) | Today's Scenario Start is gone; arrival is when the career freezes (§4) |
| The Advance sheet's "after" (stats, SP and caps per preset, the level, the new career) is `advance-scenario` run on a copy of the state. A race or session that changed her since the sheet was drawn, or a refusal, redraws it under "Her build changed." and keeps the button (T141) | §5: the sheet shows exactly what the tap does; §10.8's stale rule, checked on the device, since the operation takes no version |
| "Layer 1: 23 of 27" counts the layer's open fixed unlocks and its bonds in order across layers (6, 3, 3, 3, 3) (T141) | [05](05-training-hub.md) §3's layer sizes count the Dojo's pacing bonds |
| After Advance the "<Scenario> Graduate" award plays full screen, then her profile opens (`/town/stable/outfit/:umaId`) (T141) | §5's "After Advance" |

## 12. Done when

- A new Uma unlocked with an Uma Ticket shows "T1 · URA Finale · Racing Lv 1 · Farm Lv 1", with a frozen career and
  an empty tree of 12.
- Wins move Racing EXP by the table in §2. Racing Level stops at 2 and 5 of a scenario until the goals are won, and at
  10*s* until the advance. A tier-1 Uma can never pass Racing Level 50.
- The Advance sheet appears only at the gate with a complete career. It shows before and after stats for each preset,
  spends nothing, and a retried `advance-scenario` never applies twice.
- After an advance, all four presets hold the same cards on the same number of nodes, in unlock order, and her bonds,
  unlocks, Farm Level and running work are unchanged.
- There is no scenario picker anywhere, and a new race result records her current scenario.
- `deriveStats` has no star or CL input. A domain test pins §8's worked example, URA Finale's 800 + 1,200 SP, and the
  exact invariance (moving a card between nodes never changes a total).
- `pnpm sim:careers` generates every career at all 15 scenarios (14 until the 15th ships). With full-layer
  builds, every Maiden G3 is won, the Trials G2s at 90% or more, the Main G1s at 60–100% best case, with today's
  handicaps unchanged (§9).
- `pnpm sim:builds`' stamina ladder holds at every T on the new trees ([05](05-training-hub.md) §12).
