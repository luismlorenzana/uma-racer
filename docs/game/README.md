# The Uma Racer manual

What the game **is**. It's the reference for any session, Claude's or another agent's. Every page describes the code
as it runs: generation 2, the game since the phase-3 cutover (M034, D361). Plans, specs and history live elsewhere (see
the end).

> **Started 2026-10-14 (D337), with the re-architecture's phase 1.** The rework's pages moved in as built with the
> cutover (T143): 01–09, 11 and 12 below. Each page is rewritten as the code changes, in the same commit, so it always
> describes what runs.

## The game in one paragraph

Uma Racer is a **racing game with a passive Farm**. Each Uma climbs a **tier** of five scenarios. In each scenario she
races her career (Racing Level), while the roster works the Farm on timers (Farm Level). The Farm grows ingredients,
the Pantry crafts them and the Kitchen cooks them into dishes. A dish is the entry ticket to a **Training Hub
session**, which unlocks one piece of an Uma's build:
- a constellation node;
- an Inspiration slot, inherited unique or gold skill;
- an Extra Stats node;
- a bond with one support card.

Races pay **Prize Money**, which the Exchange turns into **Speed Tickets** (timer skips) and other goods. So a free
evening spent racing speeds up everything passive. A tier ends with a **World Expedition**: an international racing
campaign. An Uma who completes it is **promoted** to the next tier, where she starts over against a harder world. The
Expeditions are phase 9's and not built yet ([rework/10](../rework/10-expeditions.md)); until then an Uma who finishes
her tier's last career waits at its gate with racing open.

```
             ┌──────────────────────── Prize Money · Exchange · Speed Tickets ◀──────────────────────┐
             ▼                                                                                        │
Farm: ingredients ──▶ Pantry: crafted ──▶ Kitchen: dishes ──▶ Training Hub sessions ──▶ unlocks ──▶ Racing
 (Farm Level 1–50)                                            (Observatory, Lineage Hall, Gym, Dojo)  (Racing Level 1–50)
                                                                                                        │
                                       scenario 1 → 2 → 3 → 4 → 5 → World Expedition → promotion ◀─────┘
```

## Two ways to play, one game

The owner plays in two modes, and the game serves both:

- **Busy days: check-ins on a timer.** Two or three short visits a day, each under a minute:
  1. **Collect all.**
  2. **Repeat** to restart every job and session.
  3. Glance at what each Uma still needs.

  Push notifications, a port of uma-rpg's, are phase 4 and only if the owner asks
  ([02](02-check-ins-and-notifications.md) §7).
- **Free time: lots of racing.** Racing is never blocked by training or Farm work. Every race pays Prize Money, and
  Prize Money buys Speed Tickets, so a long racing session moves the whole roster forward ([09](09-racing-rewards-and-exchange.md)).

## Topics

| Page | Find there |
|---|---|
| [Architecture](architecture.md) | The repo, the domain's areas and exports, the web app, the save and sync v2, the routes, the API, private content, the race engine, budgets, deploy and every dependency |
| [01 · Game loop](01-game-loop.md) | The loop step by step, one Uma's scenario, the roster in rotation, activity rules, a week of play in both modes |
| [02 · Check-ins and notifications](02-check-ins-and-notifications.md) | Collect all, Repeat, queues, the check-in summary, the "what she still needs" planner, offline time, retries and plain words; push (phase 4) |
| [03 · Uma progression](03-uma-progression.md) | Racing Level 1–50, scenarios inside a tier, career goals, advancing a scenario, one build per tier, what an Uma is made of |
| [04 · Tiers and promotion](04-tiers-and-promotion.md) | Three tiers of five scenarios, what resets and what carries, Uma Tickets, promotion, tier scaling, the 15th scenario, the buffs |
| [05 · Training Hub](05-training-hub.md) | Observatory, Lineage Hall, Gym and Dojo: sessions, slots, layers per scenario, constellation sizes, Inspiration and Extra Stats maps |
| [06 · Cards and bonds](06-cards-and-bonds.md) | Every SSR open from the start, no stars, bonding a card to an Uma, era and bond cost, card sets and presets, card focus, the Card Library |
| [07 · Farm](07-farm.md) | Sites, Pantry and Kitchen; Farm Level 1–50; jobs, queues and Repeat; slots and building upgrades; worker rules |
| [08 · Item catalogue and recipes](08-item-catalogue-and-recipes.md) | uma-rpg's farming half reused: 8 families × 10 grades, crafted items, every dish recipe, destinations, art ids |
| [09 · Racing rewards and the Exchange](09-racing-rewards-and-exchange.md) | Racing EXP, Prize Money, the Daily Purse, featured races, the Exchange, Speed Tickets, selling surplus |
| [11 · Hub and places](11-hub-and-places.md) | Town Hall, Training, Racing and Farm pages; every place; routes and redirects; art reused from uma-art and new drawings |
| [12 · Economy and pacing](12-economy-and-pacing.md) | Currencies, sources and sinks, the 25-Uma pacing target, the time model, the loop simulation |
| [Racing](racing.md) | The race itself: the engine, what a finish pays in EXP, grade handicaps and how rivals are rolled |
| [Scenarios](scenarios.md) | The fifteen scenarios in three tiers, and which page owns each scenario rule |

