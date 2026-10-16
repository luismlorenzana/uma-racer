# SB6 — uma-racer on the kit album: the Stable, every picker, faces, and busts in races

**uma-racer · Either · L · Needs: SB3 released (SB1 for real faces, after SE1; until then, faces map to today's
`face` art) · Part of sibling Phase B.**

## Why

Phase B gives both games one Uma list and one picker. uma-racer's album engine and `UmaPicker` were the source for
the kit's `/roster` and `/album` (SB2, SB3). This packet moves uma-racer onto the kit's copies and deletes its own.

The owner's decisions of 2026-10-16 apply here too:
- **Face crops** wherever an Uma is small: the Stable at 5 columns, every picker, the Farm's assigned Umas, pips.
- **Busts** where she's large, **including races**. No chibis there.

## Context (read first)

- uma-platform: `docs/sibling/phases.md` § Phase B; `docs/change-protocol.md`; `packages/kit/README.md` § `/roster`,
  `/album`.
- **This repo:**
  - **the album:** `apps/web/src/ui/album/` (`AlbumChrome.tsx`, `FilterTray.tsx`, `SortSheet.tsx`, `VirtualGrid.tsx`,
    `query.ts`, `useArt.ts`) and `apps/web/src/ui/albumPrefs.ts`;
  - **the picker and art:** `apps/web/src/ui/UmaPicker.tsx`, `UmaArt.tsx` (`UmaFace`, `UmaArt`), `ContentArt.tsx`,
    `ArtSquare.tsx`, `ArtTile.tsx`;
  - **the Stable:** `apps/web/src/places/stable/Page.tsx`, `model.ts`, `Peek.tsx`, `Profile.tsx`;
  - **the Farm's strip:** `apps/web/src/places/farm/job-sheet/UmaStrip.tsx`;
  - **pickers and strips elsewhere:** search for `UmaPicker` and `UmaFace`;
  - **the race screen:** search for where the race draws Uma art (PixiJS today). Its standings, results and the
    reveal ceremony.
  - **A03's level rule:** D368, and `docs/game/07-farm.md` §10, `05-training-hub.md` §8, `11-hub-and-places.md` §9.2.
  - **Art:** `apps/web/src/content/runtime.ts` (`ArtKind`: uma, card, bust, chibi, dress, face) and
    `apps/web/src/app/content.ts`.

## Decisions made

- **One album from the kit:** `AlbumChrome`, `AlbumGrid`, `useAlbumPrefs` and `UmaPicker`. Delete `ui/album/*`,
  `ui/albumPrefs.ts` and `ui/UmaPicker.tsx`.
  - Saved views and the seen set carry over: point the kit at the old storage keys once, or read them once and write
    the kit's (note which under Decisions).
- **Views:** icons are **faces at 5 columns** by default (it is 3 columns of icons today); cards are busts at 3; list
  is 1.
- **uma-racer's album:** facets tier, ready, target, New, aptitudes A+; sorts level (lifetime; the default), release,
  name, tier, Racing, Farm.
  - **Badges:** tier, ready, target.
  - **Work pickers:** `workOrder` (free first, then Farm Level).
- **Art provider:**
  - `useUrl` maps `face` to today's `face` art, which is per character. After SE1 and SB1 it maps to `outfit-faces`.
  - `bust` to `bust`, `chibi` to `chibi`, `icon` to the `uma-icons` atlas.
- **Busts in races:** wherever the race screen, its standings or its results show an Uma, it shows her bust, never a
  chibi. Only the plaza keeps chibis.
- **The reveal ceremony stays uma-racer's,** but its picker and grids come from the kit.

## Do

1. Pin the kit version with `/roster` and `/album`; add `AlbumArtProvider`.
2. Rebuild the Stable on the kit, with the schema above. Migrate the preferences once.
3. Replace every `UmaPicker` and list-type strip with the kit's `UmaPicker`, keeping each context's order and
   reasons. Use `FaceTile` in pips, slots and strips (`round` in pips and slots).
4. Put busts in the race's standings and results, and anywhere else the race shows Uma art. Remove any chibi request
   from race code.
5. Delete the retired files. Keep each game-specific helper in this repo.
6. **Docs:** the manual's pages on the Stable, pickers and the race; run `pnpm docs:update`; log a D-decision.
7. **Check it** in the iOS Simulator's Home Screen app, light and dark:
   - the Stable at 5 columns, with search, filters, sorts, saved views and New;
   - every picker;
   - faces in pips and strips;
   - a race's busts.

## Done when

- [ ] `pnpm lint && pnpm test && pnpm build` pass; the startup budget holds.
- [ ] `ui/album/`, `ui/albumPrefs.ts` and `ui/UmaPicker.tsx` are gone, and no race code requests `chibi`.
- [ ] The Simulator check was done and described. The docs and D-decision are in. Deployed and green.

## Deliver

- Claude: commit to `main`, `feat(web): one Uma album and picker from uma-kit (SB6)`.
- ChatGPT: branch `sib/sb6-racer-album`, a pull request with the same title.
- **Flag it done:**
  - delete this file;
  - add a Done row to `docs/handoff/README.md`;
  - set SB6 to Done in uma-platform's queue.
