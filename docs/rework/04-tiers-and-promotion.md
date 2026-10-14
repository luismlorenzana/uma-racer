# 04 · Tiers and promotion

> **Status: approved design, 2026-10-14; first written 2026-10-13 (D327, D331, D332).** Three tiers of five scenarios, the 15th
> scenario, promotion, what resets and what carries, Uma Tickets and the roster, tier scaling, and the scenario buffs
> reviewed for the rework. Every number is a **draft**; the sims named in each section pin it.

An Uma's progress inside a tier (Racing Level, advancing, her one build) is on [03](03-uma-progression.md). The World
Expedition that ends a tier is on [10](10-expeditions.md); this page only uses its result.

## 1. The tier map

Scenarios keep today's order, by JP release. Scenario *s* of tier *t* is the game's scenario **T = 5(*t* − 1) + *s***.

<!-- live:tier-map -->
| Tier | *s* | T | Scenario | JP release | Racing Levels | Cap budget | SP cap |
|---|---|---|---|---|---|---|---|
| **1** | 1 | 1 | URA Finale | 2021-02-24 | 1–10 | 6,000 | 2,000 |
| | 2 | 2 | Unity Cup | 2021-08-30 | 11–20 | 6,250 | 2,400 |
| | 3 | 3 | Trackblazer | 2022-02-24 | 21–30 | 6,500 | 2,800 |
| | 4 | 4 | Our Grand Concert | 2022-08-24 | 31–40 | 6,750 | 3,000 |
| | 5 | 5 | Grand Masters | 2023-02-24 | 41–50 | 7,000 | 3,200 |
| **2** | 1 | 6 | Project L'Arc | 2023-08-24 | 1–10 | 7,250 | 3,400 |
| | 2 | 7 | U.A.F. Ready GO! | 2024-02-24 | 11–20 | 7,500 | 3,600 |
| | 3 | 8 | Great Food Festival | 2024-06-26 | 21–30 | 7,750 | 3,800 |
| | 4 | 9 | Run! Mecha Umamusume | 2024-10-29 | 31–40 | 8,000 | 4,000 |
| | 5 | 10 | The Twinkle Legends | 2025-02-24 | 41–50 | 8,250 | 4,200 |
| **3** | 1 | 11 | Design Your Island | 2025-06-27 | 1–10 | 8,500 | 4,400 |
| | 2 | 12 | Yukoma Hot Springs | 2025-10-29 | 11–20 | 8,750 | 4,600 |
| | 3 | 13 | Beyond Dreams | 2026-02-24 | 21–30 | 9,000 | 4,800 |
| | 4 | 14 | Tracen Diner | 2026-06-29 | 31–40 | 9,250 | 5,000 |
| | 5 | 15 | Japan's next | — | 41–50 | 9,500 | 5,200 |
<!-- /live -->

- **The 15th is Japan's next scenario**, expected late October 2026, with no date until the platform publishes it (§2).
- **Each tier ends in a World Expedition** (D332). An Uma who completes it is **promoted** (§3).
- **Each Uma is in exactly one tier.** Only promoted Umas exist in tiers 2 and 3 (§6).
- **A tier is about 20 weeks** for a roster of 25, with its Expeditions about 22 ([12](12-economy-and-pacing.md) §10).
  Tiers 2 and 3 cost the same Farm time as tier 1. They are harder in races and Expeditions (§7).

## 2. Tier 3 and the 15th scenario

Japan has released a scenario about every four months (February, June, October). The last was Tracen Diner on
2026-06-29, so the 15th is likely out within weeks of this page.

### Until it ships: tier 3 runs four scenarios, and its Expedition opens after Tracen Diner

**Decided:** while the platform's master data has no 15th scenario, tier 3 is scenarios 11–14:
- Racing Level 1–40, with the gate at 40;
- layers 1–4 only ([05](05-training-hub.md)): a tree of up to 24 nodes, Extra Stats capacity 13 (D338), six Inspiration
  slots with eight golds, and 15 bonds;
- **the tier-3 Expedition opens at the scenario-14 gate**, once her Tracen Diner career is complete;
- its fields build on Tracen Diner's (§7).

**Why not fold the fifth layer into scenario 4:**
- It would make Tracen Diner two layers long, about eight weeks, which breaks the one-layer, four-week scenario
  ([12](12-economy-and-pacing.md)).
- When the 15th lands, half-done fifth-layer unlocks would have to move from Tracen Diner's tree to a new one.
- Cutting needs no data move: the 15th simply appends.

**It probably never runs.** Tier 3 starts about 44 weeks into the new game ([12](12-economy-and-pacing.md) §10). The
15th will almost surely be in master data by then.

### When the platform publishes the 15th

1. **Master data** gains the scenario: its name, JP release date and crest art.
2. **The racer's scenario table** gains row 15:
   - caps by today's +250 rule: Speed 2,600, Stamina 1,750, Power 1,800, Guts 1,700, Wit 1,650 (9,500);
   - SP cap 5,200, continuing the +200 ladder;
   - a tree of 28 in the scenario's motif, authored by [05](05-training-hub.md);
   - the placeholder buff **Encore** (§8), replaced if the scenario's theme suggests a better rule;
   - a decision entry logs it.