The numbers jump from 09 to 11 on purpose: page 10, World Expeditions, is phase 9's and stays in
[docs/rework/](../rework/README.md) until it is built.

Looking for one thing? Search this folder first (`rg -n "handicap" docs/game`). Each page names the code it describes.

## Not built yet

The manual describes what runs, so a later phase's part is marked where it sits:
- **A section about a later phase** stays in its page under a heading **"Not built yet (phase N)"**, so links into the
  page keep working. Today: [02](02-check-ins-and-notifications.md) §7, push notifications (phase 4);
  [04](04-tiers-and-promotion.md) §10's Hall of Fame place (phase 6); [11](11-hub-and-places.md) §11's place scenes
  (phase 7). §10.3's new drawings are uma-platform's (A01, A02), drawn as placeholders until they ship (§10.4).
- **A sentence or row** about a later phase says so in place: "(phase 4, not built)".
- **A whole system of a later phase** keeps its page outside the manual: World Expeditions,
  [rework/10](../rework/10-expeditions.md) (phase 9).
- When a phase builds one, the section loses its heading (or the page moves in) in the same commit as the code.

**"Today's" in the moved pages.** Pages 01–12 were written before the cutover. Where they say "today's" or "as
today", they mean the game before generation 2 (the `pre-split` tag); a rule kept "as today" is that rule, still in
force.

## How these pages stay true

