# A03 — The iPhone band and the level rule (P48, Phase 0)

**Priority: now · ChatGPT · uma-racer · S.** Ready: the sibling apps plan is approved (uma-platform P48), and Phase 0
is each game's own fix, made before the shared `@luismlorenzana/uma-kit` takes over its shell (Phase A). uma-rpg's
half is its packet H30.

## Why

Two things the owner found on their iPhone 15 (393 × 852 pt), in the Home Screen app:

1. **The app ends 59 pt above the bottom of the screen,** leaving a plain white band under the bottom bar. 59 pt is
   the iPhone 15's top safe-area inset. With `apple-mobile-web-app-status-bar-style` set to `black-translucent`
   (`apps/web/index.html`), the app draws under the status bar, and in that mode `h-dvh`, which the shell uses, comes out
   shorter than the screen by about that inset. On top of that, the floating bottom panel sits 8 pt plus the whole
   home-indicator inset above where the frame ends.
2. **Uma lists don't open in one predictable order.** The rule is now one rule for both games: pickers open on level,
   and a picker's own context order stays one tap away.

## Context

- **The plan:** uma-platform `docs/sibling/hub-rework.md` §0 (0.1 the band, 0.2 the level rule) and §A8; P48 in
  uma-platform's `docs/decisions.md`. Read on GitHub (`gh api repos/luismlorenzana/uma-platform/contents/docs/sibling/hub-rework.md`)
  or a fresh uma-platform checkout.
- **uma-racer:**
  - `AGENTS.md`, its "Workflows" section above all: worktrees, running on your own ports, the dev seeds at
    `/dev/seeds/<route>?seed=busy`.
  - [docs/game/11-hub-and-places.md](../../game/11-hub-and-places.md): the shell (§1–§2), and the menu tree.
  - [docs/game/architecture.md](../../game/architecture.md).
- **The band's code:**
  - `apps/web/src/hub/Shell.tsx`: `h-dvh` on the frame;
  - `apps/web/src/hub/BottomBar.tsx`: the floating panel with `pb-safe`;
  - `apps/web/src/index.css`: the theme tokens, the `pt-safe`/`pb-safe` utilities and the `html`/`body` background;
  - `apps/web/index.html`.
- **The level rule's code:**
  - the Farm job sheet's Uma strip (`apps/web/src/places/farm/job-sheet/model.ts`, `UmaStrip.tsx`; D366 made it free
    Umas only, suited first);
  - the Training session sheet's Uma order (`apps/web/src/places/training/session/model.ts`, the "Left here" order);
  - the Lineage Hall slot picker (`apps/web/src/places/training/lineage-hall/LineageView.tsx`, `defaultSort="adds"`);
  - the Racing page's Uma strip (`apps/web/src/places/racing/view.ts`, open goals first);
  - `ui/UmaPicker` and its sort menu;
  - the lifetime level is `lifetimeLevel` in `@racer/domain/tiers`: 50(t − 1) + Racing Level, as the Stable already
    sorts.
- **The Shell, BottomBar and theme are moving into `@luismlorenzana/uma-kit`** (Phase A, built by the uma-rpg
  session from uma-racer's `ff8b95a`). This packet builds on uma-racer's `main` as it is. Keep the change small and in
  place, with no restructuring, so the kit can carry it.

## Do

1. **The band (0.1):**
   - **The frame:** the Shell becomes a fixed frame, `position: fixed; inset: 0` (Tailwind `fixed inset-0`) instead of
     `h-dvh`, so it always covers the whole screen. Every full-screen route uses the same frame: the race run, the
     reveal and the ceremony.
   - **`html` gets the page background** (the theme's page token), so no gap can ever show white.
   - **The floating bottom panel** lifts by `max(env(safe-area-inset-bottom) - 12px, 8px)`, about 22 pt on an iPhone 15,
     instead of the inset plus 8 pt; the page shows around it.
   - **Check that nothing else moves:**
     - the account bar's `pt-safe`;
     - the sheets' and the side panel's own safe areas, with nothing hidden under the home indicator;
     - the Collect all pill above the bar;
     - the Hub map's size, since the canvas reads its host's size.
2. **The level rule (0.2)**, for uma-racer's four pickers that don't follow it yet:

   | Place | Today | Change |
   |---|---|---|
   | Farm job sheet | Free Umas only, suited first, then Farm Level | Free Umas only, **Farm Level** first, then suited as the tie-break |
   | Training session sheet | "Left here" (unlocks left) | **Uma Level** (lifetime) by default; "Left here" stays as an option in the sort menu |
   | Lineage Hall slot picker | "Adds" (grades and skills gained) | **Uma Level** by default; "Adds" stays as an option in the sort menu |
   | Racing page's Uma strip | Open career goals first, then lifetime level | **Lifetime level**; "Open goals" becomes a filter chip |

   Ties go to release date, newest first, then name. Umas who can't be picked go last, each with her reason. The Farm
   strip keeps listing free Umas only (D366), so this applies to the sessions and slots. The Stable, Feature, Card
   Library, Bond, Gate and Trophy Hall already follow the rule: leave them.
3. **Tests:** each changed order, and the band's frame and panel offset, as class checks in the shell tests.
4. **Docs:**
   - [11](../../game/11-hub-and-places.md): the shell's frame and the bottom panel's offset;
   - [07](../../game/07-farm.md) §10: the job sheet's order;
   - [05](../../game/05-training-hub.md) §8: the session and slot pickers;
   - the Racing page in 11 §9.2: the strip and its filter chip;
   - one decision row with the next free D-number (fetch `main` first; D362 is reserved).

## Done when

- `pnpm lint && pnpm test:ci && pnpm build` pass, the 180 KB startup check included, and `pnpm docs:update` leaves no
  diff.
- In the browser at 393 × 852 with the dev seeds, the bar sits at the bottom with only the safe area under it. The
  pull request shows screenshots of the Town Hall page, a building page, a sheet and the race run.
- A screenshot shows each changed picker in its new order.
- No original-game content.

## Deliver

- **uma-racer:** a pull request on `fix/phase0-band-and-levels`, titled `fix(web): the iPhone band and the level rule
  (A03, P48 Phase 0)`.
- **Don't merge it:** a merge to uma-racer's `main` deploys to the owner's phone. Claude reviews it, merges it with the
  next release, deploys and verifies, and the owner checks the band on the iPhone.
- Reply with the PR link and three lines: what it does, what to look at, what's next.
- Run the game on your own ports (`pnpm --filter @racer/web exec vite --port 5185 --strictPort`, with
  `API_PROXY_TARGET` pointing at your own API if you need one), so Claude's preview servers keep running.
