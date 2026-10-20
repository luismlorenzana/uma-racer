# SC5 local acceptance

The work engine is `uma-work` 0.1.0; work UI is `uma-kit/work` 0.9.1 (platform P64). No Simulator, private data in git,
infrastructure changes or owner-save writes. Local Vite used the external SC5 worktree on port 5196 and synthetic
`/dev/seeds/` accounts. RPG compatibility used an isolated unmodified main worktree, API 8098/web 5198; no RPG pin or
SC4 implementation is part of SC5.

## Automated checks

- `pnpm lint`, `pnpm test`, `pnpm test:ci`, `pnpm build` pass on the published pin, rebased over SE4 (`ad15cf0`).
  Domain: 961 tests; web: 527 tests; API: 58; race: 61; overlays: 2, plus the startup-check script's tests.
- All original domain regressions retained. Save tests preserve frozen plans/progress/clock across the EXP and
  dropped-refusal field migration; ambiguous fields are rejected. Building table/order and capped credited EXP pinned.
- Real-port UI matrix covers all ten Farm buildings: start, queue three, recall/drop preview, speed/finish,
  collect-and-repeat, and upgrade. Existing Training, check-in, Speed Up All and planner suites remain.
- Operation callback regressions cover stale ticket quotes, no purchase after finish/recall, queue limits/removal and
  whole-queue restart in an alternate free slot. Kit tests cover default/overridden restart and shared pending lock.
- `pnpm sim:loop`: all nine D375 pacing guards pass unchanged. Startup JS is 155.98 KB gzip (180 KB limit), one
  initial static chunk. Both games' candidate checks also pass; existing RPG startup is 213.80 KB (230 KB limit).

## Local browser

- Synthetic Farm pages: all ten show the shared slot rows, correct per-building slot count and upgrade control,
  including Kitchen's six slots at Lv 1; no horizontal page overflow at phone width.
- Fields: start, queue three, full-queue message, recall preview and actual recall through the real game port.
- At 375×667/light, every Farm page and all four Training facilities render shared rows with `scrollWidth` equal to
  the viewport (375); Observatory/Lineage Hall have two rows each, Gym five rooms, Dojo six. At 390×844/dark, check-in,
  stopped cards and Speed Up All also stay within the viewport. The Farm's Fishery peek shows the shared compact rows.
- Observatory: collect a completed session, open the unchanged game-owned authoring/picker, choose a free Uma,
  start two unlocks, inspect the shared recall returning two tonics, and recall successfully.
- Stopped seed at 13:05: three recovery cards show exact shortfalls without duplicated words; Start ×6 removes
  Opal Breeze's stopped card and restores her Pantry job. Speed Up All's confirmation spends exactly 9 tickets
  (12 → 3) and reports it. Best use's buy-and-finish confirms 4 tickets/120 Prize Money, finishes that entry, leaves
  zero tickets and changes Prize Money 2,394 → 2,274. No owner saves involved.
- Enabled Start uses gold accent background with accent ink (dark computed RGB 214/162/62 and 27/20/6); no competing
  panel class. RPG's existing shared Stable still renders/searches its loaded faces at 390px with no page overflow.

Production status and final command totals are added after protected merge and the standard deployment succeeds.

Upstream compatibility fixes: [platform #39](https://github.com/luismlorenzana/uma-platform/pull/39), merged
`18abccf`; [uma-kit 0.9.1 publishing succeeded](https://github.com/luismlorenzana/uma-platform/actions/runs/39459898913),
and the version was verified in GitHub Packages before Racer installed it normally. No copied build or link remains.
