# Collection

Collection is a **core pillar**, alongside racing. There are three collections, each with visible
completion: **Umas**, **SSR support cards**, and **badges and achievements**.

> Progression/economy numbers remain tuning values unless pinned elsewhere. Milestone 6 freezes the Trainer-achievement
> thresholds below as catalog-v1 rules; later changes require a catalog migration, decision entry, and pinning test.

## Starting the game

| What | Starter set |
|---|---|
| Cards | Every SSR card that was **free or an event reward** in the original game (`obtain: event/free`): **94 of the 312 SSRs** ✅ |
| Umas | **The full original launch roster: all 25 trainees** ✅ (see below) |
| Coupons | **3 Card Select Coupons** to start, so the tier-1 deck isn't thin if few free cards come from era 1 |

Starter cards from later eras are **owned from day one** but stay era-locked for equipping until an Uma reaches that era.
They show where the collection is heading.

### Starter Umas: the launch roster ✅

Every trainee from the original game's February 2021 launch, in their launch outfits (25 total):

| Original launch rarity | Umas |
|---|---|
| 3★ (9) | Special Week · Silence Suzuka · Tokai Teio · Maruzensky · Oguri Cap · Taiki Shuttle · Mejiro McQueen · Symboli Rudolf · Rice Shower |
| 2★ (8) | Gold Ship · Vodka · Daiwa Scarlet · Grass Wonder · El Condor Pasa · Air Groove · Mayano Top Gun · Super Creek |
| 1★ (8) | Mejiro Ryan · Agnes Tachyon · Winning Ticket · Sakura Bakushin O · Haru Urara · Matikanefukukitaru · Nice Nature · King Halo |

✅ Verified against the original data on 2026-09-19: exactly 25 outfits carry the 2021-02-24 launch date, so T.M. Opera O was not among them.

Notes:

- **Star rarity doesn't exist in Uma Racer.** Every Uma uses her **5★ base stats** from the original game ✅, so 1★ launch Umas
  aren't permanently weaker. Race Form nerfs apply on top in races.
- The roster covers every surface, distance, and strategy: Sprint (Bakushin O), Dirt (Urara), Long (McQueen, Rice Shower), and more.
  The badge lines can all be pursued from day one.
- Since no Uma has completed a scenario at the start, everyone trains **without parents** at first.
- Uma Select Coupons then unlock everyone released after launch.

## Unlocking cards

A card is unlocked on its own page (`/cards/:id`) in one of two ways (D130):

| Way | Cost | Notes |
|---|---|---|
| **Tickets** | `25 + 5 × era`: 30 for a URA Finale-era card, 95 for the newest | Ledger reason `card-unlock`, keyed by card id |
| **Card Select Coupon** | 1 coupon | A free unlock; keyed by card id as before |

Unlocking hands straight to the collection reveal, then back to the card's page. The standalone Card Select screen
is gone; `/cards/redeem` redirects to the album.

## Coupons and shards

| Item | How it's earned | Redeems for | Rules |
|---|---|---|---|
| 🎟️ **Card Select Coupon** | A card first reaches **max bond** in any scenario (once per card ever) | A free unlock of any unowned SSR card | Stackable · never expires |
| 💎 **Uma Shard** | Any Uma **reaches** level 10, 20, 30 … (once per Uma per gate) | 5 shards make 1 Uma Select Coupon | Stackable · never expires |
| 🎟️ **Uma Select Coupon** | 5 Uma Shards | Any unowned Uma in the game | Stackable · never expires |

- **The two paths are separate** ✅: bonding **cards** earns **Card** Select Coupons (more cards), and leveling **Umas** earns Uma Shards and then **Uma** Select Coupons (more Umas). Tickets can also buy cards outright.
- A Card Select Coupon picks any unowned card, and an Uma Select Coupon picks any unowned Uma, including later eras. Era gating only controls equipping cards, not owning them.
- Newly obtained Umas start at level 1, tier 1.

