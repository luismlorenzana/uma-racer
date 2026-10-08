# Uma Puzzles mobile battle — synthetic browser proof (T113 / D276)

2026-10-08. This is **desktop in-app-browser proof at phone viewport sizes**, not an iPhone test, private PAD acceptance
or enabled production gameplay. Both release capabilities remain off. No owner save, private roster, content publish,
account bank preparation or cutover was used. T109 permitted originals remain owner-pinned; T114–T116 remain.

## What the proof runs

The DEV-only `/dev/puzzles-battle-proof/{start,mid,phase,win,loss}` cases use the real T111 host, journal and receipt
transactions against separate `puzzle-proof-t113-<case>-v1` databases (phase uses v2), invented outfits and original
illustrations. They retain pending receipts across refresh, so reopening win does not reserve another encounter.
Fixture levels deliberately exercise screen/receipt states, not balance: PL30 start/mid/win, PL20 phase and PL10 loss.
Production requires held verified monster art and has no rewarded generic-art fallback.

- Start/mid: three living foes, exact HP/countdowns/next mitigated hits, 6×5 board, five active portraits and thumb controls.
- Active: detail opens before confirmation; an unready/no-effect cast stays unavailable. No cast from a portrait tap.
- Phase: a real engine-triggered champion phase (turn5, party HP4173/6920, foe HP1171/9618, next hit3866/countdown1).
- Win: five drags, 14 combos, 9642 damage, HP6168; **each of five entrants +71 EXP**, PL30 stays30 with carry10→81.
  Front/URA material receipt is **12 gross / 7 repaid / 5 Items**. Refresh reopens the same pending receipt/summary.
- Loss: HP zero after four no-match drags; all five zero-EXP rows, no materials, earlier progression retained.
- Guide/legend: contextual drag page on first paint, illustrated eight-page guide, one Wood green and distinct pink Heart.

## Screenshots

All portraits/monsters here are invented original DEV graphics, not imported Uma/PAD art.
Battle has no page scroll; result/guide sheets intentionally scroll.

| State | 390×844 | 375×667 |
|---|---|---|
| Start | [PNG](puzzle-battle/start-390x844.png) | [PNG](puzzle-battle/start-375x667.png) |
| Mid-run, three foes | [PNG](puzzle-battle/mid-390x844.png) | [PNG](puzzle-battle/mid-375x667.png) |
| Active preview | [PNG](puzzle-battle/active-390x844.png) | [PNG](puzzle-battle/active-375x667.png) |
| Actual phase | [PNG](puzzle-battle/phase-390x844.png) | [PNG](puzzle-battle/phase-375x667.png) |
| Matchups | [PNG](puzzle-battle/legend-390x844.png) | [PNG](puzzle-battle/legend-375x667.png) |
| Illustrated guide | [PNG](puzzle-battle/guide-390x844.png) | [PNG](puzzle-battle/guide-375x667.png) |
| Saved win / EXP | [PNG](puzzle-battle/win-390x844.png) | [PNG](puzzle-battle/win-375x667.png) |
| Debt / net Items | [PNG](puzzle-battle/win-debt-390x844.png) | [PNG](puzzle-battle/win-debt-375x667.png) |
| Saved loss | [PNG](puzzle-battle/loss-390x844.png) | [PNG](puzzle-battle/loss-375x667.png) |

## Interaction and performance observations

At375×667 the battle document's height equals667; at390×844 it equals844. Non-board buttons are at least44pt and
the board retains about58/61pt cells. Decorative monster height yields first. Native browser diagonal drags advance
one accepted turn each, and one DOM turn announcement appears after resolution. Rotation to844×390 displays
`Continue in portrait`; returning restores the accepted turn/HP, not a new board. Public `/puzzles/practice` shows
the release-unavailable message without account/auth/content boot; crossing practice/account routes is a full
document navigation to recreate the appropriate provider tree.

DEV renderer metrics exposed on the scene's DOM host report30 pooled tokens,36 particles and8 labels. Repeated
native drag/resolution preview samples at375×667 recorded24 pointer samples, maximum handler time about0.30ms and
a rolling180-frame p95 about8.8–10.3ms. These are unthrottled desktop-browser observations over short drags, **not**
sustained physical-touch,60/120Hz, low-power, GPU-memory or finger-occlusion evidence. The owner protocol remains T116.
No latency promise or balance closure follows from these numbers.

Production build measurements (individual gzip chunks, not a summed Pixi dependency graph):

| Chunk | gzip KB |
|---|---:|
| Startup entry | 153.10 |
| Puzzle Hub | 1.66 |
| Puzzle map | 5.57 |
| Puzzle battle / shared DOM results | 8.38 |
| Puzzle Pixi scene | 5.10 |
| Shared Pixi entry | 85.30 |
| WebGL renderer | 19.60 |
| Canvas renderer | 5.98 |

Pixi is imported only by the lazy scene loader, never startup. DEV proof/practice fixture strings are absent from
production chunks; the public practice component is capability-gated. Startup remains below180KB gzip.

## Automated evidence and remaining gates

`pnpm lint`, `pnpm test` (**1403 tests across six packages**) and `pnpm build` pass.
37 new tests cover pure geometry/controller, actual native scene listeners, real isolated Dexie session sequencing
and DOM guide/result/practice isolation. Tests cover first-swap timing, expiry/no-swap, skipped/diagonal/revisited/edge
paths, second pointer/capture cancel, interrupted append/restore/disposal, Strict Mode, stale epochs, exact grants
and debt, and visual/reduced-motion action independence. Invented drag replay hash: `f8e3005a8dc47b16`.

`pnpm sim:puzzles` passes600 campaign battles plus the existing exact regression/hash envelope. No combat math changed
and known T116 balance gaps remain. `pnpm sim:spark` before/after geometry extraction is **byte-identical**.
`pnpm sim:training -- --content=/Users/luismartinez/workspace/uma-racer/content/data` passes using existing ignored
local packs:240 seeds per row; foundation93/78/74% and scenario twists77–84%, all existing bands. Only aggregate rates
were inspected, no content rows/art committed.

Not closed here: permitted real PAD art/input/import/publish (T109), material/CL menus (T114), preservation/retirement
(T115), enabled account migration/production Home loop/balance tuning and owner's physical-iPhone acceptance (T116).
Pointer gameplay has accessible HUD/guide/practice, **not** a keyboard or alternate non-drag assist.
