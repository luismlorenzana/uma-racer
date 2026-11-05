# T163 — Distance presets: a deck, posts and style per distance

> **M037, part 4.** Domain and web. Branch from `main` once T162 has merged (it uses T162's `presets` shape).
> Decision **D394**. No save shape change, so no protocol bump.

## Why

The owner: "In the past we used to have distance aptitude presets that would let me set card sets, stats and
inheritance per running distance, that way I could mix and match between Long and Medium races."

T162 gives every career two distances, and a `presets` field whose two presets start as the same deck. This packet
makes them separate: each distance races and trains on its own deck, posts and running style.

## Context

Read first:
- **The design:** [careers v2](../research/careers-v2/README.md) §3. This is the binding summary.
- **T162** (merged): `CareerRecord.presets`, the calendars and the season card.
- **The build:**
  - `build/` (deck, posting, derive, racing-build, skills, bond, ops);
  - [05](../game/05-the-build.md) §2, §5, §7 and §9;
  - [06](../game/06-cards-and-bonds.md).
- **Generation 2's presets, for the feel** (D254):
  - `docs/archive/g2-manual/05-training-hub.md`;
  - `git show c592ccd:packages/domain/src/state/types.ts` (`UmaBuild`).
- **The web:** `apps/web/src/places/career/` (Upgrade: Deck, Tree, Bonds, Skills) and the race sheet.

## Do

1. **What each preset holds, and what's shared** (§3's table):
   - **per preset:** the deck (six owned cards of the scenario's era), the posts and the running style;
   - **shared:** the tree's pips and Camps, the wallet, the bond tracks (a card in both decks has one track) and the
     skills (one SP pool, up to the cap).
2. **Derived per preset:**
   - `readDeck`, `careerStats` and `deriveRacingBuild` take a distance;
   - a pip's gain reads the preset's posted cards, so the same tree pays each preset its own stats;
   - SP earned is the better preset's (§3).
3. **Operations:**
   - `set-deck`, `post-card` and a new `set-style` take `distance` (one of her group's two);
   - `pour-bond` takes any card in either deck;
   - every one refuses a distance outside her group, in words.
4. **Automatic switching:**
   - a race reads its distance's preset (its stats, its deck's Race Bonus and its style);
   - a stage reads the preset of the race it prepares;
   - winning the URA Finals freezes one racing build per preset.
5. **The web:**
   - Upgrade opens on the preset of her next race, with a switch at the top (for example Medium | Long);
   - Deck, Tree and Bonds edit and preview the viewed preset;
   - each pip preview also shows the other preset's gain, faintly;
   - the race sheet shows the preset's badge;
   - her profile and the completion screen show both racing builds;
   - a single-distance Uma has one preset and no switch.
6. **Sims:**
   - `pickDecks` gains §4.4's distance lean;
   - `sim:careers` builds a median and a strong deck per preset and races each objective on its distance's preset;
   - §4.4's per-preset bond band holds.
7. **Docs:**
   - rewrite [05](../game/05-the-build.md) §2, §5, §7 and §9, [06](../game/06-cards-and-bonds.md)'s bond sharing and
     [11](../game/11-hub-and-places.md)'s Upgrade;
   - update the career guide;
   - add **D394**.

## Done when

- [ ] Domain tests:
  - [ ] two presets on one tree derive different stats from different posts;
  - [ ] the shared bond track;
  - [ ] SP earned reads the better preset;
  - [ ] each operation refuses a distance outside her group;
  - [ ] a race and a stage read the right preset;
  - [ ] the Finals freeze both builds.
- [ ] Web tests at 390×844 in light and dark: the preset switch, the faint other-preset gain and the race sheet badge.
- [ ] `pnpm sim:careers` holds §4.4's bands with per-preset decks on the private pack.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass.

## Deliver

- Branch `feat/t163-distance-presets` from `main`, with a PR into `main` titled
  `feat: distance presets, a deck and style per distance (T163)`.
- CI must pass before the merge.
- Delete this file in the PR.
- It deploys on merge. Verify per the release runbook, then tell the owner to restart the app.