- **Lists are generated from the code.** Each table between `<!-- live:<key> -->` and `<!-- /live -->` is rendered
  from the rules by `packages/domain/src/docs/render.ts`, which joins each area's `docs.ts`
  ([the rework modules](architecture.md#the-rework-modules)).
- **CI catches a stale page.** `packages/domain/src/docs/docs.test.ts` fails when a page here, or the plan's operations
  list in [rework/13](../rework/13-removals-and-plan-changes.md) §6, no longer matches the code, so a rule change can't
  ship with a stale manual.
- **After a rule change, run `pnpm docs:update`.** It rewrites every live block. Commit the result with the change.
- **Hand-written parts are edited by hand,** in the same commit as the code they describe. A new list that can be
  generated gets a key in `render.ts` (or its area's `docs.ts`) rather than a hand-typed table.
- **Original-game content stays out.** Only code-owned rules are rendered: no Uma, card, skill or race data from the
  private content packs.

## Shared numbers

Every page uses these. The time model and how they were sized are in [12](12-economy-and-pacing.md); the live blocks
on each page are the rules' own numbers.

### Structure

| Thing | Value |
|---|---|
| Tiers | 3 |
| Scenarios per tier | 5: tier 1 = scenarios 1–5, tier 2 = 6–10, tier 3 = 11–15 (the 15th is Japan's next, [04](04-tiers-and-promotion.md)) |
| Racing Level | 1–50 per tier; scenario *s* of the tier covers levels 10(*s*−1)+1 … 10*s* |
| Racing EXP | 1,800 a scenario (180 a level on average), from races, as before the rework |
| Career goals per scenario | G3 (Maiden), two G2s (Trials), three G1s (Main), with the level holds kept from before the rework |
| Farm Level | 1–50 per tier, from Farm work only; grade *g* opens at Farm Lv 5*g* − 4 (1, 6, 11 … 46) |
| Farm EXP | 1 per minute of Farm work (gathering, crafting, cooking) × her aptitude for that family (S ×1.8, A ×1.6, B ×1.2, C ×1, D ×0.9, E–G ×0.8). Level *L* → *L*+1 costs 480 + 5(*L*−1). Working without a break that's **2–3 levels a day, 4–5 at high aptitude**, as uma-rpg landed on |
| Roster | 20 Uma Tickets at the start. Then the normal unlock: every scenario gate an Uma reaches pays 1 Uma Shard, 5 Shards make 1 Uma Ticket, and a promotion pays 1. Tickets unlock Umas into tier 1 only. Target roster 25 |

### Grades follow scenarios

A tier has 10 grades and 5 scenarios, so **scenario *s* of a tier uses grades 2*s*−1 and 2*s***: roughly its first
half at grade 2*s*−1 and its second half at grade 2*s*. That's a rule of the layers, not of Farm Level. Farm Levels
come fast, and every grade is open within about a month of a tier ([07](07-farm.md) §4).

### The eight families and where their dishes go

uma-art's Duo dishes join neighbouring families on a fixed ring, so the five stats take five neighbours. Then
every stat-to-stat Duo already has art.

| Family (uma-art id) | Farm site (uma-art building) | Dish goes to | Aptitude that speeds its Farm Level |
|---|---|---|---|
| Sweets (`sweets`) | Sugar Grove (`sugar-grove`) | **Speed**: Gym room, Speed card bonds | Sprint |
| Fruits (`fruits`) | Orchard (`orchard`) | **Stamina**: Gym room, Stamina card bonds | Long |
| Fish (`fish`) | Fishery (`fishery`) | **Power**: Gym room, Power card bonds | Mile |
| Nuts & Seeds (`nuts-seeds`) | Nut Grove (`nut-grove`) | **Guts**: Gym room, Guts card bonds | End Closer |
| Herbs & Spices (`herbs-spices`) | Herb Garden (`herb-garden`) | **Wit**: Gym room, Wit card bonds | Medium |
| Grains (`grains`) | Fields (`fields`) | **Skill**: Friend and Group card bonds | Pace Chaser |
| Vegetables (`vegetables`) | Vegetable Garden (`vegetable-garden`) | **Constellation**: Observatory node unlocks | Front Runner |
| Mushrooms (`mushrooms`) | Mushroom Cave (`mushroom-cave`) | **Inspiration**: Lineage Hall slots, uniques and gold skills | Late Surger |

Ring order (uma-art's Duos): Grains – Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts & Seeds –
Grains. The stat neighbours are Stamina–Wit, Wit–Power, Power–Speed and Speed–Guts. That gives **4 stat Duos**;
Guts–Stamina has no Duo.

### Unlocks per scenario layer (per Uma, per tier)

<!-- live:training-layers -->
| Scenario of the tier | Constellation nodes | Inspiration | Extra Stats nodes | Card bonds | Total |
|---|---|---|---|---|---|
| 1 | 12 (tree of 12) | 2 parent slots, 2 parent uniques | 5 singles | 6 | **27** |
| 2 | 4 (tree of 16) | 4 parent golds, 2 grandparent slots | 5 singles + 4 Duos + 1 Sun | 3 | **23** |
| 3 | 4 (tree of 20) | 2 grandparent slots, 2 grandparent uniques | 5 singles + 4 Duos + 1 Sun | 3 | **21** |
| 4 | 4 (tree of 24) | 2 grandparent uniques, 4 grandparent golds | 5 singles + 1 Sun | 3 | **19** |
| 5 | 4 (tree of 28) | 4 grandparent golds | 5 singles + 1 Sun | 3 | **17** |
| **Tier** | **28** | **24** (6 slots, 6 uniques, 12 golds) | **37** (25 + 8 + 4) | **18** | **107** |
<!-- /live -->

- **Constellation trees are re-authored** to 12, 16, 20, 24 and 28 card nodes for a tier's scenarios 1–5. Each
  scenario keeps its silhouette motif.
- **Extra Stats map per tier (D338):**
  - a single node per stat and scenario, at the scenario's first grade (5 × 5: grades 1, 3, 5, 7, 9);
  - Duos at grades 3 and 5 (4 × 2);
  - a Sun node from each Feast at grades 4, 6, 8 and 10.
- **Active Extra Stats capacity** is 7, 9, 11, 13 and 15 nodes in scenarios 1–5. Scenario 1 has only 5 Extra
  Stats nodes, so all of them are on.
- **Node values at tier 1:** single +40, Duo +20/+20, Sun +8 to all five stats, so every node pays 40. Tier 2
  multiplies them by 1.25 and tier 3 by 1.5.

### Time model

Every duration is a base formula below **× the time factor *k* = 1.2** (D338). The domain holds *k* as one constant
(`TIME_FACTOR` in `state/time.ts`), and pages that quote minutes quote the base formula.

| Step | Base minutes for grade *g* | Grade 1 | Grade 10 |
|---|---|---|---|
| Gather one raw ingredient | 90 + 5(*g*−1) | 90 | 135 |
| Craft one (Pantry) | a quarter of gathering | 22.5 | 33.75 |
| Cook one dish (Kitchen) | 240 + 10(*g*−1) | 240 | 330 |
| One Training Hub session (one unlock) | 180 + 15(*g*−1) | 180 | 315 |
| A planet dish's inputs | 4 crafted of its family at *g*, 1 crafted side of another family at max(1, *g*−2) | | |

One unlock is about 20 Uma-hours at grade 1 and 30 at grade 10 at *k* = 1.2: its dish chain plus its session. With
25 Umas each working 75% of the day, every scenario takes the roster **27–30 days** ([12](12-economy-and-pacing.md) §5).

### Money

| Thing | Value |
|---|---|
| Prize Money anchor | 1 Prize Money ≈ 1 minute of Uma work |
| Speed Ticket | 30 Prize Money; takes 30 minutes off one running job or session |
| Prize for a win | Debut/Maiden 60 · Pre-OP 80 · OP 100 · G3 150 · G2 200 · G1 300; 2nd pays 40%, 3rd 20% ([09](09-racing-rewards-and-exchange.md) §2) |
| Selling | A third of an item's work value in Prize Money |

## Glossary

| Term | Meaning |
|---|---|
| **Tier** | Five scenarios and an Expedition. Each Uma is in exactly one tier |
| **Scenario layer** | What a scenario adds to an Uma's build: nodes, slots, Extra Stats and bonds to unlock |
| **Session** | Timed unlocks at one Training Hub facility for one Uma: 1–10 of them one after another, each paid for with one dish |
| **Job** | One timed Farm task: gather, craft or cook 1–10 items one after another |
| **Bond** | A card unlocked for one Uma, for the rest of her tier |
| **Racing Level / Farm Level** | An Uma's two levels inside a tier, each 1–50 |
| **Promotion** | Completing the tier's World Expedition; the Uma moves to the next tier and starts over |
| **Prize Money** | What races pay; spent at the Exchange |
| **Speed Ticket** | 30 minutes off one running job or session |
| **Generation 2** | The save and the game since the cutover (M034): every account started over once, with 20 Uma Tickets |

## Elsewhere

| Where | What it is |
|---|---|
| `docs/decisions.md` | The decision log (D-numbers): why things are the way they are |
| [`docs/rework/`](../rework/README.md) | What stays of the game rework's design: World Expeditions (phase 9) and the plan that took the game here (13), with an index into this manual |
| [`docs/rearchitecture/`](../rearchitecture/README.md) | The rebuild on uma-platform (D321–D325) and its phases (08) |
| [`docs/design/`](../design/00-overview.md) | The overview, UX, the visual system, racing design, badges, careers, skills and lineage |
| `docs/technical/` | Infrastructure values, the release runbook and the GCP setup guide |
| `docs/research/` | Race mechanics, engine findings, UI and web-tech references, and World Expeditions' race pools |
| [`docs/tasks/`](../tasks/README.md) | Work that is planned or in progress |
| `AGENTS.md`, `CLAUDE.md` | How to work in this repo |