3. **Card eras recompute.** A card released on or after the 15th's JP date becomes era 15.
4. **Tier 3 becomes five scenarios**, Racing Level 1–50, and its Expedition moves to the scenario-15 gate.

| An Uma who is… | …when the 15th lands |
|---|---|
| In tier 1 or 2, or in tier 3 before scenario 14's gate | Nothing visible. Her tier 3 has five scenarios |
| At the scenario-14 gate, career not complete | Her gate now leads to an advance into the 15th; the Expedition follows it |
| In tier 3 with her Expedition already open | It stays open. She may finish it from scenario 14, with fields still built on scenario 14, the scenario she races as. Or she may advance into the 15th first (free, explicit): her runs and wins carry, and her fields then build on the 15th |
| Already in the Hall of Fame from scenario 14 | She may advance into the 15th: Racing Levels 41–50, layer 5 and a new career. She stays in the Hall of Fame and owes no second Expedition |
| At scenario 14 with a card that has just become era 15 in a set | The card leaves her scenario-14 sets (its bond stays). The set shows the gap, and the card returns when she reaches the 15th |

### Scenarios after the 15th

- **Eras count only the game's scenarios:** `era(card) = max { T ≤ 15 : jpRelease(T) ≤ card's JP release }`. A card
  newer than the 16th is era 15, so every card stays usable in tier 3's last scenario.
- **A tier 4 is not planned.** Scenarios 16 and later are not playable. When Japan has released 16–20 (about early 2028
  at its pace), a tier 4 is five rows of this table plus a tier-4 Expedition, logged as its own decision.

## 3. Promotion

### The trigger

An Uma is promoted by **completing her tier's World Expedition**: eight distinct wins from its race pool (D332).
[10](10-expeditions.md) owns everything about the Expedition: choosing one, its pool, attempts, mechanics and fields.
The hook here:

1. **She may start an Expedition** once her career at the tier's last scenario is complete: Racing Level 50, every goal
   won. In tier 3, while it has four scenarios, that is Tracen Diner's career at Racing Level 40 (§2).
2. **She does not need a finished build.** Racing is never blocked (D328): the field is the real gate, and unfinished
   unlocks only make it slower.
3. **The eighth distinct win completes the run**, inside that race's commit. She is then **Ready for promotion**,
   with a gold chip on her Stable tile and the Expedition Map.

### Promotion is a separate, confirmed action

The owner presses **Promote** when they choose. There is no deadline. Why not automatic:
- **A reset is the biggest thing that happens to an Uma.** The owner may want to race her at her peak a while longer,
  chase a Clean Sweep of the pool ([10](10-expeditions.md)), finish a badge, or let her work end.
- **Waiting costs nothing and blocks nobody.**

While she waits she races as her last scenario, earns Prize Money ([09](09-racing-rewards-and-exchange.md)), works on
the Farm, and can still finish unlocks. **Promote is enabled only while she is free** (§5).

### What is saved

`promote` is one operation ([13](13-removals-and-plan-changes.md) §6), re-run by the API with the domain package.
It requires a completed Expedition run and a free Uma on the server's copy. In one commit it:
1. **closes her tier:** the last career closes, and a tier-history entry records:
   - the tier and the date;
   - her final Racing Level;
   - each preset's derived stats and card set, and her bonded cards ([06](06-cards-and-bonds.md));
   - a summary of every Expedition run (Expedition, wins, races, completed or not), after which her Expedition state is
     cleared ([10](10-expeditions.md));
2. **resets her** (§4) into tier *t* + 1, scenario 1, Racing Level 1, Farm Level 1, with a new career frozen at once;
3. **pays one Uma Ticket**, ledger id `promotion-uma-ticket:{umaId}:{tier}`;
4. **writes the awards** (§9) as flair events.

The ledger id makes the ticket once-only. A retried `promote` returns its first receipt.

## 4. What resets and what carries

**Everything on the Uma resets; everything the account owns carries** (D327).

| Resets on the Uma | Kept on the Uma | Carries on the account |
|---|---|---|
| Racing Level and EXP → 1 | Her records: race results, skill history, careers as history | **The Warehouse** and every item in it, Speed Tickets included |
| Farm Level and EXP → 1 ([07](07-farm.md)) | Badges, titles, trophies, Prestige | **Prize Money** |
| Unlocks: card nodes, Inspiration slots and golds, Extra Stats nodes | Promotion history | **Uma Tickets**, plus the one her promotion pays |
| Bonds: every card ([06](06-cards-and-bonds.md)) | Race defaults: distance, surface, running style | **Building and facility upgrades**: levels and slots ([07](07-farm.md), [05](05-training-hub.md)) |
| Presets: sets, assignments, lineage picks, active Extra Stats; the loadout falls to her unique | Ownership: she is still owned, so she's still eligible as a parent | **The Card Library** ([06](06-cards-and-bonds.md)) |
| Career: a new one at scenario 1 of the new tier | | **Titles and badges** of every Uma, and Trainer achievements |
| Expedition state: cleared into her tier history | | **Lineage eligibility:** Inspiration slots accept any Uma ever owned, whatever her tier |

**One Uma, one tier.** A promoted Uma leaves her old tier completely: no copy stays behind, and she can't be bought
into it again (one Uma per outfit). Her old tier's races and badges stay hers, linked to the scenarios she ran them
in (D122).

## 5. Running work at promotion

An Uma does one passive thing at a time and may have a queue ([02](02-check-ins-and-notifications.md)).

**Decided: promotion needs her free.** That means no running Farm job or session, no queue, and no finished output
waiting for Collect. So no job or session ever spans two tiers, and no Farm EXP or unlock lands in the wrong one.
[07](07-farm.md) recommends the same.

| Her work when the owner wants to promote | What the Promote sheet offers |
|---|---|
| Free | **Promote** is enabled |
| A finished job or session waiting | **Collect**, one tap. Its items go to the Warehouse, its Farm EXP to her current tier, its unlocks to her current build |
| A running Farm job | Its time left, with **Recall** ([07](07-farm.md): pays the finished items, returns the inputs of every unmade one, drops the queue) or **−30m** with Speed Tickets. Or wait: the sheet says "Free in 1 h 20 m" |
| A running session | **Recall** ([05](05-training-hub.md): unused dishes return to the Warehouse). Its unlock would reset the moment it opened anyway |
| A queue behind either | Dropped by the recall. Queued work holds no inputs ([07](07-farm.md)), so nothing needs returning |

- **Nothing is reserved at the moment of promotion.** Inputs are held only by a running job or session, and promotion
  waits until there is none.
- **The sheet's line is plain:** "She's still working: Fishery, 1 h 20 m left." Then Collect, Recall or −30m, then
  Promote.
- **A returned dish is as good in any tier.** Grades are the same everywhere ([12](12-economy-and-pacing.md) §9), so
  another Uma can use it.

Why not let a Farm job run through: its EXP would land in the new tier, and a job above her new Farm Level would run at
a grade she can no longer start. Waiting a few hours at most, or one tap of Recall, is cheaper than those rules.

## 6. Uma Tickets and the roster

**Only tier 1 has an unlock concept.** An Uma Ticket unlocks any Uma not yet owned, and every new Uma starts at tier 1,
scenario 1 ([03](03-uma-progression.md)). Tiers 2 and 3 fill only by promotion.

<!-- live:uma-tickets -->
| Source | Amount | Ledger id |
|---|---|---|
| A new account | 20 Uma Tickets | `initial-uma-tickets` |
| Each scenario gate an Uma reaches, once per Uma per gate per tier: Racing Lv 10, 20, 30, 40 and 50 | 1 Uma Shard | `uma-gate-shard:{umaId}:{lifetime gate}` |
| Exchanging Uma Shards in the Stable | 5 Uma Shards make 1 Uma Ticket | `uma-shard-exchange:{n}:shards` and `uma-shard-exchange:{n}:coupon` |
| A promotion | 1 Uma Ticket | `promotion-uma-ticket:{umaId}:{tier}` |
| Entering the Hall of Fame | 1 Uma Ticket | `promotion-uma-ticket:{umaId}:3` |
<!-- /live -->

- **The 20 are D323's start; Shards are the normal unlock** (D336). The exchange is an explicit one in the Stable, one
  ticket at a time, numbered as today. A gate's Shard is keyed by her lifetime gate (10 … 150), so each tier's gates pay
  again. An unlock spends 1 ticket under `unlock-uma:{outfitId}` (D340).
- **Uma Tickets are never sold** (D336). The roster grows as Umas progress through the scenarios, which is the game's
  normal unlock. Uma Select Coupons are Uma Tickets under their new name ([13](13-removals-and-plan-changes.md)).
- **Shards come from every tier.** A tier-2 or tier-3 Uma's gates pay Shards too, but the tickets they make only ever
  bring an Uma into tier 1, which is what "tier 1 only" means. Every Uma pays about one ticket per tier she completes.
- **No roster cap.** Building and facility slots are the real limit ([07](07-farm.md), [05](05-training-hub.md),
  [12](12-economy-and-pacing.md) §7). An Uma beyond what the slots keep busy just waits for work, and tickets never
  expire, so the owner can hold them.
- **Refilling is the owner's choice.** A promoted Uma pays the ticket that can replace her in tier 1. The planner shows
  idle Umas, and an idle Uma is the sign that the account has enough hands ([02](02-check-ins-and-notifications.md)).
- **When every outfit is owned**, tickets and Shards keep counting and wait for new outfits.

### The roster over time

[12](12-economy-and-pacing.md)'s model: 25 Umas travel together, three check-ins a day, target racing.

| Week of the new game | Tier 1 | Tier 2 | Tier 3 | Hall of Fame | Tickets so far |
|---|---|---|---|---|---|
| 0 | 20 | — | — | — | 20 at the start, all spent |
| ~4–5 | **24** | — | — | — | +4 from the first scenario gates' 20 Shards |
| ~9 | ~28 | — | — | — | +4–5 a month from gates after that |
| ~21 | 35–40 if every ticket is spent; the first 20 at scenario 5 | — | — | — | |
| ~21–23 | The first 20 on Expeditions | — | — | — | |
| ~23 on | The rest of tier 1, plus refills | The promoted, about 20 at first | — | — | +1 per promotion |

Later tiers follow the same shape about 17–21 weeks apart ([12](12-economy-and-pacing.md) §10).

- **Roster size doesn't change an Uma's four weeks** ([12](12-economy-and-pacing.md) §9): each Uma brings her own work
  time. It changes how many Umas finish, as long as slots keep up. Lv 2 buildings carry about 25 Umas and Lv 3 about
  30–32.
- **Past that the Kitchen is the limit**, so the owner can hold spare tickets. `pnpm sim:loop`'s growing-roster
  variant measures the trade. The recommended practice is to unlock as long as the planner shows no idle Umas.

## 7. Tier scaling

Four things make a higher tier harder:
- higher caps, and node values from them;
- bigger Extra Stats;
- stronger rival fields;
- harder Expeditions.

Farm time doesn't change ([12](12-economy-and-pacing.md) §9).

### Cap profiles

Today's table (D244): URA Finale at 1,200 a stat, then +250 a scenario, 100 to Speed and 150 rotating through the
others. The 15th continues the rotation.

<!-- live:tier-caps -->
| T | Scenario | Speed | Stamina | Power | Guts | Wit | Budget |
|---|---|---|---|---|---|---|---|
| 1 | URA Finale | 1200 | 1200 | 1200 | 1200 | 1200 | 6000 |
| 2 | Unity Cup | 1300 | 1300 | 1250 | 1200 | 1200 | 6250 |
| 3 | Trackblazer | 1400 | 1300 | 1350 | 1250 | 1200 | 6500 |
| 4 | Our Grand Concert | 1500 | 1300 | 1350 | 1350 | 1250 | 6750 |
| 5 | Grand Masters | 1600 | 1350 | 1350 | 1350 | 1350 | 7000 |
| 6 | Project L'Arc | 1700 | 1450 | 1400 | 1350 | 1350 | 7250 |
| 7 | U.A.F. Ready GO! | 1800 | 1450 | 1500 | 1400 | 1350 | 7500 |
| 8 | Great Food Festival | 1900 | 1450 | 1500 | 1500 | 1400 | 7750 |
| 9 | Run! Mecha Umamusume | 2000 | 1500 | 1500 | 1500 | 1500 | 8000 |
| 10 | The Twinkle Legends | 2100 | 1600 | 1550 | 1500 | 1500 | 8250 |
| 11 | Design Your Island | 2200 | 1600 | 1650 | 1550 | 1500 | 8500 |
| 12 | Yukoma Hot Springs | 2300 | 1600 | 1650 | 1650 | 1550 | 8750 |
| 13 | Beyond Dreams | 2400 | 1650 | 1650 | 1650 | 1650 | 9000 |
| 14 | Tracen Diner | 2500 | 1750 | 1700 | 1650 | 1650 | 9250 |
| 15 | Japan's next | 2600 | 1750 | 1800 | 1700 | 1650 | 9500 |
<!-- /live -->

### Extra Stats node values

The README's tier-1 values (D338), ×1.25 in tier 2 and ×1.5 in tier 3. Every node totals 40 × the tier multiplier.
The map and capacities are [05](05-training-hub.md)'s.

<!-- live:tier-extra-values -->
| Tier | Single | Duo | Sun | Full active Extra Stats, scenarios 1 · 2 · 3 · 4 · 5 |
|---|---|---|---|---|
| 1 | +40 | +20 / +20 | +8 to all five | 200 · 360 · 440 · 520 · 600 |
| 2 | +50 | +25 / +25 | +10 to all five | 250 · 450 · 550 · 650 · 750 |
| 3 | +60 | +30 / +30 | +12 to all five | 300 · 540 · 660 · 780 · 900 |
<!-- /live -->

- **The full active value** is the scenario's capacity × node total, but scenario 1's layer offers only 5 nodes
  against a capacity of 7, so it counts 5.
- **Whole numbers.** At double strength every node value is a whole number in every tier, so the first draft's
  tier-2 half point is gone.
- **Foundation** (URA Finale) shows tier-1 nodes at +60, +30/+30 and +12 (§8).

### Constellation node values, and the 240 term

Today's formula, with the re-authored tree sizes *N* = 12, 16, 20, 24, 28 ([05](05-training-hub.md)):

```
nodeValue(T) = round((0.60 × capBudget(T) − 240) / N)        today's, D244
```

The 240 was **the Extra pool**: six active Extra stats of 40, kept out of the card budget so that cards plus Extra
total 60% of the cap budget. The rework's Extra Stats are 200–900 points, not 240.

**Decided: the term becomes the scenario's full active Extra Stats, E(*t*, *s*)** from the table above:

```
nodeValue(T) = round((0.60 × capBudget(T) − E(t, s)) / N)
```

Why:
- **It's what the 240 meant**, updated to the new pool.
- **The whole build stays at 60% of the cap budget**, the number every balance target was tuned on: no build reaches
  every cap (D134), the stamina ladder holds, rival fields are set.
- **Keeping 240 would drift.** The full build would grow to 64% of the budget by tier 1's scenario 5 and 67% by tier
  3's, and the drift grows with the tier. The fields, caps and ladder would all need retuning to follow it.
- **Card nodes give up what the Gym adds.** Extra Stats are about a third of all unlocks (37 of 107, D338), and E
  shifts the build's weight toward them as the layers grow.

<!-- live:tier-node-values -->
| T | Scenario | *N* | Per-card cap | Node, 240 term | E | **Node (decided)** | Full build *N* × node + E | 60% of budget |
|---|---|---|---|---|---|---|---|---|
| 1 | URA Finale | 12 | 3 | 280 | 200 | **283** | 3,596 | 3,600 |
| 2 | Unity Cup | 16 | 4 | 219 | 360 | **212** | 3,752 | 3,750 |
| 3 | Trackblazer | 20 | 5 | 183 | 440 | **173** | 3,900 | 3,900 |
| 4 | Our Grand Concert | 24 | 5 | 159 | 520 | **147** | 4,048 | 4,050 |
| 5 | Grand Masters | 28 | 6 | 141 | 600 | **129** | 4,212 | 4,200 |
| 6 | Project L'Arc | 12 | 3 | 343 | 250 | **342** | 4,354 | 4,350 |
| 7 | U.A.F. Ready GO! | 16 | 4 | 266 | 450 | **253** | 4,498 | 4,500 |
| 8 | Great Food Festival | 20 | 5 | 221 | 550 | **205** | 4,650 | 4,650 |
| 9 | Run! Mecha Umamusume | 24 | 5 | 190 | 650 | **173** | 4,802 | 4,800 |
| 10 | The Twinkle Legends | 28 | 6 | 168 | 750 | **150** | 4,950 | 4,950 |
| 11 | Design Your Island | 12 | 3 | 405 | 300 | **400** | 5,100 | 5,100 |
| 12 | Yukoma Hot Springs | 16 | 4 | 313 | 540 | **294** | 5,244 | 5,250 |
| 13 | Beyond Dreams | 20 | 5 | 258 | 660 | **237** | 5,400 | 5,400 |
| 14 | Tracen Diner | 24 | 5 | 221 | 780 | **199** | 5,556 | 5,550 |
| 15 | Japan's next | 28 | 6 | 195 | 900 | **171** | 5,688 | 5,700 |
<!-- /live -->

- **Per-card cap** is `ceil(N / 6) + 1` (D134), and never falls inside a tier, which lets the advance carry every card
  ([03](03-uma-progression.md) §6).
- **Full build** means every node holding a current-era stat card, before growth and buff. A Friend card's nodes pay SP
  instead.
- **Node values fall inside a tier and jump at promotion.** A tier's scenario 1 has the fewest, fattest nodes, so each
  early unlock is a big, legible step ([12](12-economy-and-pacing.md) §5).
- **The SP cap** is in §1. The SP formula is [03](03-uma-progression.md) §8.

### Rival strength

Rivals are today's, unchanged (D336, [03](03-uma-progression.md) §9): **the typical trained Uma** of the scenario,
with today's 84% card factor and Extra Stats at the scenario's capacity, handicapped by today's grade table (G1 at
95%).
- **The ladder keeps its shape.** Today's `trainedStat` runs 650 (scenario 1) to about 925 (14). The new trees keep
  each scenario's budget at 60% of its caps, so the typical Uma stays near that range and extends to the 15th.
  `pnpm sim:careers` re-measures every cell once the buffs' typical values are known.
- **A promoted Uma** meets a field a little above the one she just left, with none of her build. She loses at first
  and wins again as her new layer fills, the reset the owner asked for.

### Expedition difficulty

Each tier's Expedition builds its fields on **the typical trained Uma of the tier's last scenario** (today's
`rivalPreset`), at [10](10-expeditions.md)'s share instead of a grade handicap:

| Tier | Base | Share ([10](10-expeditions.md)) | Compared with a home G1 (95%) |
|---|---|---|---|
| 1 | Grand Masters' typical Uma | **100%** | 5 points harder |
| 2 | The Twinkle Legends' | **103%** | 8 points harder |
| 3 | The 15th's (Tracen Diner's while tier 3 has four scenarios) | **106%** | 11 points harder |

The tier's mechanics, regional fields and local champions come on top, all [10](10-expeditions.md)'s.
`pnpm sim:expeditions` tunes the shares to 10's win-rate targets. This page fixes only the base, so an Uma with her
whole tier built is the Expedition's intended contender.

## 8. Scenario buffs, reviewed

Buffs keep D165's rules:
- one per scenario, always shown on the constellation, deterministic;
- applied in `deriveStats` as a whole percentage on card nodes;
- they may reward which cards and how many nodes, never which node;
- rivals carry each one's typical value.

With one build per tier, the buff changes at each advance, and the Advance sheet shows the new one
([03](03-uma-progression.md) §5).

<!-- live:rework-buffs -->
| T | Scenario | Buff | Rule after the rework |
|---|---|---|---|
| 1 | URA Finale | **Foundation** | Extra Stats nodes pay ×1.5 (single +60, Duo +30/+30, Sun +12) |
| 2 | Unity Cup | **Team Spirit** | Each filled Inspiration slot adds +1% to every card node |
| 3 | Trackblazer | **Climax** | Each career goal won in this scenario adds +2% to every card node, up to +8% |
| 4 | Our Grand Concert | **Performance** | A set with a Speed, Stamina, Power, Guts and Wit card: every card node pays +5% |
| 5 | Grand Masters | **Fragments** | Cards from era 4 or older pay +8% |
| 6 | Project L'Arc | **New Wave** | Cards from era 6 or newer pay +5% |
| 7 | U.A.F. Ready GO! | **Genres** | A card type with two or more cards in the set pays +6% on those cards |
| 8 | Great Food Festival | **Full Course** | A card on its full node cap pays +10% on all its nodes |
| 9 | Run! Mecha Umamusume | **Research** | Speed and Power cards pay +10% |
| 10 | The Twinkle Legends | **Legends** | The first parent slot may hold any Uma in the game, never owned included |
| 11 | Design Your Island | **Construction** | A card on exactly its fair share of nodes pays +8% on all of them |
| 12 | Yukoma Hot Springs | **Soak** | Stamina and Guts cards pay +10% |
| 13 | Beyond Dreams | **Shared Light** | The two lowest stats from card nodes each gain +8% |
| 14 | Tracen Diner | **Orders** | Friend and Group cards also pay a quarter of a node's value as stats, beside their SP |
| 15 | Japan's next | **Encore** | Wit cards pay +10% |
<!-- /live -->

The table is the Training Hub's rules (`REWORK_BUFFS` in `@racer/domain/rework/training`, D344). What the review
changed from today's buffs:
- **Foundation**, wording: Extra Stats are now flat Gym nodes. Its 5 reachable nodes gain +100.
- **Team Spirit** stays +1% a slot, now per filled Inspiration slot (D346). Unity Cup's layer opens the two parents
  and, since D336, the first two grandparents, so a full build there gets +4%, inside the other buffs' 2–5%.
- **Fragments** replaces "cards at 3★ pay +8%", which means nothing without stars.
- **New Wave** is renamed from "Expedition", which collides with World Expeditions. Rule unchanged; in L'Arc's window
  (era ≤ 6) it means its own era.
- **Full Course** is renamed from "Cooking", which would read as a Kitchen rule. Rule unchanged.
- **Legends**, wording: other slots now take any Uma ever owned, so "owned or not" still adds the unowned.
- **Shared Light**, wording: Extra Stats are neither ranked nor lifted, as D314 already did.
- **Encore** is new, a placeholder for the 15th: Wit is the one stat card type no buff favours. Replaced if the real
  scenario's theme suggests a better rule.
- The rest are unchanged: Climax, Genres, Research, Construction and Soak; Performance (the cards are bonded ones); and
  Orders (Friend and Group cards stay, bonded with Grains dishes).

**Fragments in detail.** Grand Masters is tier 1's last scenario, about the pieces gathered along the way:
- **It rewards the cards she has carried through the tier.** A card bonds only in a scenario its era allows
  ([06](06-cards-and-bonds.md)), so every bond from scenarios 1–4 is era 4 or older and pays +8% here. A Grand Masters
  card (era 5) does not.
- **It is a real choice.** In Grand Masters an era-4 card pays 95% × 1.08 ≈ 103%, against 100% for an era-5 card, and
  an era-1 card 80% × 1.08 ≈ 86%. The newest cards' skills against the old bonds' stats.
- **It needs no new save field:** the card's era decides it. A lagging Uma who bonds old cards during Grand Masters
  gets it too.
- **It mirrors New Wave**, the next tier's first buff, which favours the newest cards.
- It is placement-free: moving a card between nodes changes nothing.

**Every typical value is re-measured.** Today's run 0–5.5% of a tree. The layered model changes the typical build
(full layer, every card at 100%, Extra Stats at capacity), and Team Spirit, Fragments and Encore are new rules.
`pnpm sim:careers` computes each one, and rivals carry it. The aim is today's range, about 2–5%. Legends stays at 0,
since it pays aptitudes and skills, not stats.

## 9. What the owner sees at promotion, and the awards

### Before: the Promote sheet

Opened from the Expedition's result, her profile or the Expedition Map ([11](11-hub-and-places.md)):
- **The move:** her portrait with the tier-1 crest, "Tier 1 → Tier 2", "Project L'Arc · Racing Lv 1".
- **Her tier in numbers:** races and wins, G1s, titles earned in the tier, and the Expedition with its eight wins.
- **What resets**, in one short list (§4), and **what carries**.
- **Her work** (§5): "Free", or what she's still doing with Collect, Recall or −30m beside it.
- **The reward:** "+1 Uma Ticket".
- **Buttons:** Promote (enabled once she's free), or Not yet.

### After: the ceremony

1. A full-screen moment: the old crest gives way to the new tier's, with her celebrating chibi and "Promoted to Tier 2".
2. The awards play in order, as today's results reveal does: the promotion badge, then "+1 Uma Ticket". Her
   Expedition title already played with the eighth win ([10](10-expeditions.md)).
3. It lands on her profile, now "T2 · Project L'Arc · Racing Lv 1 · Farm Lv 1", with her new career and its first goal.

Reduced motion shows the same text without the animation. Skip goes straight to the profile.

### New awards

Badges and titles keep today's rules (pure flair, Prestige, scenario-linked, [Badges](../design/badges.md)).
[10](10-expeditions.md) owns the Expedition awards:
- **Expedition titles:** one per Expedition, at completion, with Two-Time and Three-Time for later tiers;
- **Clean Sweep**;
- **the real-sweep series titles**;
- **Around the World**, the Trainer achievement for distinct Expeditions completed.

This page adds the tier awards:

| Award | Kind | Earned |
|---|---|---|
| **Promoted · Tier 2**, **Promoted · Tier 3** | One-off badge, 4 Prestige | Promotion |
| **Hall of Fame** | One-off badge, 16 Prestige, and the title "Hall of Famer" | Completing tier 3's Expedition (§10) |
| **Promotions** | Trainer achievement | Promotions across the stable: 1 / 5 / 15 / 30 / 50 |
| **Hall of Fame** | Trainer achievement | Umas inducted: 1 / 3 / 10 / 25 / 50 |

Existing awards that change meaning:
- **Graduate.** "[Scenario] Graduate" is earned when she leaves a scenario: at the advance, or at promotion for a
  tier's last scenario.
- **Level badges** read the lifetime level ([03](03-uma-progression.md) §2).
- **Living Legend** (every scenario completed) can only be earned through the Hall of Fame.
- **Retired.** Trainer achievements that counted cards owned, stars, coupons or minigame runs retire
  ([13](13-removals-and-plan-changes.md)).

## 10. Tier 3 completion: the Hall of Fame

Completing tier 3's Expedition doesn't promote her anywhere. It **inducts her into the Hall of Fame**. Everything about
her stays: no reset, ever again.

**Induction is automatic.** It happens in the eighth win's commit, and its ceremony plays after that race's results.
Nothing is lost, so there's nothing to confirm, and she needn't be free.

| She… | |
|---|---|
| **Stays maxed** | Tier 3, its last scenario, Racing Level 50 (40 while tier 3 has four scenarios), with her whole build |
| **Keeps racing** | Her last scenario's fields, for Prize Money, badges, titles and trophies; no Racing EXP |
| **Keeps working** | On the Farm and in the Training Hub; any unlock she never finished can still be finished |
| **Pays one Uma Ticket** | Like a promotion, so the account can bring in a new Uma (ledger `promotion-uma-ticket:{umaId}:3`) |
| **Lives in the Hall of Fame** | A Town Hall place ([11](11-hub-and-places.md)): each inductee's portrait, induction date, the three Expeditions she completed, her titles, and her final stats per preset in each tier (from her tier history). Her Stable tile wears a gold frame |
| **Keeps her Expedition runs, and may start others** | Any other Expedition, at tier-3 difficulty, for its title alone, as [10](10-expeditions.md) recommends. Her state isn't cleared, since there's no next tier |
| **Can advance into the 15th** | If she was inducted from Tracen Diner before it shipped (§2) |

The Hall of Fame is the game's endgame for one Uma. The account's endgame is filling it: 25 inductees is
[12](12-economy-and-pacing.md)'s ~66-week mark.

## 11. Edge cases

1. **Promotion with running or queued work.** Promote waits until she's free (§5). The sheet offers Collect, Recall or
   −30m, and a recall returns what the running job or session held. Queued work holds nothing.
2. **Her bonds when she is promoted.** All cleared, along with her presets.
   - Other Umas' bonds to the same cards are untouched: bonds are per Uma.
   - The Card Library keeps the account's record ([06](06-cards-and-bonds.md)).
   - In the new tier she bonds again, with the new tier's Dojo costs.
3. **Promoting the last tier-1 Uma.** Allowed. Tier 1 is then empty, and nothing in the game needs a tier-1 Uma:
   - the Farm and Training Hub serve every tier;
   - Shards from the other tiers keep making Uma Tickets;
   - the account always holds at least the ticket her promotion paid, so tier 1 can be restarted at once.
4. **Promoting the featured Uma** keeps her featured. **Promoting a parent** changes nothing for the Umas whose lineage
   holds her, since slots reference her template.
5. **An Expedition completed with an unfinished build.** Allowed. Her unfinished unlocks simply vanish with the reset,
   and the Promote sheet says how many.
6. **Offline, retries, two devices.**
   - **Offline:** `promote` applies locally, and the API re-runs it on sync.
   - **Retries and a second device:** they get the first receipt. The ticket's ledger id stops a second payment.
   - **Stale sheet:** if her work changed after the sheet opened (a job started or finished on another device), the
     promotion is refused and the sheet redraws with her current work. Promote stays as long as she's free.
7. **The Expedition isn't built yet** (phase 9 late, [13](13-removals-and-plan-changes.md) §4). Umas wait at the
   tier's last gate with racing open. Nothing is lost.
8. **Buying into tier 2 or 3.** Impossible: a ticket always unlocks into tier 1.
9. **The 15th lands mid-tier 3.** §2's table.

## 12. Decided here

| Choice | Why |
|---|---|
| Tier 3 runs scenarios 11–14 until the 15th ships, with its Expedition at the scenario-14 gate | No data moves when the 15th appends; one layer per scenario holds; it likely never runs |
| The 15th's caps 2,600 / 1,750 / 1,800 / 1,700 / 1,650 (9,500), SP cap 5,200 | Today's +250 rotation and +200 SP ladder, continued |
| An Expedition already open stays open when the 15th lands; Hall of Fame Umas may advance into it | Nobody is pushed back or loses a win |
| Eras count only scenarios 1–15; no tier 4 until Japan has 20 scenarios | Every card stays usable; a tier needs five scenarios |
| Promotion is a separate, confirmed action with no deadline; Hall of Fame induction is automatic | A reset is the biggest event for an Uma; induction resets nothing |
| Promotion needs her free: no running or queued job or session, nothing to collect. The sheet offers Collect, Recall or −30m | No job or session spans two tiers; nothing is reserved at promotion, so no inputs need rules ([07](07-farm.md) agrees) |
| An open tier-3 Expedition stays open when the 15th lands, with fields built on the scenario she races as | Nobody is pushed back or loses a win |
| Uma Tickets: 20 at start, Uma Shards (1 per gate, 5 per ticket), 1 per promotion, 1 per Hall of Fame induction; never sold; no roster cap | The owner's normal unlock (D336); tier 1 is the only door; slots are the real limit |
| The node formula's 240 becomes the scenario's full active Extra Stats, E(*t*, *s*), [05](05-training-hub.md)'s extraBudget | Keeps the whole build at 60% of the cap budget, the basis of every balance target |
| Rivals and Expedition fields use today's typical Uma and today's handicaps, unchanged | The owner's rule (D336); a fully trained Uma keeps today's edge at home, and Expeditions sit a step above a home G1 |
| Team Spirit +1% per filled Inspiration slot (D346) | A full Unity Cup build has four slots since D336, so +4% |
| Fragments: cards from era 4 or older pay +8% | Replaces a star rule; a real choice between old bonds and the newest era, with no new save field |
| "Expedition" renamed **New Wave**, "Cooking" renamed **Full Course** | No collision with World Expeditions or the Kitchen |
| The 15th's placeholder buff: **Encore**, Wit cards +10% | The one stat type no buff favours |
| Tier awards: Promoted badges, Hall of Fame (badge and title), two Trainer achievements; the Expedition awards stay [10](10-expeditions.md)'s | [13](13-removals-and-plan-changes.md) asks this page for the tier awards |
| Tier-3 completion is the Hall of Fame: no reset, keeps racing, working and her Expedition runs, may take other Expeditions' titles, pays a ticket | An endgame per Uma that keeps her useful, as [10](10-expeditions.md) recommends |
| Ledger ids: a gate's Shard under today's `uma-gate-shard:{umaId}:{gate}` with her lifetime gate (10 … 150); the Shard exchange is its own operation, one ticket at a time as today; an unlock spends under `unlock-uma:{outfitId}` (D340) | Unique per gate per tier; §6 makes the exchange explicit, which 13 §6's operation list leaves out |
| A promotion's ticket id names the tier she leaves (1 or 2), and the Hall of Fame's names tier 3 (D340) | So a promotion into tier 3 and an induction never share an id |
| Promotion history's stats and SP come from the caller, the Training Hub's derivation (D340) | The tier rules can't derive stats; card sets, bonds and runs they write themselves |
| Shared numbers: a full build's active Extra Stats count 5, 9, 11, 13, 15 (`FULL_ACTIVE_EXTRA_NODES`), which the Extra Stats map and capacity must reproduce; tree sizes and the per-card cap live in one leaf beside the trees (D340) | One owner per number |
| Owners: the Extra Stats capacity fill at the advance ([03](03-uma-progression.md) §6) and §8's reviewed buffs belong to the Training Hub's rules; re-measuring the buffs' typical values for rivals comes with the builds against the field, and until then rivals use today's (D340) | One owner per rule (M033) |
| Rival fields restate today's `rivalPreset` and `rollRivalField` on the new trees, held to today's by parity tests fed today's trained stat; the 15th has no typical buff value yet (D340) | Today's read today's trees; the formula and handicaps are unchanged (D336) |
| A career at T = 15 waits for the catalogue: advancing into the 15th refuses until today's planner knows it (phase 5); the rule from 14 to 15 is in place up to the advance's readiness (D340) | Today's planner knows 14 scenarios |
| Until phase 9 a stand-in Expedition counts races and wins: 8 wins complete a run, an open run keeps counting after the 15th lands, and inducting outside tier 3 refuses with its own reason (D340) | §2 lets an open run finish from scenario 14; promotion needs a trigger before phase 9 |

## 13. Done when

- The domain's scenario table has 14 rows plus the 15th's when master data has it. With 14, tier 3's gate is Racing
  Level 40 and its Expedition opens there. Adding row 15 needs no save change, and an Uma at the 14 gate is offered
  the advance.
- `nodeValue` reads E(*t*, *s*), and a domain test pins §7's node values and per-card caps for all 15 scenarios. For
  each, *N* × node + E is within *N*/2 of 60% of the cap budget.
- The Extra Stats values per tier match §7, Foundation's included, and the tier-2 Duo totals exactly 25.
- Completing an Expedition marks the Uma Ready for promotion. Promote is enabled only while she's free, and the API
  refuses `promote` for a busy Uma.
- `promote` resets exactly §4's left column and keeps the middle and right columns. It writes her tier history with
  every Expedition run's summary, clears her Expedition state, and pays one Uma Ticket once (a retry pays nothing). It
  starts her at the next tier's scenario 1 with a frozen career.
- An Uma Ticket can only unlock an unowned Uma into tier 1, scenario 1. Each scenario gate pays 1 Uma Shard once per Uma per tier, 5 Shards make a ticket, and no Prize Money path makes one.
- The buff table in the domain matches §8 (names, rules, Encore), and every buff stays placement-invariant in tests.
  `pnpm sim:careers` reports each one's typical value, and rivals carry it.
- A tier-3 Expedition success inducts the Uma in the same commit, pays a ticket, never resets her, keeps her
  Expedition runs, and shows her in the Hall of Fame.
- The promotion ceremony plays once per promotion, after the sheet, and skips to the profile on Skip or reduced motion.
