# UX & Visual Design (mobile first)

Uma Racer is played mostly **on the owner's iPhone, in portrait, as a Home Screen web app**. Every screen is designed
at **390×844 pt** first. Larger screens get more breathing room, not a different app.

Tech constraints and performance budgets are in [Game-like Web Tech](../research/game-web-tech.md).

## Principles

1. **Thumb first.** Primary actions sit in the bottom third. Nothing important needs a stretch to the top corners.
2. **Visual before textual.** Icons, portraits, bars, colors, and motion carry the meaning, and numbers confirm it.
3. **Every tap answers.** Instant press feedback, then a result animation. Waiting states are rare, because the game runs locally.
4. **Big moments feel big.** Level-ups, promotions, stars earned, coupon reveals, goal completions, and new badges each get a crafted fanfare.
5. **One-handed loops.** Training and racing can repeat with a thumb, without menus in between.
6. **Offline is normal.** No spinners for game actions. Sync status stays a quiet indicator, except when it is
   failing: a **⚠ Sync** chip in the top bar (red on an error, amber when changes have waited over a day) links to
   Settings, which shows the error and when this device last synced (D157). A save that cannot open says why, offers
   **Try again** and **Copy details**, and never offers to clear anything.

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
- **Bottom sheets** (drag to dismiss) for pickers: strategy, card slot, the Uma picker (D181), filters, confirmations.
- **Full-screen scenes** hide the tab bar: Training, Race, Results, Scenario Start, and reveal fanfares.
- **Swipe back** from the left edge on nested screens, consistent with iOS.
- **Shared-element transitions**: an Uma tile morphs into the profile hero, and a card tile into its detail.

## Screen inventory

### Home (lobby)

- **Featured Uma** portrait, large, with a gentle idle "breathing" motion. Level ring, Training Level bar, active title.
- **Two big CTAs** in the thumb zone: **Train** and **Race**.
- On open, the **daily ticket grant** flies "+15 🎫" into the counter.
- **Career** card for the featured Uma (a pip per goal race, her stage, and her next goal race under the Race button), followed by the implemented **recent flair** card with the latest
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
2. **This scenario** — once she has more than one scenario, a **scenario switch** (one chip per unlocked scenario
   with its TL, her career marked) picks which trained unit the zone shows and uses (D190). Then scenario name and
   Training Level, one status line, and the actions inline (Constellation, Race, Spark Match, Start or Unlock next
   when they apply; an earlier scenario has no Start or Unlock); stats metered against this scenario's caps; the card
   set with each card's stars and a **Manage · Bond** link; aptitudes; the scenario's goals, each linking to its
   race or its result. The Training scene, Skills page and Spark Match follow the same choice.
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
- **Card set** — the chosen scenario's six slots. Each shows the card, its type, its stars in this scenario,
  what one node pays (SP per node for a Friend or Group card, marked **Skill points**), how many nodes it fills, and
  a **Bond** button. Tapping a card offers Open card, **Replace** (the new card takes over its nodes), and Remove.
  Edits save as they are made, like the constellation; empty slots open the album picker, and **Fill empty slots**
  tops the set up without touching what is already there.

Every card-minigame run launched here returns here.

### Spark Match — Rival Circuit

A no-scroll, portrait full-screen scene under `/minigames/spark-match/:umaId`. The tab bar is hidden. At 390 × 844 its
zones are, top to bottom:

1. **Run HUD:** Leave/pause, scenario, wave `1/3`, trainee Drive and Spark gauges. Leaving preserves the run for resume;
   v1 has no manual forfeit or reroll.
2. **Rival stage:** the encountered Uma's whole standing Chibi in a clear strategy-coloured ring, with icon/silhouette
   fallback, name and strategy glyph, Resolve, countdown and a plain-language next-intent card. A phase or Guard status
   stays beside the gauge instead of appearing only as a toast.
3. **Puzzle board:** a square-celled 6 × 5 PixiJS board. Each kind keeps Spark Match's whole-Chibi tile face inside its
   strong colour ring and faint tint, plus a glyph/mark; the held orb draws above the finger, its origin remains marked,
   displaced orbs visibly slide, and a radial movement clock appears only after the first cell transition.
4. **Thumb zone:** Spark Shift when charged, an always-available **Matchups** control for the text advantage legend, and
   no critical control in an iOS gesture corner. The bottom uses `pb-safe`.

Before the first charged run, a full illustrated guide opens once and never charges a ticket. It reuses Friendship
Training's page-at-a-time/swipe model and teaches: the three-wave circuit; drag-through swapping and its seven-second
movement clock; matches/cascades; the complete strategy ring; Spark/Recovery; visible enemy intent and turn bound; and
saved Training EXP/node progress. The unpaid start screen retains **How to play**, and the live run's help control opens
the page relevant to its current state. The paid start screen names the three-wave structure, current TL/EXP, possible
opened-node count, and **Begin · 1 ticket**.

During resolution the path is no longer editable. Matches outline before clearing; attack trails use both strategy colour
and glyph; Recovery travels to Drive; Spark travels to its gauge; the rival reacts only after engine-produced damage.
Cascades are labelled in one stable counter. Reduced motion shortens travel to fades and scale changes but keeps match,
damage, recovery and intent order legible.

