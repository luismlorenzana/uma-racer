# SA7 — The plaza crowd: small chibis on Town Hall (uma-kit 0.3.0)

**uma-racer · Either · S · Needs: nothing (uma-kit 0.3.0 is published) · A "Both apps" change from the owner
(2026-10-16), live in uma-rpg since its D150.**

## Why

The owner asked for "smaller but multiple Uma chibis" on Town Hall. uma-kit 0.3.0 gives the plaza a crowd:
- up to five small figures (about 44 px) in a loose V round the plaza spot;
- the first stands in front;
- each bobs 2 px on its own beat, still under reduced motion;
- the ground round them is kept clear of props.

uma-rpg shows its featured Uma in front, its active party round her, then the highest levels.

## Context (read first)

- uma-platform:
  - `packages/kit/CHANGELOG.md` 0.3.0;
  - `packages/kit/src/hub/PlaceTargets.tsx` (`Plaza`, `PlazaFigure`, `CROWD_SPOTS`, the `figures` option);
  - `HubMap.tsx` (the wider clearing).
- **uma-rpg's version, as an example:** `apps/web/src/hub/Featured.tsx` (`crowdOf`, `plaza`, the sheet for a tapped
  Uma through `?sheet=featured&uma=:id`, the round-token fallback) and its test `Featured.test.ts`.
- **This repo:**
  - `apps/web/src/places/stable/Featured.tsx` (the plaza's featured Uma and her sheet: Train, Race, Profile, Feature
    another);
  - `apps/web/src/ui/UmaArt.tsx` (`UmaArt`: chibi `-a`, then bust, then icon);
  - `apps/web/src/hub/HubPage.tsx` (where the plaza is passed to `HubMap`);
  - `docs/game/11-hub-and-places.md` (the plaza).

## Decisions made

- **Who stands there:**
  - the featured Uma in front;
  - then the four Umas with the highest lifetime level, newest release first on ties;
  - five at most, fewer when fewer are owned.

  uma-racer has no parties, so the level rule fills the crowd.
- **Each figure** is `UmaArt` at 44 px: her chibi `-a`, or else her bust, icon or initial, as `UmaArt` already falls
  back.
- **A tap** opens the featured sheet for that Uma: Train, Race, Profile. "Feature another" stays the sheet's way to
  change who's in front.
- **No names on the map;** each figure's accessible name says who she is and what a tap offers.

## Do

1. Pin `@luismlorenzana/uma-kit@0.3.0` (or newer).
2. In the plaza code, build `plaza.figures` instead of one `node`, with the crowd rule above. Make the sheet show the
   tapped Uma (a `uma` search param, cleared when the sheet closes).
3. Add a unit test for the crowd order: featured first, then levels, at most five.
4. **Docs:** update `docs/game/11-hub-and-places.md`'s plaza, and log a D-decision (the next free number in
   `docs/tasks/README.md`).
5. **Check it** in the iOS Simulator's Home Screen app, light and dark:
   - five figures in a V, none cut off;
   - tapping each opens her sheet;
   - reduced motion stops the bob.

## Done when

- [ ] `pnpm lint && pnpm test && pnpm build` pass; the startup budget holds.
- [ ] The Simulator check was done and described. The docs and D-decision are in. Deployed and green.

## Deliver

- Claude: commit to `main`, `feat(web): a crowd of small chibis on Town Hall's plaza, uma-kit 0.3.0 (SA7)`.
- ChatGPT: branch `sib/sa7-plaza-crowd`, a pull request with the same title.
- **Flag it done:**
  - delete this file;
  - add a Done row to `docs/handoff/README.md`;
  - set SA7 to Done in uma-platform's `docs/handoff/README.md`.
