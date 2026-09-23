# UX & Visual Design (mobile first)

Uma Racer is played mostly **on the owner's iPhone, in portrait, as a Home Screen web app**. Every screen is designed
at **390×844 pt** first. Larger screens get more breathing room, not a different app.

Tech constraints and performance budgets are in [Game-like Web Tech](../research/game-web-tech.md).

## Principles

1. **Thumb first.** Primary actions sit in the bottom third. Nothing important needs a stretch to the top corners.
2. **Visual before textual.** Icons, portraits, bars, colors, and motion carry the meaning, and numbers confirm it.
3. **Every tap answers.** Instant press feedback, then a result animation. Waiting states are rare, because the game runs locally.
4. **Big moments feel big.** Level-ups, promotions, limit breaks, coupon reveals, goal completions, and new badges each get a crafted fanfare.
5. **One-handed loops.** Training and racing can repeat with a thumb, without menus in between.
6. **Offline is normal.** No spinners for game actions. Sync status stays a quiet indicator.

## Visual direction

The skin is specified in **[Visual System — "Paddock"](visual-system.md)**: surfaces, colour, type, shape, components,
iconography, art treatment, motion and density. It replaces the earlier "Racecourse Pop" direction (D111), which read as
a children's web game rather than a modern mobile game. This page keeps navigation, the screen inventory and the
feedback catalogue.

## Navigation

```text
┌──────────────────────────────┐
│ ◀ Title        🎫 312  🎟️ 2 │  ← top bar: back (when nested), currencies (tap for details)
│                              │
│         screen content       │
│                              │
├──────────────────────────────┤
│ 🏠   🐴   ( 🏁 )   🃏   🏅   │  ← bottom tab bar: Home · Stable · RACE (raised center) · Cards · Badges
└──────────────────────────────┘
```

- **Bottom tab bar** with 5 destinations. Race is the raised center button.
- **Bottom sheets** (drag to dismiss) for pickers: strategy, card slot, parent picker, filters, confirmations.
- **Full-screen scenes** hide the tab bar: Training, Race, Results, Scenario Start, and reveal fanfares.
- **Swipe back** from the left edge on nested screens, consistent with iOS.
- **Shared-element transitions**: an Uma tile morphs into the profile hero, and a card tile into its detail.

## Screen inventory

### Home (lobby)

- **Featured Uma** portrait, large, with a gentle idle "breathing" motion. Level ring, Training Level bar, active title.
- **Two big CTAs** in the thumb zone: **Train** and **Race**.
- On open, the **daily ticket grant** flies "+50 🎫" into the counter.
- **Goal tracker** card for the featured Uma (3 pips), followed by the implemented **recent flair** card with the latest
  three collapsed visible awards, Prestige, frame, and a Profile link, followed by the implemented compact Stable-wide
  recent-flair feed.
- A swipe on the portrait switches the featured Uma.

The implemented goal tracker handles pending setup, active/completed/missed goals, legacy-untracked saves, final completion,
and missing target content. Each available active target links directly into Race Select.

### Stable

- A complete All/Owned/Unowned grid: owned tiles show portrait, levels, tier, and ready state; unowned outfits use labeled
  silhouettes and open a Select Coupon review. Owned tiles navigate directly to Profile.
- Completion, shard progress, coupon balance, and the explicit five-shard Exchange action sit above filter chips for tier,
  distance, surface, strategy, and ready state. Sorting remains in a sheet.
- Exchange uses a short Motion counter response, with an instant reduced-motion equivalent. Missing content and memory-only
  persistence remain visible rather than silently changing counts.

### Uma Profile

Three zones, top to bottom, ordered by how often each is used (rebuilt 2026-09-21):

1. **Identity** — portrait, name, outfit, Uma Level, Prestige, active title, the featured star, and the three
   highest-tier badges earned.
2. **This scenario** — scenario name and Training Level, one status line, and the actions inline (Constellation,
   Race, Spark Match, Start or Unlock next when they apply); stats metered against this scenario's caps; the card
   set with each card's bond pips and a **Manage · Bond** link; aptitudes; the scenario's goals, each linking to its
   race or its result.