The implemented exchange is an explicit local-first action: five shard units and one coupon unit are separate append-only
ledger rows. Card and Uma redemptions are keyed by target id, so a retry after a committed acquisition reconstructs the
owned result without spending again. An entity that predates the matching redemption row is simply already owned.

### Pacing

- **One Uma** taken from level 1 to 50 earns 5 shards, which is **1 Uma coupon**. Taking her to 100 earns a second.
- **Across the stable**, it's 1 Uma coupon per 50 levels gained by all Umas combined, so leveling several Umas pays off too.
- **Cards** compound: a card's first max bond funds the next one, and tickets buy the rest. Every unowned card together
  costs about 12,000 tickets; URA Finale's 37 unowned cards about 1,100.

## Albums

267 Uma outfits and 312 cards is a lot to walk through on a phone, and collection is a core pillar, so browsing gets the
same care as the game systems. Both albums share one chrome, one filter engine, and one set of habits. The look is
specified in [Visual System](visual-system.md); the patterns below follow the faceted-tray research in
[Game UI Reference](../research/game-ui-reference.md).

### Shared browsing chrome

```text
┌──────────────────────────────┐
│ Stable            25 / 267   │  ← title + completion
│ [ All | Owned | Unowned ]    │  ← segmented primary split, always visible
│ 🔍 search   ⇅ Sort   ⚙ Filter•3│  ← sticky bar (search expands in place)
│ ‹ Turf ×  Long ×  A+ ×  ⌫ ›  │  ← active-filter chips, horizontally scrollable
│ 48 results                   │
│ ▓▓▓  ▓▓▓                     │  ← results grid (art-first tiles)
└──────────────────────────────┘
```

- The **sticky bar** stays pinned while the grid scrolls: search, a Sort button showing the current key and direction,
  and a Filter button badged with the number of active facets.
- **Sort and Filter are different controls** and look different. Sort opens a short menu with a direction toggle; Filter
  opens a bottom-sheet tray.
- **Every active filter is a chip** outside the tray, removable with one tap, with a clear-all at the end. The result
  count sits directly above the grid.
- The tray groups facets into collapsible sections, each option showing the **count it would return**. An option that
  would return zero is disabled and labelled, never a dead end. The tray has Clear all and Apply, and shows the pending
  result count on the Apply button.
- **Saved views** (up to 20 per album) store a filter set, sort, and density under a name, reusing the Badge page's
  saved-view behaviour. "Reset to default" is always one tap away.
- **Density toggle:** Comfortable (2-up) or Compact (3-up), remembered per device.
- **Grouping** is optional and off by default: group by era, tier, or type inserts sticky headers with per-group counts
  that collapse.
- Long lists stay cheap through browser-native `content-visibility`: off-screen rows skip layout and paint, and scroll
  position restores natively because nothing unmounts.
- Filter, sort, density, grouping and search terms persist per album on the device, and survive reload.

### Default sorts

Defaults are opinionated, so the album is useful before anyone touches a control:

| Album | Default order |
|---|---|
| **Stable (Umas)** | Owned before unowned → **release date, newest first** → **Uma level, highest first** → name |
| **Cards** | Owned before unowned → **era/release, newest first** → **card level, highest first** → name |

The ownership split is a segmented control rather than a hidden filter, because "what do I have" is the question the
album answers most often. Switching to Unowned keeps the rest of the sort intact.

### Layout: dense grid, reserved detail

The real game browses hundreds of entries by making tiles **small and image-only**, five to a row, with a **reserved
area at the top** that shows the selected entry large, with its details. We follow that:

```text
┌──────────────────────────────┐
│  [ large art ]  Name         │  ← reserved detail area: selected entry
│                 Level · caps │     large art, identity, key numbers
│                 aptitudes    │
├──────────────────────────────┤
│ [ All | Owned | Unowned ]    │
│ 🔍  ⇅ Sort   ⚙ Filter•3   ▦  │  ← sticky chrome, with the view switch
│ ▣▣▣▣▣  ▣▣▣▣▣  ▣▣▣▣▣          │  ← 5-up icon grid, art only
└──────────────────────────────┘
```

