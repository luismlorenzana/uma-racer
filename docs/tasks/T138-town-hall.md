# T138 — Town Hall

**M034 · the place wave: needs T136 and T137; runs beside T139–T142 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md), whose "Fixed choices" bind this task.
- [rework/11](../rework/11-hub-and-places.md) §1–§3.1, §5–§7, §9–§12; [04](../rework/04-tiers-and-promotion.md) §6, §10;
  [03](../rework/03-uma-progression.md) §1–§2, §5–§8, §12; [06](../rework/06-cards-and-bonds.md) §1–§4, §6, §10;
  [08](../rework/08-item-catalogue-and-recipes.md) §8–§10; [09](../rework/09-racing-rewards-and-exchange.md) §5, §6, §8, §9;
  [02](../rework/02-check-ins-and-notifications.md) §3, §6, §9; [13](../rework/13-removals-and-plan-changes.md) §5–§6;
  [Collection](../design/collection.md) "Albums"; [Badges](../design/badges.md) "Displaying flair"; "Paddock".
- The modules it calls: `rework/tiers`, `exchange`, `items`, `training`, `work`, `planner` and `check-in`. T134–T137
  and T142 are specified beside it: use their exports by the M034 table and restate none of them. Today's screens it
  replaces, never edits: `StableScreen`, `UmaProfileScreen`, `UmaSkillsScreen`, `CardsScreen`, `CardPage`,
  `CollectionRevealScreen`, `SettingsScreen`, `farm/ItemInventoryScreen`.

## Goal and fixed scope

The Town Hall page's five places on plain DOM screens, over T136's store and inside T137's shell: the **Stable** (the
roster, Uma Tickets, Shards to tickets, unlocking and the reveal), the **Uma profile**, the **Warehouse** (stock and
selling), the **Exchange** (Speed Tickets and raw ingredients), the **Card Library** (every SSR, bonds per Uma) and
**Account**. Every number and rule comes from the phase-2 modules; a gap is fixed in its module (M034). The plaza
chibi is phase 6, the Needs tab and targets are T142's, the Advance and Promote sheets T141's, sessions T139's.

## Implementation contract

**Where.** `apps/web/src/g2/places/{stable,warehouse,exchange,card-library,account,reveal}/`, each place a lazy Peek,
Page and Counter registered in T137's slots (`g2/places/registry.tsx`). A screen's logic sits in a pure view model
beside it (`model.ts`), taking the rework state, `now` and content, and returning what the screen draws. Every tap
goes through T136's operation action, which runs `recheck` locally and queues the operation; the screen renders its
`done`, `ask` ("Only 3 left now. Start ×3?") or `say` answer with `fill`, and disables the button while it is pending
(02 §9). Nothing here reads or writes `localStorage` except the `uma-racer:g2:` keys named below.

**Routes** (11 §7.1): `/town/stable` (`?tab=owned|locked`), `/town/stable/outfit/:umaId` with `/skills` and `/needs`,
`/town/warehouse`, `/town/exchange`, `/town/account`, `/town/card-library`, `/town/card-library/card/:cardId` and the
full-screen `/collection/reveal/uma/:umaId`. `/town/stable/needs` is T142's.

### The Stable (`stable`)

- **Page.** The shared album chrome (D176) over every outfit in the content: **Owned** and **Locked** tabs with counts,
  a tier filter, the Uma picker's sorts and filters (D181) with the default order lifetime level highest first
  (03 §2), then release newest, then name. A tile shows "T2 · Lv 13" (never the lifetime number), the tier crest, a
  Ready dot when `advanceReadiness` or `promotionReadiness` passes, the planner's target crosshair (read from
  `profile.targets`), NEW, and a gold frame when `hallOfFame` is set (04 §10). A Locked tile is desaturated art behind
  a lock.