3. **Archive** — collapsed rows for everything browsed rather than used: all badges, scenario history, lineage,
   races run.

Nothing is sticky: an element pinned inside the scrolling shell parks over the content instead of the viewport.

### Scenario Start

Superseded by D121 and D123: an Uma's scenario run starts with one confirmation, with no parent snapshots or
inheritance picks. Lineage is set on the constellation's parent nodes instead.

### Training scene

A full-screen scene with one header — the Uma, scenario crest and TL — and a live stat strip whose deltas read
against the moment the scene opened. Two tabs sit under it (M016):

- **Constellation** — the tree, the node sheet, and **Raise Training Level** (Spark Match). A card node's sheet
  shows each card's bond and what one node of it pays, with a **Bond** link beside it.
- **Card set** — the active scenario's six slots. Each shows the card, its type, its bond pips in this scenario,
  what one node pays (SP per node for a Friend or Group card, marked **Skill points**), how many nodes it fills, and
  a **Bond** button. Tapping a card offers Open card, **Replace** (the new card takes over its nodes), and Remove.
  Edits save as they are made, like the constellation; empty slots open the album picker, and **Fill empty slots**
  tops the set up without touching what is already there.

Every Bond Recall run launched here returns here.

### Race Select

- A list of **race cards**: grade ribbon, name, venue, distance and surface, and the selected Uma's aptitude letters (color-coded).
- **Goal races are pinned** with a 🎯 ribbon. Filter chips: grade, distance, surface, goals only.
- Tap → Pre-race.

Multiple goals for one target share one race card with ordered ribbons. A direct Home/Journey goal link selects that exact
race when available; missing/retired targets remain explicit instead of silently substituting another race.

### Pre-race

- **Field preview**: a row of NPC icons.
- **Form matchup meter**: "You 92% ⟷ Field 86%".
- **Strategy** segmented control, with aptitude letters. **Loadout** summary chip (tap to edit in a sheet).
- Every active goal at stake is shown with its exact win rule, including the 5-length Challenge threshold.
- A big **Start** button at the bottom.

### Race (PixiJS scene)

Portrait layout. The track runs horizontally, lanes are stacked vertically, and the camera follows the pack:

```text
┌──────────────────────────────┐
│ Japan Cup · 2400m   ▶ 1× 2×⏭ │
│ ━━ MIDDLE LEG ━━  812m left  │  ← phase banner and distance
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│  ⑦→    ③→                    │
│      ①→   ⑫→   (YOU ⑤)→      │  ← lanes; icons drift and overtake
│   ⑨→      ⑭→                 │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ●●●●○●●●●●●◉●●●   progress   │  ← whole-field progress rail
│ HP ▰▰▰▰▰▱▱  3rd   "Makes her move!" │
└──────────────────────────────┘
```

- **Parallax** rails and distance markers. Dust particles at speed.
- **Start gate**: field card → staged gates → Ready → Go before simulation time begins. Reduced motion shows a short text-only equivalent.
- **Skill activations**: one serialized name/effect card; player events win collisions and simultaneous rivals are grouped.
- **Last spurt**: speed lines and a slight transform-only zoom. Music remains a later polish task.
- **Finish**: Nose/Head margins get a brief renderer-only slowdown and photo-finish hold. Skip reveals the identical result.
- Landscape is allowed on this screen only, for a wider view.

### Results

1. The placement number **stamps** in ("1st!", with confetti if a win).
2. The finishing order slides in, with margins.
3. The Uma EXP bar fills. On a level-up: burst, the ticket reward moves in, and before→after player/field Race Form updates.
4. Activated player skills are grouped by id with counts and recovery/speed/acceleration labels; missing content falls back to the id.
5. Committed goal ids unfurl as serialized Goal Ribbons, followed by updated pips and Honors. The implemented T016 flow then serializes persisted
   flair in this order: goal-derived badge events, ordinary badge tiers/one-offs, first G1 trophy, race-set/repeat title,
   and Trainer achievements. Multiple newly crossed tiers for one definition collapse visually to the highest one while
   detail retains every stage. Skip/reduced motion reveals the same facts immediately; reload shows “Earned in this race”
   summaries from stored event ids without replaying them as new.
