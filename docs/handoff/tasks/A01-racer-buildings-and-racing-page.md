# A01 — uma-racer's four buildings and the Racing page

**Priority: now · ChatGPT · uma-platform · M.** Ready: the Hub port reads these frames; until they ship it draws the
four places as plain placeholders and gives the Racing page another page's ground.

## Why

uma-racer's Home screen is uma-rpg's Phaser town hub on four pages: Town Hall, Training, Racing and Farm. It draws
every place from uma-art's `buildings` atlas and every page from its `tiles` atlas. Four places have no frame that reads
right, and the Racing page has no ground of its own. Today those four show as empty white boxes on the owner's phone.

## Context

- **uma-racer** [docs/game/11-hub-and-places.md](../../game/11-hub-and-places.md) §10 is the art contract: which
  uma-art frame each place uses, why these four need new ones, and the Racing page's tiles (§10.2 and §10.3).
- **uma-platform** `scripts/pixel-art/README.md` and `packages/art/README.md`: the house style and each atlas's schema.
- **Buildings:**
  - `scripts/pixel-art/src/buildings/`: `kit.ts` holds the shared vocabulary (`SIZE` 48, `GROUND` 44 as `anchorY`,
    `wall`, `window`, `door`, the roofs, `chimney`, `fence`, `slab` and the rest).
  - `types.ts` holds `Page`. The per-page files (`farmlands.ts`, `wilds.ts`, `learning.ts`, `town.ts`) each export a
    list of `{ id, name, page, at, paint }`, and `places.ts` concatenates them.
  - `build.ts` packs six frames across, in `PLACES` order. Its only check is that no pixel touches the frame edge.
  - A model to read first: `observatory` in `town.ts`, a stone drum under a ribbed dome.
- **Tiles:**
  - `scripts/pixel-art/src/tiles/`: `terrain.ts` holds `PAGES` and each page's `GROUND`, `PATH` and `STREAM`. Related
    files are `ground.ts` (four seamless variants), `autotile.ts` (masks N 1, E 2, S 4, W 8), `paths.ts`, and
    `props/<page>.ts` with `props/kit.ts`.
  - `build.ts` holds `PROPS`, `PLACEMENT` and the sample maps. `check.ts` holds the seam checks.
- **uma-rpg**, read only:
  - `apps/web/src/hub/scene/HubScene.ts` and `terrain.ts` show how the Hub consumes these frames: tall props are
    16×32, stamped one row up, and a building covers three tiles across and three up from its ground line.
  - `docs/design/world/map-art.md` holds the fullest written art rules.

## Do

1. **Buildings.** Draw four new 48×48 places with `anchorY` 44, in the existing kit. Put them in a new
   `src/buildings/racer.ts` and **append** its list after every existing place in `places.ts`. Every 2.5.0 frame keeps
   its position, so the release is **minor**. Add `racing` to `Page`, with the colours and tints every
   `Record<Page, …>` needs (`tsc` names them).
   - **`card-library` (page `town`):** a two-storey library in warm plaster and stone, with a tall arched window showing
     shelves of books and a hanging sign with a playing-card mark. It must read as books and cards, not magic: no tower,
     no crystals, no glow.
   - **`gym` (page `learning`):** a low brick training hall with a wide open front showing a dumbbell rack and a
     climbing rope, and a stopwatch or whistle sign over the door. It must read as athletic training, not combat: no
     weapons, targets or banners of arms.
   - **`racecourse` (page `racing`):** the game's centrepiece, so give it the most care. Show:
     - a roofed grandstand with tiered seats;
     - white rails running in front;
     - a strip of green turf;
     - a finish post with a red-and-white disc, and a pennant on the roof.
     
     It must read as horse racing at a glance. It is not the stadium of uma-art's `tier-finale`, which ringed with flags
     is the Expedition Map.
   - **`trophy-hall` (page `racing`):** a small classical hall with columns and a pediment, a gold cup on the
     pediment's peak, and banners in gold and racing green.
   - Return `smoke` only from a real chimney (the library and the gym may have one). The Hub animates nothing else on a
     building.
2. **The Racing page's tiles.** Append `racing` to `PAGES`, so its rows land below every existing page's, and give it:
   - `GROUND.racing`: four seamless turf variants (`racing/ground-0…3`), a bright mown green with faint stripe
     texture, lighter and cooler than the Farmlands' grass.
   - `PATH.racing`: a dirt-track path set (`racing/path-0…15`, the same edge masks), raked brown dirt with white rail
     edging on the sides that border turf. Roads never close a 2×2 block (D90).
   - **Props** in `props/racing.ts`:
     - `racing/rail`: white post-and-rail, 16×16;
     - `racing/furlong-post`: a white pole with a marker board, 16×32;
     - `racing/pennant`: a pole with a triangular pennant in racing green and gold, 16×32;
     - `racing/flower-box`: 16×16.
   - **The sample map:** give `PROPS` and `PLACEMENT` a `racing` entry, so `art:draw` writes a sample Racing page
     beside the others.
3. **Guard the old frames.** Add a Vitest test in `scripts/pixel-art` that freezes every 2.5.0 `buildings` and `tiles`
   frame's `x`, `y`, `w` and `h` (a checked-in `legacy-2.5.0.json`, as `gear/legacy-2.0.0.json` does), and checks
   that the four new buildings and every `racing/*` tile above exist with the sizes given.
4. **Docs.**
   - `packages/art/README.md`: the `racing` page, and the four new buildings.
   - `scripts/pixel-art/README.md`: the racer's buildings and the Racing page, in a short section.
   - The P-row in `docs/decisions.md`.

## Done when

- `pnpm art:draw` runs twice with byte-identical output, and `git status` is clean after the second run.
- The edge-touch check, the seam checks, and `pnpm lint && pnpm test && pnpm build` pass.
- No 2.5.0 frame moved (the new test).
- The pull request shows, inline at 2×:
  - the four buildings beside `stable`, `observatory`, `brawler-dojo` and `scenario-gate`, for scale and style;
  - the sample Racing page.
- No original-game content: no logos, characters or track layouts copied from any game.

## Deliver

- **uma-platform:** a pull request on `feat/racer-hub-art`, titled `feat(art): uma-racer's four buildings and the
  Racing page (A01)`, with a minor changeset and `pnpm version-packages` (2.5.0 → 2.6.0) in the same pull request.
- It merges itself after green CI (P42), and the push to `main` publishes the release. Log the decision with the next
  free P-number (fetch `main` first).
- Reply with the PR link and the published version. Claude pins it in uma-racer and switches the Hub to the new frames.