- **Uma Tickets and Shards.** A note beside the count reads the tickets in hand and the Shards toward the next ("2 ·
  3/5"); an **Exchange** button shows only when `umaShards ≥ UMA_SHARDS_PER_TICKET` and runs `exchange-shards`, one
  ticket per tap (04 §6).
- **Unlock.** A Locked Uma's sheet offers **Unlock · 1 Uma Ticket** (`unlock-uma`), then the reveal. With no ticket the
  button is off with `no-ticket`'s words and the Shards line. The Locked tab's multi-select unlocks up to the tickets
  in hand, one `unlock-uma` per Uma in order, each with its own operation id, then reveals them in turn.
- **The reveal** (`reveal/`, full screen, 11 §6): today's reveal on the Uma's portrait, "New Uma", her name and outfit,
  "T1 · URA Finale · Racing Lv 1 · Farm Lv 1" (03 §12), and the save's state in 02 §9's words. **Open profile**; with
  more to show (`?then=<id>,<id>`), **Next (2 of 5)** and **Skip all** to the Owned tab. Reduced motion: no flip.
- **Peek:** the featured Uma, "23 Umas · T1 21 · T2 2", Umas ready to advance or promote, Uma Tickets in hand.
  **Counter:** Uma Tickets in hand, hidden at 0. **The featured Uma** (11 §5) is the Peek's first card, also exported
  as `FeaturedUmaCard` for T137's Town Hall page. A tap opens her quick sheet: name, tier crest, scenario, Racing
  Level and what she's doing ("Kitchen · 2 of 4 · 16:40", from her work row's place, `finishedCount` and `endsAt`);
  **Train** (her `/needs`), **Race** (`/racing/racecourse?uma=:id`), **Profile**, **Feature another Uma** (the
  picker, then `feature-uma`).

### The Uma profile (`/town/stable/outfit/:umaId`)

- **Header:** portrait or bust, name, tier crest, "T1 · URA Finale · Racing Lv 1 · Farm Lv 1", Racing and Farm EXP
  bars, what she's doing, and a header slot T142 fills with the target toggle. ‹ › (44 pt) and a swipe move through
  the Stable's filtered order (Collection "Uma album").
- **Overview:** the preset switch (Sprint, Mile, Medium, Long; `set-race-defaults`) and that preset's five stats, SP
  and aptitudes from `deriveUmaPreset`; her build per facility from `layerProgress` ("Observatory 8/12"), each row a
  link to `/training/:facility/:umaId`; a **Collect** chip when her work is Ready (`collect`); her career's stage and
  goals; **Advance** or **Promote** when ready, linking to `/racing/scenario-gate/:umaId` (T141 owns both sheets);
  **Feature her** (`feature-uma`).
- **Needs** (`/needs`): T142's tab. Until it lands the route shows `layerProgress` alone.
- **Skills** (`/skills`): the selected preset's library and loadout from `deriveUmaPreset`, her unique first; equip,
  unequip and order run `set-loadout`; the SP line shows cost against her SP, and `over-sp` reads as its words.
- **Racing:** race defaults (preferred distance, surface, running style; `set-race-defaults`), her career record and
  latest results from the `raceResults` log, her active title, Prestige frame and first 12 showcase pins (Badges
  "Uma profile"), linking to `/racing/trophy-hall/uma/:umaId`.
- **States:** an unknown or locked id shows `unknown-uma`'s words and a link to the Stable.

### The Warehouse (`warehouse`)

- **Page** (07 §10, 09 §6): Raw · Crafted · Dishes · Tickets shelves; family (with destination icons) and grade
  filters. A row: icon, name, grade and destination ("Carrot Salad · Constellation · grade 1", 08 §10), count, then
  **reserved** (`reservedStock`), **coming** (`projectWork(...).coming` by item) and **needed**
  (`neededFromStock(plan(...), item)` over `targetsOf`). Items with all four at 0 are hidden. Empty: "Nothing to sell
  yet: the Farm's first harvest lands here" (09 §8).
