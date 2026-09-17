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

## Visual direction: "Racecourse Pop"

| Element | Direction |
|---|---|
| Palette | Sky blue and turf green as the base, warm cream panels, a vivid accent per stat (Speed blue, Stamina red, Power orange, Guts pink, Wit green). Badge tier colors (bronze → rainbow) are reserved for flair |
| Surfaces | Rounded panels (16–20 px radius), soft gradients, thick light inner borders, gentle drop shadows. Looks like a game UI, not a web form |
| Buttons | Chunky, with a darker **bottom edge that compresses on press** (3D feel) and gradient faces. Primary is gold/green, secondary is white |
| Type | **M PLUS Rounded 1c** (OFL, self-hosted), heavy weights for headings and numbers, tabular numerals for counters |
| Iconography | Original UI icons (SVG). Character and card art come only from the private content packs |
| Motion language | Springy (slight overshoot), quick in (150–250 ms), confident out. Sparkles and shine sweeps for rare or earned things |
| Theme | One vibrant light theme (a game look). A dimmer night variant is later polish |

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
- **Goal tracker** card for the featured Uma (3 pips), and a **recent flair** strip (latest badges).
- A swipe on the portrait switches the featured Uma.

### Stable

- A complete All/Owned/Unowned grid: owned tiles show portrait, levels, tier, and ready state; unowned outfits use labeled
  silhouettes and open a Select Coupon review. Owned tiles navigate directly to Profile.
- Completion, shard progress, coupon balance, and the explicit five-shard Exchange action sit above filter chips for tier,
  distance, surface, strategy, and ready state. Sorting remains in a sheet.
- Exchange uses a short Motion counter response, with an instant reduced-motion equivalent. Missing content and memory-only
  persistence remain visible rather than silently changing counts.

### Uma Profile

- **Hero header**: portrait, name, active title, level, Scenario Journey strip.
- **Swipeable tabs**: Overview (stat radar plus stat bars showing the current cap and the scenario baseline) · Skills (loadout editor with an **SP capacity meter** that fills as skills are equipped) · Deck (6 slots, era locks) · Lineage (interactive family tree) · Badges (showcase) · Record.
- A sticky bottom action bar: **Train** · **Race** · **Promote** (when ready).
- The implemented Overview includes a live support-deck summary with selected private card art, used/unlocked slots,
  generated Race Bonus and hint count. **Edit** opens a lazy nested screen and preserves the profile back path.

### Support Deck Editor

- Six ordered rows show unlocked and future locked slots. Selected cards show private atlas art, type, era, level/LB, and
  ≥44 pt move/remove controls.
- Owned candidates have type and era filters. Later-scenario, duplicate-character, Friend/Group, selected, and missing
  references remain visible with a specific disabled reason rather than silently disappearing.
- Auto fill changes only the draft. Save revalidates current ownership/content and commits atomically; back/cancel writes
  nothing. The summary exposes generated effects, unique hint count, and Race Bonus before the player saves.

### Scenario Start (inheritance flow)

A full-screen stepper, one decision per step:

The implemented zero-parent baseline first reviews the completed snapshot, ticket cost/balance, overflow, +10-per-stat and
per-card Initial Stats gains, awakening, skill refresh, TL reset, new cap/era, and an explicit **Start without parents**
choice. Back is a write-free draft; confirmation is one local-first commit followed by a scenario title card and Opening
Training CTA. Reload after success reconstructs completion from the save and ledger. The remaining steps expand this route:

1. **Pick parents**: a carousel of parent snapshots (portrait, grandparent mini-icons, a "+N new skills for her" count). Skip is allowed.
2. **Inherited automatically**: skill chips **fly from the parents into the library**.
3. **Grandparent picks**: tap to pick 2 uniques, and whites against a "3 / 5 picks" counter. Ineligible ones show greyed with their reason.
4. **Pink sparks**: choose an aptitude upgrade per parent. The letter grade flips up.
5. **Confirm**: a scenario title card sweeps in ("Grand Masters"), and the Training Level bar resets to TL1.

