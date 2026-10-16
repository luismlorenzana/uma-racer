# A03 — The level rule for Uma pickers (P48, Phase 0.2)

**Priority: now · ChatGPT · uma-racer · S.** Ready: the sibling apps plan is approved (uma-platform P48). Phase 0 has
two parts:
- **0.1, the iPhone band under the bottom bar, is not in this packet.** The shared `@luismlorenzana/uma-kit` 0.1.2
  carries it (`AppFrame` is `fixed inset-0`, and `BottomBar` lifts by `mb-bar-safe`), and Claude is moving uma-racer
  onto the kit now (step A6.2).
- **0.2, the level rule, is this packet.** uma-rpg's half is its packet H30.

## Why

Uma lists don't open in one predictable order. Both games now follow one rule: pickers open on level, and a picker's
own context order stays one tap away in its sort menu.

## Context

- **The plan:** uma-platform `docs/sibling/hub-rework.md` §0.2 and §A8, and P48 in uma-platform's
  `docs/decisions.md`. Read on GitHub (`gh api repos/luismlorenzana/uma-platform/contents/docs/sibling/hub-rework.md`)
  or a fresh uma-platform checkout.
- **uma-racer:** `AGENTS.md`, its "Workflows" section above all: worktrees, running on your own ports, the dev seeds at
  `/dev/seeds/<route>?seed=busy`. [docs/game/11-hub-and-places.md](../../game/11-hub-and-places.md) has the menu tree.
- **The code:**
  - the Farm job sheet's Uma strip (`apps/web/src/places/farm/job-sheet/model.ts`, `UmaStrip.tsx`; D366 made it free
    Umas only, suited first);
  - the Training session sheet's Uma order (`apps/web/src/places/training/session/model.ts`, the "Left here" order);
  - the Lineage Hall slot picker (`apps/web/src/places/training/lineage-hall/LineageView.tsx`, `defaultSort="adds"`);
  - the Racing page's Uma strip (`apps/web/src/places/racing/view.ts`, open goals first);
  - `ui/UmaPicker` and its sort menu;
  - `lifetimeLevel` in `@racer/domain/tiers`, the lifetime level: 50(t − 1) + Racing Level, which the Stable already
    sorts by.
- **Claude is replacing uma-racer's shell, Hub and shared UI pieces with uma-kit's at the same time.** Stay out of
  `apps/web/src/hub/`, `apps/web/src/app/`, `apps/web/src/index.css`, `main.tsx` and the kit's pieces in `ui/`
  (BottomSheet, Sheet, Button, Chip, Tabs, Panel, PlaceHeader, the icons, UiMark, AnimatedNumber). This packet only
  touches the places and the domain files listed above, and `ui/UmaPicker`, so the two changes don't collide.

## Do

1. **The level rule (0.2)**, for the four uma-racer pickers that don't follow it yet:

   | Place | Today | Change |
   |---|---|---|
   | Farm job sheet | Free Umas only, suited first, then Farm Level | Free Umas only: **Farm Level** first, then suited as the tie-break |
   | Training session sheet | "Left here" (unlocks left) | **Uma Level** (lifetime) by default; "Left here" stays as an option in the sort menu |
   | Lineage Hall slot picker | "Adds" (grades and skills gained) | **Uma Level** by default; "Adds" stays as an option in the sort menu |
   | Racing page's Uma strip | Open career goals first, then lifetime level | **Lifetime level**; "Open goals" becomes a filter chip |

   - **Ties** go to release date, newest first, then name.
   - **Umas who can't be picked** go last, each with her reason. The Farm strip keeps listing free Umas only (D366), so
     this applies to the sessions and slots.
   - **Already following the rule, so leave them:** the Stable, Feature, Card Library, Bond, Gate and Trophy Hall.
   - **The preselection:** keep each sheet's preselected Uma consistent with its new first row, unless a link names an
     Uma.
2. **Tests:** cover each changed order, its sort-menu option and the Racing strip's filter chip.
3. **Docs:**
   - [07](../../game/07-farm.md) §10: the job sheet's order;
   - [05](../../game/05-training-hub.md) §8: the session and slot pickers;
   - [11](../../game/11-hub-and-places.md) §9.2: the Racing strip and its filter chip;
   - one decision row with the next free D-number (fetch `main` first; D362 is reserved).

## Done when

- `pnpm lint && pnpm test:ci && pnpm build` pass, with the 180 KB startup check included.
- `pnpm docs:update` leaves no diff.
- The pull request shows each changed picker in its new order, at 390 × 844 on the dev seeds.
- No original-game content.

## Deliver

- **uma-racer:** a pull request on `fix/phase0-level-rule`, titled `fix(web): the level rule for Uma pickers (A03, P48
  Phase 0.2)`. Base it on the latest `origin/main` when you start.
- **Don't merge it:** a merge to uma-racer's `main` deploys to the owner's phone. Claude reviews it, merges it with the
  next release, deploys and verifies.
- Reply with the PR link and three lines: what it does, what to look at, what's next.
- Run the game on your own ports (`pnpm --filter @racer/web exec vite --port 5185 --strictPort`, with
  `API_PROXY_TARGET` pointing at your own API if you need one), so Claude's preview servers keep running.