- **Stock sheet:** family, grade and destination; the recipes that use it (`recipeOf` over `ITEMS`); **Make more**
  (T140's job sheet link, `/farm/:building?job=:itemId&back=…`); **Sell ×1 / ×10 / Surplus / All free** from
  `stackCounts`, each with `sellPrice` and its total; a size of 0 is off. `sellConfirmations` decides the one question:
  a dish (09 §6.1's sentence at live prices: "…for 698? Each took about 17 hours of work.", hours from
  `workValueSeconds`), needed stock (naming the target and facility from the plan's lines), or 1,000 or more. Then
  `sell` with the shown `unitPrice`; `price-changed` refreshes the sheet. Speed Tickets offer no Sell.
- **Peek:** the three biggest stacks, the planner's three largest shortfalls, "Surplus worth 1,240" (Σ surplus ×
  `sellPrice`). No Counter.

### The Exchange (`exchange`)

- **Page** (09 §5.5): a header with Prize Money, Speed Tickets held and T141's purse bar; **Speed Tickets**: ×1, ×10,
  ×50 or a typed amount, the total, **Buy**; **Raw ingredients**: eight family tabs, one row per grade up to
  `stockedGrade(profile, farmLevelsOf(state))` with icon, `buyPrice`, Warehouse count and the planner's badge
  ("Vegetables G3 · short 6"), a quantity sheet 1–`RAW_PER_PURCHASE`; the next grade shows a lock with `not-stocked`'s
  words. Links: "Sell surplus → Warehouse", "Upgrades are bought at each building".
- **Buy** runs `buy` with the shown price. It is off with `prize-money`'s words ("Need 120 more") when short, and asks
  once when `buyNeedsConfirm`. Deep links T137's account bar and the planner use: `?row=speed-tickets`,
  `?family=:id&grade=:g`.
- **Peek:** Prize Money, Speed Tickets held, the planner's top shortage with its price (`buyFor`).

### The Card Library (`card-library`)

- **Page** (06 §6): the album chrome with search over name, character and skill text; a lens chip row (**All**, then
  one per playable scenario, `scenarioPlayable`); an **Uma** control that sets the lens to her scenario, opening on
  the featured Uma. 06 §6's sorts and filters, *Bondable now* replacing today's quick filters. Tiles keep D238's
  corners; the bottom-right pill shows, with no Uma, the Umas bonded in their current tier (hidden at 0), and with an
  Uma her `bondStatus`: a bond mark, the grade she needs ("G5" on the family's colour, `bondGrade`), or a lock.
- **Card page:** the illustration (4:5, art viewer on tap); type, era ("Era 3 · Trackblazer"), style and distance
  chips; what it pays from `cardPay` (split per stat, `eraPct` in each later scenario of the tier, SP per node for
  Friend and Group, Race Bonus "+4.9% Racing EXP"); skills, golds first, each marked with its node; bond cost per tier
  (`bondDishId` and `sessionSeconds`, dish by name, real time); **Bonded to** (each Uma, her tier and scenario, the
  presets and nodes holding it), then Umas who could bond it now; **Bond** in the thumb zone.
- **Bond** opens the Uma picker over Umas whose `bondStatus` is available: each row shows the dish, its stock and
  the minutes; a busy Uma shows "Busy until 14:20" and **Queue** only where her running session is in that Dojo room;
  the rest are listed below with their reason. Picking one navigates to T139's session URL
  (`/training/dojo?session=:umaId&room=:room&unlocks=bond:<cardId>&back=<card page>`). Back on the card page a pending
  bond reads "In session · bonds 01:30". With no dish: "0 in Warehouse · Cook" links to the Kitchen's job sheet.
- **For T139:** the Library exports `CardLibrary` (`mode: 'browse' | 'pick'`, an Uma and preset, an `eligible`
  filter, `onPick(cardId)`), which T139's card set tab and session sheet mount. **Peek:** the newest cards, bonds
  made this tier (every Uma's in her current tier), cards the featured Uma could bond now.

### Account (`account`, hidden)

Trainer name (read-only, edited in the Trophy Hall); **check-in times**, one to four (`set-check-in-times`, 02 §3);
sync status and **Sync now** (T136's); reduced motion (`uma-racer:g2:reducedMotion`, read by T137's Motion config) and
default race speed (`uma-racer:g2:raceSpeed`, T141's speeds); **App build** and **Content** (today's build stamp and
pack manifest); sign-out; in dev builds only, a dev section that loads the synthetic fixtures into the local store and runs T134's `dev-grant` (items, Prize Money, tickets, a jump to her gate) so the server's copy follows (M034).
`?row=sync` scrolls to sync. Notifications wait for phase 4.

### Domain gaps fixed here (each with its page, test and one decision entry)

| Gap | Fix | Page |
|---|---|---|
| Nothing writes `profile.featuredUmaId` after the first unlock | `featureUma` in `rework/tiers/roster.ts`, registered as `feature-uma` in `OPERATIONS`; owned Umas only | 11 §5, 13 §6 |
| Nothing writes `raceDefaults` | `setRaceDefaults` (selected preset, preferences) in `rework/tiers/roster.ts`, as `set-race-defaults` | 03 §6–§7, 13 §6 |
| No count of reserved inputs | `reservedStock(state, now)` in `rework/work/activity.ts`: inputs of every unmade item of started entries | 07 §10, 09 §6.1 |
| No per-card pay for a screen | `cardPay(card, T)` in `rework/training/derive.ts`: node split, `eraPct`, SP per node, full Race Bonus | 06 §1, §4, §6 |

### Shared pieces

- **`g2/ui/UmaPicker.tsx` is this task's:** D181's one picker, today's `UmaPickerSheet` props (caller sorts,
  `describe`, `disabledReason`, `candidateIds`) on T136's store. `g2/ui/ItemIcon` is T140's, the purse bar T141's;
  whichever task lands first adds a shared piece to its owner's contract.
- **Reused from today** (T143 keeps what `g2/` imports): `ui/album/{AlbumChrome,FilterTray,SortSheet,CompareSheet,
  VirtualGrid,useArt}`, `game/album/query`, `BottomSheet`, `Button`, `Chip`, `Panel`, `SegmentedControl`, `Numeral`,
  `Meter`, `ArtTile`, `ArtViewer`, `UmaBust`, `AtlasSprite`, `Crest`, `TypeIcon`, `CardFocusBadges`, `SkillChips`,
  `SkillIcon`, `PresetBadge`, `ScreenState`, `ui/icons`. **Not reused:** `UmaPickerSheet`, `CardPickerSheet`,
  `game/album/{cards,stable}` and `Stars`, which read today's saves, stars and CL.
- Album preferences (query, saved views, view, seen set) live in `uma-racer:g2:album:<album>`, bounded as `prefs.ts`.

## Tests

View models (`model.test.ts` beside each place), on synthetic state built with the operations and `rework/sim`'s
fixtures:
- Stable: counts, default order, tier filter, "T2 · Lv 13", Ready dots from the readiness functions, when Exchange
  shows; the featured sheet's "what she's doing" for a job, a session and Free.
- Warehouse: a running three-dish Kitchen job and one target give each row's held, reserved, coming and needed; sell
  sizes, each confirmation's words, the Surplus total. Exchange: rows stop at `stockedGrade` with `buyPrice`'s
  prices and the next grade's lock; "Need N more" and the 1,000 question.
- Card Library: a tier-1 scenario-1 Uma and synthetic cards of eras 1–5 give pills from `bondStatus` and `bondGrade`;
  the lens follows her; the card page's bond cost lines for tiers 1–3. Every place's copy passes `BANNED_WORDS`.
- The gaps: `feature-uma` and `set-race-defaults` refuse an unknown Uma and apply once through `runOnce`;
  `reservedStock` equals what `recall` returns; `cardPay` × nodes equals `deriveBuild`'s `cardRaw` for a lone card
  with buffs off, and a Friend card's SP per node is `reworkSpNodeValue` × `eraPct`.

Components (`*.test.tsx`, jsdom with `fake-indexeddb`, T136's store over a synthetic save, a memory router):
- A new account opens the Locked tab with 20 tickets; Unlock leaves 19 and lands on the reveal, then the profile;
  three at once leave 17 and reveal three; at 5 Shards the Exchange button makes one ticket.
- A dish sells only after its question; reserved stock is never offered; a stale price shows "Price changed.".
  Buying 10 Speed Tickets moves Prize Money by 10 × `SPEED_TICKET_PRICE` and the Tickets shelf by 10.
- Bond on a card page navigates to the Dojo session URL with `back`; Feature another Uma changes the featured card.
- After a reload (same `fake-indexeddb`) every change is still there; offline, every action still applies.

## Acceptance

- `pnpm lint && pnpm test:ci && pnpm build` pass; the entry chunk stays ≤ 180 KB gzip (every place is lazy); nothing
  in today's entry imports `g2/`.
- In the `uma-racer-dev` preview at 390×844, on a fresh account (Account's dev fixtures for the later states):
  unlock 20 Umas from the Locked tab, see the reveals and the featured Uma; exchange 5 Shards; open a profile, switch
  preset, equip a skill; sell a crafted item and a dish (with its question); buy Speed Tickets and a raw item; open
  the Library on the featured Uma, filter *Bondable now*, open a card and Bond into the Dojo URL; change a check-in
  time. Each survives a reload.
- Every button and row is at least 44 pt, safe areas hold, animation is transform and opacity only, and reduced motion
  removes the reveal's flip. VoiceOver reads each tile's name, tier, level and state.
- Every disabled button states its reason; no player-facing text holds a banned word.
- The four gaps and the rows below land in their pages with tests and one `docs/decisions.md` entry, and this spec is
  deleted in the pull request that lands it (D104).

## Out of scope

The Town Hall page grid and the account bar (T137); the Needs tab, targets, the roster view and the check-in summary
(T142); the Advance and Promote sheets, the Trophy Hall and the purse bar's rules (T141); sessions, build views and the
card set tab (T139); job sheets (T140); the Hall of Fame place; push notifications (phase 4); the plaza chibi (phase 6).

## Decided here

| Choice | Why |
|---|---|
| In phase 3 the featured Uma is the Stable Peek's first card and `FeaturedUmaCard`, with 11 §5's quick sheet | The plaza chibi is phase 6 (11 §11); her sheet's actions work now |
| The four gaps are fixed in their modules; `feature-uma` and `set-race-defaults` join 13 §6's operation list | Both fields are saved (13 §6, 03 §7) and nothing writes them; a screen restates no rule (M034), and T139–T141 need the queries too |
| The Locked tab's multi-select unlocks up to the tickets in hand, one `unlock-uma` each, reveals in turn with Skip all | A new account picks 20 (13 §5); 20 single unlocks would take about 80 taps |
| Album preferences live in `uma-racer:g2:album:` keys, not the generation-2 database | Device conveniences only (rearchitecture/01 §4.2); today's live in today's Dexie, which the wipe removes |
| The Library's lens chips are All and the playable scenarios (14 until the 15th ships) | 06 §6 names 15; the 15th has no cards yet (06 §2) |
| The Library's per-node pay is before the scenario buff | The buff is her preset's (04 §8) and shows in T139's build views |
| Times on screen are real (× *k*), e.g. "4 h 48 m" | 05 §2: the pages' examples are base minutes, the game multiplies by *k* |
| Account says "App build" and "Content", not "build id" and "content version"; reduced motion and race speed are `uma-racer:g2:` keys | 02 §9 bans "id" and "version" on screen; per-device conveniences are never synced (02 §10) |
| Account shows the trainer's name read-only (edited in the Trophy Hall) and runs `set-check-in-times`; Notifications wait | The name lives in badge state, T141's; 11 §3.1 puts check-in times here; push is phase 4 |
| No Hall of Fame place in phase 3; a gold frame and a profile chip show inductees | 11's registry has none (04 §10 calls it a Town Hall place); no Uma can be inducted for months |
| The profile links to T141's Advance and Promote sheets and hosts T142's Needs tab and target toggle | One owner per sheet; the profile is their door |
| Deep links: Exchange `?row=speed-tickets` and `?family=&grade=`; Account `?row=sync`. Counters hide at 0 | 11 §2.1's chips open "at the row", and the planner's "Buy at the Exchange" needs one; 11 §2.2 keeps the bar quiet |
| The one Uma picker (`g2/ui/UmaPicker`) is this task's; T139 and T140 use it | D181; the Stable owns the album it browses |
