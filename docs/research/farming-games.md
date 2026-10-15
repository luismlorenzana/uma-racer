# Farming game research

> **Revised by D234 (2026-10-01).** After real use, the owner asked for a farm that runs for years: Farming Levels with
> no cap that also shorten growth time (12h → 8h), a scenario row every ten levels, and plots without end in Sections of
> six, each costing more Farm Level than the last. The six-plot cap, the Lv20 cap, the Farm Level crop gate and the
> "no speed multiplier" rejection below are superseded. The Stable Farm itself was deleted with the cutover (T143); the
> game's Farm is now [07 · Farm](../game/07-farm.md). The rest of the research (offline clock, outfit identity, global
> inventory) still stands.

Research for the planned Stable Farm (`design/farm.md`, deleted with the cutover): a global, asynchronous account activity where owned Uma
outfits work a field that grows from one to six plots, gain farming levels of their own, and harvest produce into the
account's Item inventory. Reviewed
2026-09-29.

The question is not which farming game to copy whole. It is which proven pieces make a self-contained phone farm feel
clear and worth revisiting without turning Uma Racer into a second life simulator.

## Best references

| Game | Useful pattern | Take for Uma Racer | Leave behind |
|---|---|---|---|
| **Uma Musume — Great Food Festival** | Five produce identities line up with the five training stats, and produce has an obvious downstream training use. | Five stat families, always shown with the stat glyph and name. Farming should visibly feed the Uma-building loop. | Its turn economy, dishes, source values and art. Original-game rows and images remain private content and never enter git. |
| **Farm Together 2** | Crops mature in real time while the game is closed; harvesting grants resources and progression. Long timers are presented as a reason to return later, not a requirement to leave the game running. | Persist `plantedAt`/`readyAt`, calculate growth after reload, and award the worker's Farming XP only when the player harvests. | A huge editable farm, money, seasons, watering, tractors and item mastery. Uma Racer needs six meaningful assignments, not land management. |
| **Stardew Valley** | Farming skill advances from successful harvests, and its increasing XP curve makes later levels a longer project. | Harvest-only Farming XP and a rising level curve. Starting a crop, opening the app, or waiting with a ready crop earns nothing twice. | Tool energy, professions and daily chores. Uma Racer gives each owned outfit its own level and derives one Farm Level from all of them. |
| **Palia** | Gardening levels introduce new seed varieties in a readable ladder, so a level changes what the player can grow. | Outfit and aggregate Farm levels gate scenario crop rows. Locked crops say which requirement they need instead of disappearing. | Soil adjacency, fertilizer, seed crafting, crop-quality variants and sale value. They obscure the progression choices this feature needs. |
| **Story of Seasons** | The field communicates a strong empty → planted → growing → ready rhythm, harvested goods enter a general item bag, and helpers/sprites make farming feel inhabited. | One unmistakable state per plot, a standing chibi worker, and harvest straight into the global Item inventory. | Watering twice a day, weather, wilting, stamina, fertilizer and quality. Missing a check-in must never damage progress. |
| **Hay Day** | Farm helpers keep working toward a named product target and expose queue/storage state clearly. | An assigned Uma and crop remain frozen for the cycle, and a ready plot waits safely for collection. | Paid helper time, helper-only storage and automatic production queues. The owner asked for global inventory and explicit cycles. |

### Sources