6. CTAs: **Races** · **Train** · **Race again**. Until the atomic save succeeds only Retry save is available; Race again
   becomes Promote first at a scenario gate.

### Cards

- **Album**: a lens chip row — Collection, then each reached scenario — over the shared album chrome
  ([Collection](collection.md#card-album)). In a scenario, tiles carry bond pips and the reserved detail area has a
  **Bond** button, so a bond is one tap from the tab.
- **Card page** (`/cards/:id`): the card and how to own it (tickets or a coupon), **Bond by scenario** with a Bond
  button per reached scenario, then what it pays — its split, a Bond 0–Max per-node ladder (in SP for a Friend or Group card), Race
  Bonus and its skills in node order — and every set it sits in.
- **Unlock** hands to the full-screen collection reveal, which returns to the card's page.
- A bond is raised only in Bond Recall, which always returns where it was launched: the album lens, the card page,
  or the Training scene.

### Badges

The big Badge page (see [Badges — Badge page](badges.md#badge-page)), built mobile-first:

- A scope switch at the top (**Uma / Stable / Trainer**) and a search field. All three scopes are implemented.
- Uma scope keeps the chosen owned Uma in the URL. Stable is a live per-Uma aggregation; Trainer is persisted account
  achievements/records, never a duplicate copy of Stable awards.
- **Filter sheet** with typed tag groups, removable chips, deterministic sorting, and up to 20 named saved views per scope.
- A windowed grid of badge tiles. Hidden unearned definitions do not leak names/text; locked visible definitions are
  silhouettes, and exact/since-tracking/untracked provenance is always explicit.
- Tapping a tile opens a detail sheet with criterion, tier ladder, progress/provenance, dates, Prestige contribution, and
  race/Journey/migration links. Uma scope also has a G1 trophy wall and paged flair timeline.
- **Pin mode** enables multi-select and ordered showcase groups. Pointer drag is optional enhancement; ≥44 pt Move up/down
  and group controls provide the complete accessible/iPhone fallback. The Profile flattens groups and shows the first 12.
- Active-title selection lives here. The first earned title becomes active only when none is selected; later titles never
  silently replace the player's choice.
- Tiles use generated semantic glyphs plus tier shape, color, and text. Bespoke art, sound, and haptics stay in Milestone 7.

### Settings

- Sound effects and music volume, haptics (shown only if supported), reduced motion, default race speed.
- Sync status and "sync now". Sign-out.
- **Dev mode** (hidden behind a long-press on the version): fps overlay, grant resources, set levels, skip day, WebGPU toggle.

## Feedback catalog

| Moment | Motion | Sound | Particles | Haptic (if available) |
|---|---|---|---|---|
| Any button press | Squash and spring | Soft tick | — | Light |
| Training resolve | Gains fly to bars, bar fill | Rising "ding" per stat | Small sparkle | Light |
| Friendship training | Rainbow sweep | Chord | Rainbow sparkles | Medium |
| Skill hint | Chip pop and slide | Bell | — | Light |
| Training Level up | Badge burst, cap markers slide | Jingle | Star burst | Medium |
| Race start | Gate snap, camera push | Gate clank, crowd | Dust | Medium |
| Win | Placement stamp | Fanfare | Confetti | Success pattern |
| Uma Level up | Ring fill and burst | Level jingle | Stars | Medium |
| Goal completed | Ribbon unfurl | Big fanfare | Gold confetti | Success pattern |
| Badge or title earned | Shine sweep and flip-in | Sparkle | Tier-colored sparkles | Light |
| Limit break / promotion | Lift, glow, ignite | Power-up | Glow burst | Heavy |
| Coupon reveal | Flip with anticipation shake | Drumroll → reveal | Burst | Heavy |

Haptics are progressive enhancement only (see research). Motion plus sound must stand on their own.

## Accessibility and comfort

- Tap targets are at least **44×44 pt**. Nothing critical lives in the top corners.
- Tiers use **shape and label in addition to color**.
- `prefers-reduced-motion`: no shake or parallax, shortened fanfares, instant counters.
- Sound defaults on but respects the silent switch where the platform does. Everything is also shown visually.
- Numbers use tabular figures, so counters don't jitter.