The renderer uses fixed pools of 30 board sprites, 24 particle effects and 8 combat labels. The development overlay shows
FPS/frame time, live/pool counts, action count, engine hash, content source and pause state without private ids. One polite
DOM live region announces a whole resolved turn and the next intent; it never narrates the dragged path. A resize during a
drag cancels that uncommitted gesture, landscape asks the player to rotate while preserving the saved turn boundary, and a
journal restore failure keeps explicit **Retry run** and **Return** actions visible.

The result leads with **Circuit cleared**, **Drive depleted** or **Turn limit reached**. It then shows Training EXP, the
before/after TL bar, every level crossed and every opened constellation node by real name. Each node opens the Training
scene focused on it; **Done** returns to the caller and **Run again · 1 ticket** reserves a new attempt. A reload during a
board returns to the exact wave, board, gauges and intent rather than to the start screen.

### Race Select

- A **racing Uma strip** under the title: a horizontal row of her busts, the featured Uma first, then by level. Tapping
  one switches every section below to her; the picked bust is outlined and scrolled into view.
- **Racing as**: the same scenario switch as her profile, when she has more than one scenario (D190). An earlier
  scenario hides the career tracker and EXP, and says it races without Uma EXP.
- A **career tracker**: her three stages with levels and progress, the current stage's goal races, and what the stage
  is holding ([Scenario Careers](scenario-goals.md#presentation)).
- **Next up**: 5–10 race cards worth running now — the unwon goals up to her current stage, then races graded for her
  stage in her profile, one per race family. Cards carry line-icon marks: a career goal, a G1 set leg with progress,
  a first G1 win.
- **Won this scenario**, **All races** and **Recent results** are collapsed below; every race stays runnable.
- Tap → Pre-race.

Multiple goals for one target share one race card with ordered ribbons. A direct Home/Journey goal link selects that exact
race when available; missing/retired targets remain explicit instead of silently substituting another race.

### Pre-race

- **Field preview**: a row of the field's busts, in gate order.
- **Strategy** segmented control, with aptitude letters. **Loadout** summary chip (tap to edit in a sheet).
- The race's marks, and every active goal at stake with its win rule.
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
3. The Uma EXP bar fills. On a level-up: burst, and the ticket reward moves in.
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
  ([Collection](collection.md#card-album)). In a scenario, tiles carry stars and the reserved detail area has a
  **Bond** button, so a bond is one tap from the tab.
- **Card page** (`/cards/:id`): the card's illustration full width, with its name, type and ownership over its foot (a
  tap opens the whole illustration), then how to own it (tickets or a coupon), **Bond by scenario** with a Bond
  button per reached scenario, then what it pays — its split, a 0★–5★ per-node ladder (in SP for a Friend or Group card), Race
  Bonus and its skills in node order — and every set it sits in.
- **Unlock** hands to the full-screen collection reveal, which returns to the card's page.
- A bond is raised only in Friendship Training, which always returns where it was launched: the album lens, the card page,
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
| Spark drag enters a cell | Displaced orb slides home | Soft bead tick, rate-limited | — | — |
| Spark match / cascade | Outline, clear, fall; combo counter settles | Rising match tones | Strategy glyph burst | Light on resolved turn |
| Rival Pressure / wave clear | Gauge response / rival break | Hit / short victory sting | Bounded impact / sparkle | Medium |
| Spark Shift | Spark orbs turn in one sweep | Charge release | Gold trail | Medium |
| Friendship training | Rainbow sweep | Chord | Rainbow sparkles | Medium |
| Training Level up | Badge burst, opened-node list reveals | Jingle | Star burst | Medium |
| Race start | Gate snap, camera push | Gate clank, crowd | Dust | Medium |
| Win | Placement stamp | Fanfare | Confetti | Success pattern |
| Uma Level up | Ring fill and burst | Level jingle | Stars | Medium |
| Goal completed | Ribbon unfurl | Big fanfare | Gold confetti | Success pattern |
| Badge or title earned | Shine sweep and flip-in | Sparkle | Tier-colored sparkles | Light |
| Star earned / promotion | Lift, glow, ignite | Power-up | Glow burst | Heavy |
| Coupon reveal | Flip with anticipation shake | Drumroll → reveal | Burst | Heavy |

Haptics are progressive enhancement only (see research). Motion plus sound must stand on their own.
The sound and haptic rows are the shared semantic cue catalog; their device service and licensed/local assets remain
M011/T036 work. Rival Circuit's checked-in implementation is visually complete and announcement-complete when that service
is unavailable, and does not download or embed original-game audio.

## Accessibility and comfort

- Tap targets are at least **44×44 pt**. Nothing critical lives in the top corners.
- Tiers use **shape and label in addition to color**.
- `prefers-reduced-motion`: no shake or parallax, shortened fanfares, instant counters.
- Sound defaults on but respects the silent switch where the platform does. Everything is also shown visually.
- Numbers use tabular figures, so counters don't jitter.