### Training

The core loop, built for repeated one-thumb taps.

```text
┌──────────────────────────────┐
│ TL 4 ▰▰▰▱▱▱  🎫 312          │
│ [stat bars with cap markers] │
│ SPD ███████░░ 507 / 520      │
│ ...                          │
│   💡 hint popups appear here │
├──────────────────────────────┤
│  +59   +19        +27  ...   │  ← floating gain previews
│ ┌────┐┌────┐┌────┐┌────┐┌────┐
│ │SPD ││STA ││POW ││GUT ││WIT │ ← 5 big facility tiles
│ │🃏🃏 ││    ││🃏   ││    ││🃏  │   dealt card icons; rainbow edge = friendship
│ └────┘└────┘└────┘└────┘└────┘
└──────────────────────────────┘
```

- **Deal**: card icons drop onto facility tiles with a staggered bounce. Friendship tiles get an animated rainbow edge.
- **Preview**: every facility shows its projected gains before choosing.
- **Tap a facility to train**: press squash, the tile "launches", gains **fly into the stat bars**, bars fill with overshoot,
  the Training EXP bar fills, card EXP pips tick, the ticket counter drops by 1.
- **Hints**: a "💡 New skill!" chip pops out of the card icon and slides into a skill tray.
- **Training Level up**: a burst on the TL badge, and cap markers on the stat bars slide right.
- Right after resolving, the next deal starts, so the loop stays fast. A "Race now" button is always one tap away.
- An empty deck opens a clear Edit Deck CTA instead of silently choosing cards. Result feedback names every card and its
  earned EXP/level change.

### Race Select

- A list of **race cards**: grade ribbon, name, venue, distance and surface, and the selected Uma's aptitude letters (color-coded).
- **Goal races are pinned** with a 🎯 ribbon. Filter chips: grade, distance, surface, goals only.
- Tap → Pre-race.

### Pre-race

- **Field preview**: a row of NPC icons.
- **Form matchup meter**: "You 92% ⟷ Field 86%".
- **Strategy** segmented control, with aptitude letters. **Loadout** summary chip (tap to edit in a sheet).
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
5. Goal completion and badge/title reveals plug in during their owning milestones.
6. CTAs: **Races** · **Train** · **Race again**. Until the atomic save succeeds only Retry save is available; Race again
   becomes Promote first at a scenario gate.

### Cards

- **Album**: grouped by era, then type. Locked eras are dimmed with "Arrives in …". Owned cards show LB pips and a level bar.
- **Card detail** sheet: effects at the current LB and the next one (diff highlighted), EXP bar, and a **Limit Break** button with its 🎫 cost.
- **Limit break animation**: the card lifts, glows, the LB pip ignites, and effect numbers tick up.
- **Card Select Coupon** redemption: a selection grid, then a **flip reveal** with a shine sweep.

The implemented album also exposes owned/maxed completion, type and ownership filters, explicit Friend/Group unavailability,
missing-content preservation, and the one-time max-card Coupon state. Limit-break errors remain in the detail sheet so the
player can retry without losing context.

The implemented Select grid reuses deterministic private-catalog ordering, adds era/type filters, and keeps future-era and
Friend/Group ownership distinct from equip eligibility. Card and Uma review sheets show the exact one-coupon cost before
the local commit. The full-screen reveal carries only kind/id, reconstructs art and identity from committed save/content,
and is read-only on refresh or direct navigation.

### Badges

The big Badge page (see [Badges — Badge page](badges.md#badge-page)), built mobile-first:

- A scope switch at the top (Uma / Stable / Trainer) and a **search field**.
- **Filter sheet** with tag groups. Active filters show as removable chips.
- A **virtualized grid** of badge tiles. **Pin mode** enables multi-select and drag-to-reorder in the showcase.
- Tapping a badge opens a **detail sheet** with its tier ladder, dates, and race links.

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