- Selecting a tile **fills the detail area** rather than opening a sheet, so browsing never leaves the grid. A second tap
  (or the detail area's own action) opens the full screen or sheet.
- The detail area is what the big art is for; the grid stays icon-sized so a phone screen holds twenty entries at once.

### View modes

The density toggle becomes a **view switch**, remembered per album like every other preference:

| Mode | Tile | For |
|---|---|---|
| **Icons** | 5-up, art only, tiny state dots | Scanning a whole collection |
| **Cards** | 2-up art with name and the sort's value | Browsing with context |
| **List** | Full-width rows: art thumb, name, and several data columns | Comparing numbers |

### Art tiers

Three sizes, each used where it belongs:

| Tier | Size | Source | Use |
|---|---|---|---|
| Icon | 128 px, atlased | Loaded with the content packs | Every grid tile |
| Uma portrait | 512 px, transparent | One file per Uma, fetched on demand | Detail area, Home hero, reveals |
| Card art | 450×600 full illustration | One file per card, fetched on demand | Detail area, reveals |

Art is **never atlased and never precached**: 26 MB across 562 files would defeat both. Each file is content-addressed,
fetched through the authenticated API on first use, verified against its manifest hash, and cached by the service worker.
The icon shows immediately and the large art replaces it when it arrives, so nothing ever waits on a download. Entries
whose source art does not exist — 18 of the newest cards today — keep their icon, with no error and no empty frame.

### What every tile has to answer

A collection is browsed to **decide** something — who to train next, which card to slot — so a tile carries decision
data, not just a name:

- Uma tiles: portrait, name, level, active-scenario crest, a compact aptitude line (surface / distance / strategy
  grades), and at most two state chips (*Gate ready*, *Goal active*).
- Card tiles: card art, type dot, LB pips, and the card's **node share** — what one node of it pays.
- The **secondary line follows the active sort**. Sorting by release shows the date, by total stats shows the total, by
  limit break shows the LB. Sorting by something you cannot see is a dead end.
- Unowned entries are desaturated art behind a lock, never empty silhouette boxes.
- **NEW markers:** an entry acquired since you last looked at it carries a NEW treatment until it is opened. The seen
  set is device-local, like the other album preferences, so this needs no save field.

### Icon overlays

The icons view is five-up and image-only, so the two things worth knowing at a glance are burned onto the icon
itself rather than pushed into a caption:

- **Scenario crest, top-left.** The Uma's **active scenario** — the highest she has unlocked (D121). Each
  scenario has its own crest drawn from the original game's scenario art, imported like the other private
  assets and atlased at icon size. An Uma who has not started a scenario shows no crest.
- **Level, bottom-right.** Her permanent **Uma Level**, in the embossed numeral treatment, over a scrim so it
  stays readable against bright art.

Both sit inside the tile's padding so they never cover the face. They are the only overlays: state chips,
names, and sort values belong to the cards and list views, where there is room for them.

### Shared behaviours

- **Quick filter presets** sit as a one-tap row above the grid — *Trainable now*, *Ready to promote*, *Maxed*,
  *Equippable at my tier*, *Unowned* — distinct from saved views, which are yours to name.
- **Compare** through multi-select: two or three Umas side by side on stats and aptitudes, or cards on their effect
  values at the current level and at the next limit break. This is what makes three hundred entries usable.
- **Long-press quick actions** on a tile: Train · Race · Set featured · Deck for an Uma; Limit break · Where equipped
  for a card. No round trip through the detail screen for a one-tap job.
- **Empty states name the way out**: "No results — remove *Dirt* to see 12".
- Group headers carry completion counts that link to the matching badge, so *[Era] Complete* is one tap from the group
  it describes.
- A sort that takes a parameter ("best aptitude for…") exposes its parameter as a chip beside the sort control.

### Uma album (Stable)

| Sorts | Filters |
|---|---|
| Release date · Uma level · name · scenario tier · Training Level · total stats · prestige · badges earned · recently raced · best aptitude for a chosen surface/distance | Ownership · tier · surface aptitude · distance aptitude · strategy aptitude · minimum aptitude grade · real-horse sex · level range · launch-roster (starter) · has parent snapshot · active Journey state · holds a title · has unspent shards toward her next gate · ready to train (deck valid and tickets available) |

**Outfits versus characters.** The catalogue is 267 outfits across 134 characters, so the album offers two modes:

- **By outfit** (default): every outfit is its own tile, as today.
- **By character:** one tile per character showing her best-owned outfit with a `×N` count, expanding to her outfits.
  Ownership then means "owned in any outfit", which is the question a Uma Select Coupon actually asks.

Tapping a tile opens her profile, and **swiping** left/right there moves through the filtered order, so a filtered album
becomes a browsing session. The shard and coupon strip stays above the chrome, since redemption is the album's other job.

### Card album

The Cards tab is seen through a **lens** (D131), chosen from a chip row at the top: **Collection**, or one chip per
scenario any Uma has reached. It opens on the featured Uma's active scenario and remembers the lens in the URL.

| Lens | Holds | Sorts | Filters | A tile shows |
|---|---|---|---|---|
| **Collection** | all 312 cards | era/release (default) · type · character · card name | ownership · type · era · in an active set · starter/free · new | art; unowned dimmed with its ticket price |
| **A scenario** | only cards its era allows | bond (default) · pays per node · era · type · character · card name | ownership · type · bond 0–Max · can still bond · max bond · in a set here · era · new | art with that scenario's bond pips and per-node pay |

Ties break owned first, then by per-node pay. The two lenses keep separate saved queries and views, since bond means
nothing in the collection.

- The reserved detail area above the grid acts on the lens: in a scenario it shows the card's bond there and a
  **Bond** button straight into Bond Recall (returning to the same lens); an unowned card shows **Unlock** with its
  price. **Open** goes to the card's page.
- Compare shows type, era, how one node splits, bond and per-node pay in the lens scenario, skill count and price.
- **The card set picker uses this album**, on the scenario lens of the set being filled, owned cards only, sorted by
  bond; it must not keep a weaker parallel picker.
- Hint skills are searchable text, so "Corner Recovery" finds every card that pays it.

### What the save cannot answer yet

`UmaSave` and `CardSave` carry no timestamps, and ledger rows record resource, delta, reason and time but never which
Uma or card they belong to. So **"recently trained" and "recently used" are not sortable** and are deliberately absent.
"Recently raced" works, because race history stores per-Uma rows with times. Adding the other two means adding fields
and a migration, which is not worth a sort (D114).

Both albums join private content templates to entity-presence ownership. Orphaned saves are reported as a diagnostic but
never inflate completion counts. Card selection (coupon redemption) reuses the same chrome with ownership forced to
Unowned, and a successful selection commits before opening the read-only reveal route.

## Trainer achievements (account-wide)

These use the same tier ladder as badges: Bronze → Silver → Gold → Platinum → Rainbow. They are pure flair and pay no
currency. T018 implements the exact catalog-v1 thresholds below from authoritative collection entities, ledgers, per-Uma
badge state, and race/Journey facts.

### Collection

| Achievement | Criterion | B / S / G / P / R |
|---|---|---|
| Stable Master | Umas owned (25 at start) | 30 / 40 / 60 / 90 / all |
| Card Collector | SSR cards owned | 10 / 25 / 50 / 100 / all |
| Maxed Out | Cards at LB4 and level 25 | 1 / 5 / 15 / 40 / 100 |
| [Era] Complete | Own every card of that era | one-off per era |
| [Type] Complete | Own every card of that type | one-off per type |
| Coupon Clipper | Coupons redeemed | 1 / 5 / 15 / 40 / 100 |

### Stable totals (aggregates of per-Uma data)

| Achievement | Criterion | B / S / G / P / R |
|---|---|---|
| Stable Wins | Races won by all Umas | 10 / 100 / 500 / 1,500 / 5,000 |
| Stable G1s | G1 wins by all Umas | 1 / 10 / 50 / 150 / 500 |
| Stat Badges | Stat badge tiers earned by all Umas | 5 / 25 / 75 / 200 / 500 |
| Badge Hoarder | Total badge tiers earned by all Umas | 25 / 150 / 500 / 1,500 / 5,000 |
| Title Holders | Distinct titles held across the stable | 1 / 5 / 10 / 20 / all |
| Graduations | Scenarios completed by all Umas | 5 / 25 / 75 / 200 / 500 |
| Veteran Stable | Umas at level 50 or higher | 1 / 3 / 10 / 25 / 50 |
| Legendary Stable | Umas at max level | 1 / 3 / 5 / 10 / 25 |
| Heirs | Inheritance events run with at least 1 parent | 5 / 25 / 100 / 250 / 1,000 |
| Stable Goals | Scenario goals completed by all Umas | 5 / 25 / 100 / 300 / 1,000 |
| Honors Collector | Scenario Honors earned by all Umas | 1 / 10 / 30 / 100 / 300 |
| Family Tree | Distinct Umas that have served as a parent | 2 / 5 / 10 / 25 / 50 |

Counting rules are exact:

- `all` freezes the applicable private-catalog denominator and catalog version when earned; later content never revokes it.
- Coupon Clipper counts successful Card/Uma coupon redemption ledger rows, not shard exchanges or coupon grants.
- Stat Badges counts earned stat/balanced badge stages. Badge Hoarder counts all per-Uma badge stages, one-offs, Goal
  Ribbons, and Honors, excluding titles and trophies.
- Title Holders counts distinct title keys across the Stable. Its `all` denominator freezes the eight enabled race-set
  titles plus the Two-Time and Three-Time title for every retained G1 family in that private catalog version.
- Heirs counts completed Scenario Starts with one or two direct parents. Family Tree counts distinct Umas with at least one
  evidenced direct-parent use. Stable Goals/Honors count only tracked T014 facts, never legacy-untracked tiers.
- Orphaned saves are visible diagnostics but do not inflate current-content collection denominators.

### Records

Single-value bests, shown on the trainer profile:

- Highest single stat ever reached, and which Uma reached it.
- Most wins, G1s, and badges by a single Uma.
- Biggest winning margin, and the longest win streak.

## Trainer profile

- Trainer display name (stored with badge preferences, default `Trainer`) and **showcase**: unlimited ordered pinned Umas
  plus grouped earned achievements/per-Uma flair, managed on the [Badge page](badges.md#badge-page).
- Collection meters: Umas x/y, cards x/y, maxed cards x/y, badges earned.
- Records panel.

## Engine notes

- Trainer achievements are **computed from the same collection, ledger, badge-state, Journey, and race facts** as per-Uma
  flair. T018 maintains atomic incremental aggregates and also reconciles them deterministically at content-ready boot.
- Trainer state is a separate versioned `badges/trainer` entity. Stable scope remains a live aggregation and is not copied
  into another award collection.
- T017 initializes that trainer entity as a preference-only shell; T018 upgrades it through authoritative reconciliation
  from current entities and append-only logs. New devices adopt it through the ordinary badge-entity sync path.
- Every earned tier has one append-only Trainer flair event. Bootstrap collapses retroactive presentation into one archive
  summary rather than replaying a wall of fanfare.
- Coupons and shards go through the same **ledger** as tickets (see [Economy](economy.md)).
