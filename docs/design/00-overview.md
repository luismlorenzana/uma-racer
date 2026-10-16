# Overview

> **As built: generation 2 (the rework, D326–D360; the switch, T143), with the canvas Hub (T145, D363).** The
> vision, the pillars, the loop and how Uma Racer differs from the original game. The rules live in the manual,
> [docs/game/](../game/README.md). Its README holds the game in one paragraph, the two ways to play, the shared numbers
> and the glossary; this page doesn't repeat them.

## Vision

A pocket-sized Uma Musume racing game where **every Uma is a long-term companion and the stable is a collection**. Each
Uma climbs a **tier** of five scenarios, in the order they were released. While the owner is busy, the roster works a
Farm and a Training Hub on timers. When there's time, the owner races. Every race pays, every dish cooked becomes a
piece of an Uma's build, and every win leaves a mark on her and on the account.

## Design pillars

1. **Races are the payoff, and never blocked.** Any Uma can race at any time, whatever else she's doing (D328). Races
   can be lost: rivals follow the grade handicap, and difficulty assumes a fully trained Uma (D336).
2. **The roster works while you're away.** Farm jobs and Training Hub sessions run on timers, closed and offline time
   included. A check-in takes under a minute: Collect all, Repeat, and a glance at what each Uma still needs.
3. **Every unlock is one piece of her build.** One dish pays for one session unlock: a constellation node, an
   Inspiration slot or skill, an Extra Stats node or a card bond. It lasts the whole tier (D326, D328). Nothing is
   random.
4. **History unfolds in order.** Scenarios are eras, played in release order, and a card joins a set from its own
   era's scenario on.
5. **Collect everything, and show it.** Umas, bonds, badges, titles, trophies and Trainer achievements all show their
   completion. Flair stays with an Uma through promotion.
6. **Soft limits, never walls.** Nothing expires, and a day away costs time, not progress. There's no energy and no
   ticket to train. A long day of racing tapers its Prize Money through the Daily Purse instead of stopping the races.

## The core loop: Race, Farm, Train

```text
Farm sites ──▶ Pantry ──▶ Kitchen ──▶ Training Hub session ──▶ unlock (lasts the tier) ──▶ race
  gather        craft       cook       Observatory · Lineage Hall                            │
    ▲                                  Gym · Dojo                                            │
    └───── Speed Tickets ◀── Exchange ◀── Prize Money ◀──────────────────────────────────────┘
```

- **Farm.** Any free Uma gathers at one of eight family sites, crafts at the Pantry or cooks at the Kitchen. Farm work
  raises her **Farm Level**, 1–50 per tier, which opens higher grades ([07](../game/07-farm.md)).
- **Train.** A dish is the price of one unlock in a **Training Hub session**, and only the Uma it's for can sit it
  ([05](../game/05-training-hub.md); bonds in [06](../game/06-cards-and-bonds.md)).
- **Race.** Races pay **Racing EXP** toward her **Racing Level**, 1–50 per tier, and **Prize Money**. The **Exchange**
  turns Prize Money into **Speed Tickets**, each 30 minutes off a running job or session, and raw ingredients. So a free
  evening of racing speeds up everything passive ([09](../game/09-racing-rewards-and-exchange.md)).
- **Advance.** Winning a scenario's career goals (a G3, two G2s, then three G1s) lets her advance to the next scenario,
  whose layer asks for higher-grade dishes ([03](../game/03-uma-progression.md)).
- **Promote.** A tier ends in a **World Expedition**: eight distinct wins abroad. Completing it promotes her to the next
  tier, where everything on her starts over while the account's Warehouse, Prize Money, titles and buildings carry
  ([04](../game/04-tiers-and-promotion.md)). **Expeditions are phase 9 and not built yet**
  ([10](../rework/10-expeditions.md)). Until then the Expedition Map shows each Uma's distance to entry.
- **New Umas** cost an **Uma Ticket**. A new account starts with 20; after that every scenario gate an Uma reaches pays
  an Uma Shard, and five Shards make a ticket ([04](../game/04-tiers-and-promotion.md) §6).

The loop step by step, the activity rule and a week of play are [01](../game/01-game-loop.md). Check-ins and the
planner are [02](../game/02-check-ins-and-notifications.md), and pacing (a roster of 25, about four weeks a scenario) is
[12](../game/12-economy-and-pacing.md). It all happens on the Hub's four pages: Town Hall, Training, Racing and Farm,
each a pixel-art town map (uma-rpg's Hub, on uma-art) with the game's own DOM skin over it
([11](../game/11-hub-and-places.md), [UX](ux.md), [Visual System](visual-system.md)).

## How this differs from the original game

| Original game | Uma Racer |
|---|---|
| A career run makes a one-off trained Uma | Each Uma is permanent and climbs **tiers of five scenarios**, with a **Racing Level** and a **Farm Level** of 1–50 in each tier |
| Training is limited by career turns, with heavy RNG | Training is **timed Training Hub sessions paid with cooked dishes**. Each unlocks one known piece of the build, and her stats, aptitudes and SP are derived from those pieces |
| Scenarios are separate career modes | Scenarios are **steps inside a tier**, in release order. A tier ends in a World Expedition and a promotion |
| Daily energy meters limit play | **Nothing limits racing.** The Daily Purse tapers a long day's Prize Money instead ([09](../game/09-racing-rewards-and-exchange.md) §3) |
| R, SR and SSR support cards, limit-broken by duplicates | **SSR cards only, every one open at full value** (D329). A card is **bonded** to one Uma at the Dojo before it joins her set |
| Gacha for Umas and cards | **No gacha.** Umas cost Uma Tickets earned by progress (D336); a card costs only its bond |
| Skill points are spent during a career | **SP is derived** from her build, and she fine-tunes a skill loadout within it |
| Sparks are inherited from a finished career | The **Lineage Hall** unlocks parents and grandparents (any Uma ever owned) and their unique and gold skills |
| Career goals are mandatory, and failing ends the run | **A career per scenario** holds her Racing Level until each stage is won. A lost goal race costs only the race: goals are retried, never failed |
| Mostly flat difficulty inside a career | **The grade handicap:** rivals are a trained Uma made weaker by the race's grade, most at G3 and least at G1, so a G1 is the real test |
| No idle play | **A passive Farm** and timed sessions run while the app is closed. Check-ins collect and restart them |
| Epithets and titles are a side feature | **Badges, titles, trophies and collection are core** ([Badges](badges.md)) |