- [GameTora — Great Food Festival](https://gametora.com/umamusume/great-food-festival) documents the five-produce,
  five-stat identity. It is a research reference only; no extracted rows or images are copied into the repository.
- [Farm Together 2 — Harvestable items](https://store.steampowered.com/news/posts/?enddate=1708693793&feed=steam_community_announcements)
  describes real-time growth while the game is closed and harvest rewards including resources and progression.
- [Stardew Valley Wiki — Skills](https://wiki.stardewvalley.net/Skills) documents harvest-earned Farming XP and its
  rising level thresholds.
- [Palia patch 0.180](https://palia.com/news/patch-180) shows a Gardening-level crop reward ladder.
- [Story of Seasons: Grand Bazaar — Farm Life](https://www.storyofseasons.com/grandbazaar/manuals/ps5/01/) documents
  the plot lifecycle, crop collection and Nature Sprite levels.
- [Story of Seasons: Pioneers of Olive Town — Build Your Farm](https://www.storyofseasons.com/PoOT/buildyourfarm/)
  connects planting, harvesting, inventory variety and Earth Sprite specialties.
- [Supercell Support — Rose and Ernest](https://support.supercell.com/hay-day/de/articles/farm-helpers-rose-ernest.html)
  documents helpers working toward explicit stock targets and keeping a separate queue/storage area; the latter is a
  useful counterexample for Uma Racer.

## What the comparison says

### 1. The clock should create anticipation, not chores

The strongest fit is Farm Together 2's offline clock. A cycle has one decision at the start and one satisfying action
at the end. There is no watering window, weather penalty, withering or background notification requirement. The crop
is ready when `now >= readyAt` and waits forever until harvested.

A uniform **12-hour cycle** is preferable to a catalog of optimized timers for the first release:

- it naturally supports morning/evening play;
- every stat has the same production rate;
- crop choice is about the scenario build, not timer math;
- worker progression can be expressed in days without assuming perfect minute-level collection.

Different durations, repeat planting and notifications can be evaluated after real use. They are not needed to prove
the loop.

### 2. Outfit farmers build the Farm together

Most references level the player, the farm or the crop. The requested identity is stronger: the assigned Uma becomes a
better farmer, while the collection develops the field. Farming Level therefore belongs to the **outfit**, independent
of Uma Level, Training Level, cards, scenarios and races. Different outfits of one character remain different farmers.
Harvesting is the only XP event. The level unlocks crop rows and does not also add speed or yield, avoiding a
rich-get-richer worker who crowds every other outfit out of the plots.

The aggregate Farm Level counts only levels earned after each outfit's free level 1. That avoids ownership itself
inflating the Farm while making later unlocks impossible to reach with one favorite alone. New plots create more
parallelism, which makes more outfits useful, which raises the Farm faster: the progression is its own positive loop.

### 3. Start with one plot; make the six-plot field the progression

Six plot positions are recommended for release, but only one begins open:

- a 2 × 3 field remains legible at 390 × 844 with a worker, crop, timer and 44 pt action on every plot;
- visible locked soil gives Farm Level an immediate, spatial reward instead of another abstract number;
- each unlocked plot adds one persistent outfit worker and more parallel progression, while no unassigned outfit advances
  passively;
- twelve harvests a day at perfect cadence is a meaningful but bounded source of produce;
- the number is familiar elsewhere in Uma Racer without tying the farm to a deck or lineage mechanically.

The first balance target opens the second plot around day 2 and the sixth around day 28 under ideal twice-daily play that
spreads work across outfits. A farm simulator, not intuition, owns those envelopes. Expansion beyond six would change
both pacing and phone layout and stays later.

### 4. Five stat families should stay visible, but crops should change with the scenario

The Great Food Festival proves that one produce identity per stat reads immediately. Uma Racer extends that idea into
fourteen scenario rows: every scenario has one Speed, Stamina, Power, Guts and Wit crop. Aggregate Farm Level opens a row
for the account and the assigned outfit's Farming Level determines whether she can grow it. This produces **70 ordinary
fruit and vegetable item definitions** without copying an original dataset.

The interface does not depend on 70 bespoke pictures. It reuses the existing stat glyph and colour, adds the crop name,
and may use a small original code-native produce drawing. Assigned workers reuse the private standing-chibi atlas already
loaded by the collection screens. Original-game crop icons are neither required nor checked into git.

### 5. Global inventory must be the one destination

Hay Day's helper warehouse is exactly what not to copy. A harvest writes one stack in the account Item inventory; there
is no farm bag to empty and no capacity limit. The inventory is a general system so later rewards can add other item
categories, but the first catalog contains produce only.

The future constellation bridge consumes produce from that inventory. It is deliberately a later delivery unit: the Farm
can establish its own loop and durable stock before changing the current constellation/save contract.

## Recommended first-release loop

1. Open **Farm** from Home directly onto the saved field. There is no entry-time Uma picker.
2. On the first visit, assign one owned outfit to the one open plot. That assignment persists after harvest and reload.
3. Choose one crop row both the Farm and that outfit permit; filter by stat and destination scenario.
4. Confirm. The plot freezes outfit, crop, `plantedAt` and `readyAt` for twelve hours.
5. Close the app. No process needs to run and no state is written as the clock advances.
6. Return after the deadline and harvest. One item enters global inventory; the outfit earns 12 Farming XP; any outfit
   level raises aggregate Farm Level and may open a plot or crop row.
7. The plot returns to Idle with the same outfit. Pick the next crop, explicitly Plant again, change her from the plot's
   picker, or browse the Farm's Workers, Crops and Items menus.

## Explicit rejections for v1

- no Training Ticket, seed, coin or stamina cost;
- no `MinigameHost`, run journal, random seed, win/loss or score;
- no watering, fertilizer, soil quality, weather, seasons, pests, crop failure or withering;
- no random yield, critical harvest or Farming-Level speed/yield multiplier;
- no farm-only storage, storage cap, selling, crafting or cooking;
- no expansion beyond six plots, decoration, free placement or land editing;
- no auto-repeat, queue, push notification or background task;
- no race, badge, card, Uma Level or Training Level reward;
- no original-game data or assets in checked-in fixtures.

These are not missing farming-game features. They are scope that would weaken the requested loop: build a crew of outfit
farmers, grow the field and crop catalog together, choose future stats, and return to a farm that remembers its workers.
