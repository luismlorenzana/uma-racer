# SE4 — uma-racer on `uma-kit/content` and `uma-server/content`

**uma-racer · Either · M · Needs: SE1 merged and SE2 released · Part of sibling Phase E.**

## Why

Once uma-racer reads uma-platform's releases (SE1), its loading code can be the shared one: SE2's web runtime (an
authenticated fetch, a blob and Cache Storage cache, atlas sprites) and the API's proxy modules. Both games then load
data and art with one codebase.

## Context (read first)

- uma-platform: `docs/sibling/phases.md` § Phase E; `packages/kit/README.md` § `/content`; and
  `packages/server/README.md` § `/content`.
- **This repo after SE1:** its master data source and controller, its web adapter from the release to its content
  shapes, `apps/web/src/content/*` (what's left of the old runtime), `apps/web/src/app/content.ts`,
  `apps/web/src/app/art.ts`, `apps/web/src/ui/album/useArt.ts` (or its replacement after SB6), and
  `apps/api/src/content/*`.

## Decisions made

- **Web:** `ContentProvider` from `uma-kit/content`. The adapter from the release to the game's shapes stays here.
  The old runtime goes.
- **API:** `ReleaseProxyModule.forRoot({ route: 'master', … })`, and `PrivatePackModule.forRoot({ route: 'content',
  … })` for any racer-only private pack SE1 kept. Routes and env vars unchanged.
- **Art in lists** goes through the kit's art helpers, and the album's `AlbumArt` provider (SB6) maps to them.

## Do

1. Pin the versions; swap the web and API pieces; delete the replaced code. Keep the tests that still apply.
2. Run the API's tests, plus local requests to `/api/master/…` and `/api/content/…`, including a non-allowlisted path
   (404).
3. **Docs:** `docs/game/architecture.md`; run `pnpm docs:update`; log a D-decision.
4. **Check it** locally, in the game's dev server (a desktop browser at phone width; no iOS Simulator, P60):
   - the Stable;
   - the plaza;
   - a race;
   - art after an offline restart.

## Done when

- [ ] `pnpm lint && pnpm test && pnpm build` pass; the startup budget holds.
- [ ] `apps/web/src/content/` and `apps/api/src/content/` hold no loader or proxy code of their own.
- [ ] The local check was done. The docs and D-decision are in. Deployed and green.

## Deliver

- Claude: commit to `main`, `refactor: data and art through the shared content packages (SE4)`.
- ChatGPT: branch `sib/se4-racer-content`, a pull request with the same title.
- **Flag it done:**
  - delete this file;
  - add a Done row to `docs/handoff/README.md`;
  - set SE4 to Done in uma-platform's queue.
