# SE4 — shared content acceptance

The shared loader replaces Racer's last web transport, verified byte cache and held-URL implementation. Game
interpretation remains `@racer/domain/master`, called by `content/adapt.ts`; there is no save/schema/rule/economy
change. The API was already on uma-server 0.2.0 after SE1: its protected routes, allowlist and sources are unchanged.

## Shared prerequisite

uma-platform [PR #38](https://github.com/luismlorenzana/uma-platform/pull/38) released uma-kit 0.9.0 (P63), merged
as `7df106e`; [publication succeeded](https://github.com/luismlorenzana/uma-platform/actions/runs/39458261824). Complete
offline snapshots, full-hash private envelopes, compatible cache keys, cancellation, held art and shared responsive
atlas frames. Platform lint/test/build pass (81 kit tests). Synthetic fixtures cover a cold restart, damaged cache
repair, corrupt downloads/partial boot, auth refusal, cancellation, held/newest URL safety and stale portrait requests.

Temporary links were tested in isolated worktrees, never committed. RPG lint/test/build pass after refreshing only
the disposable dependency-doc block (its startup 213.80 KB gzip / 230 KB); its local Stable loads at 390×844. No RPG
code or deployment is part of SE4.

## Racer validation

- Local API on 8094 and web on 5188, isolated local proof save, existing local platform release bytes only. No asset
  downloads, content publish, production mutations, cloud cleanup or Simulator use.
- `/api/master/channels/v1/latest.json` and `/api/content/overlay.json`: 200; disallowed old pack and traversal: 404.
- Shared-runtime synthetic regressions retain both outfits of one character, atlas mapping, SE1-compatible cache and
  snapshot keys, full offline boot/viewed art, hash repair, failed partial boot, 401/403 and required-overlay refusal.
- Local phone checks at 390×844: Stable faces/search, unlock/reveal, profile bust, plaza chibi, race runner tokens,
  feed and finishing-order busts pass. A fresh page boot with the isolated API stopped restored the same content
  release, balances and cached profile bust; Account showed that release as offline. The API was then restarted.
  Original-art screenshots stay local, never in git.
- Published exact pin (not a link): `pnpm docs:update`, `pnpm lint`, `pnpm test`, `pnpm test:ci` and `pnpm build`
  pass. Startup **155.89 KB gzip / 180 KB**. No temporary link or upstream source is committed in Racer.
- Suites: domain 956, race 61, API 58, web 513 and overlays 2 tests pass. All 187 web source modules remain reachable;
  changed documentation links resolve; PixiJS remains race-only. No game source imports uma-work (SC5 stays separate).
- `pnpm sim:loop` passes all pacing guards unchanged (tier 1 21.36 weeks; first unlock 5.40 hours).

Owner iPhone/PWA edge feel remains the owner's check (P60). No screen layout or crop changes are intended.

## Delivery

Pending final checks, protected merge, production deployment verification and the program queue closeout.
