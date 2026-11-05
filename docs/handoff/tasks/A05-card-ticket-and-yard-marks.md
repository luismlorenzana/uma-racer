# A05 — The Card Ticket mark and Training Yard's Fatigue and Rest marks

> **For ChatGPT.** An art packet: draw three small marks in uma-platform's `scripts/pixel-art` and publish them in an
> `@luismlorenzana/uma-art` release. Claude pins the release in uma-racer afterwards.

## Why

uma-racer's generation 3 (released 2026-11-05, D388) uses three marks that uma-art doesn't draw yet, so it shows
stand-ins today:

| Where | What it shows now | What it should show |
|---|---|---|
| The top bar's **Card Tickets** chip, beside the Uma Tickets chip | The kit's generic "cards" icon | Its own currency mark, `currency/card-ticket`, matching the four existing currency marks |
| **Training Yard's Fatigue** piece: a blocker that drifts toward the player's best tile | A generic warning triangle | A **sweat drop**, the series' classic "tired" sign: `yard/fatigue` |
| **Training Yard's Rest** piece: what Fatigue turns into when boxed in (three Rests clear the Fatigue around them) | A generic moon | A **folded towel**, rest after training: `yard/rest` |

The owner wants every mini-game to read as Uma Musume, never as generic UI.

## Context

Read first:
- uma-platform's `AGENTS.md`, and `scripts/pixel-art/README.md` with its existing painters. The **`ui` atlas** is the
  one to extend: it already holds `currency/laurel`, `currency/prize-money`, `currency/speed-ticket` and
  `currency/uma-ticket` (16×16), the class emblems (24×24), the status badges (12×12) and the tier crests (12×12).
- **The house style** (`assets/previews/*.png`):
  - classic 3/4 view, light from the top left;
  - a 1 px selective outline;
  - six-tone ramps from `color.ts`;
  - deterministic output: the same code always gives the same bytes.
  
  It passed calibration in uma-rpg (its H01, D90).
- **The existing currency marks** you're matching: draw `currency/card-ticket` as their sibling. Same size, outline
  weight and light. **Clearly distinct from `currency/uma-ticket` at a glance** at 16 px: a different main colour and a
  different silhouette, since they sit side by side in the top bar.
- **Where the marks are drawn in the racer:**
  - **The top bar chip:** 16 pt, on the account bar in light and dark themes.
  - **Training Yard pieces:** tiles about 52 pt square on a 6×6 board. The racer draws your 24×24 mark at 2× (48 pt).
    - Fatigue sits on a **dark** tile, the theme's `bg-stage` (`#101a24`, near-black navy in both themes).
    - Rest sits on `bg-sunken`: `#e4eaf2`, a light blue-grey, in light theme, and `#0b1118`, near-black, in dark theme.
    
    Each mark needs its own outline so it reads on both.
- **Original art only:** nothing traced or copied from the Umamusume game or any other game.

## Do

1. In the `ui` atlas, add three frames:

   | Key (`group/key`) | Size | Subject | Notes |
   |---|---|---|---|
   | `currency/card-ticket` | 16×16 | A small support-card ticket: a portrait card shape with a star or a horseshoe emblem, or a ticket stub carrying a card | Distinct colour from the Uma Ticket. It must read as "card" at 16 px |
   | `yard/fatigue` | 24×24 | A large sweat drop, the anime "tired" drop: a clear light-blue body, a white highlight and a 1 px darker outline. Optionally two tiny speed-lines | Must read on a near-black tile |
   | `yard/rest` | 24×24 | A folded towel, white or very pale blue with one or two coloured stripes, maybe a small fold shadow | Must read on both `#e4eaf2` and `#0b1118` |

   The keys and sizes are exact: the racer looks them up by these names. Add the `yard` group to the atlas index the same
   way the other groups are listed (`{ x, y, w, h, group, key }`).
2. Update the package README's `ui/atlas` line: five currency marks, plus the `yard` group of two 24×24 marks.
3. Run `pnpm art:draw`. Check the contact sheet shows the three new frames beside the existing currency marks. Make
   the previews:
   - each mark at 1×, 2× and 4×;
   - the two ticket marks side by side on a light and on a dark background;
   - the Yard marks on the stage tile (`#101a24`), the light sunken tile (`#e4eaf2`) and the dark sunken tile (`#0b1118`): the theme's real `--color-stage` and `--color-sunken` values.
4. Add a changeset for a **minor** uma-art release and run `pnpm version-packages` in the same pull request
   (uma-platform's P42 flow).
5. Log the decision with uma-platform's next free P-number.

## Done when

- [ ] `ui/atlas.json` has `currency/card-ticket` (16×16) and `yard/fatigue` and `yard/rest` (24×24), with these exact
      keys.
- [ ] `pnpm art:draw` is deterministic: a second run changes no bytes. uma-platform's `pnpm lint && pnpm test && pnpm
      build` pass, including the art package's own tests.
- [ ] The previews are in the pull request inline. The two tickets are distinct at 16 px; the sweat drop reads on the
      stage tile; the towel reads on both sunken tiles.
- [ ] A new `@luismlorenzana/uma-art` minor version is published (P42: merge your own PR once CI passes; the push to
      `main` publishes).

## Deliver

- **Repo:** uma-platform. Branch `feat/racer-a05-marks` from the latest `origin/main`, in your own worktree outside
  `~/workspace`.
- **The pull request:** titled `feat(art): Card Ticket and Training Yard marks (racer A05)`. Include the previews,
  the Decisions, and how you verified it.
- **Reply** with the PR link, the published uma-art version, and three lines: what it draws, what to look at, and
  anything off.
- **uma-racer is Claude's side:** it pins the new uma-art version, swaps the stand-ins for these frames, deletes this
  packet and logs the decision. Don't open a PR in uma-racer.
