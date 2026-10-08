# Uma Puzzles setup/navigation phone-size proof

T112 / D275, recorded 2026-10-07–08. This is **browser layout and behavior evidence**, not a physical iPhone,
private PAD import, playable battle, owner-account cutover or production release sign-off.

## Safe reproduction

From the repository worktree, run `pnpm --filter @racer/web dev --host 127.0.0.1 --port 5175 --strictPort` and open
`http://127.0.0.1:5175/dev/puzzles-ui-proof`. Use an explicit 390×844 viewport; repeat at 375×667. Nested URLs
also boot this isolated root on refresh. Its native **Exit** reloads the ordinary app; do not use Exit while
testing isolation if you do not want the normal sign-in/content boot.

The root bypasses normal auth, content, GameRuntime and service-worker boot. It uses the real T111 host,
the separate device-local `puzzle-proof-t112-ui-v1` database, invented outfits/enemies/original SVG portraits
and an in-memory synthetic authority. It does not call an API, load private rows or touch an owner save.
Its fixtures include five party presets, an empty preset, separate chapter checkpoints, an open encounter
owned by another device, pre-entry enrollment choices and a −7 Front-ticket balance in URA Finale.
Pending canonical bases survive refresh, so refreshing the proof is not authority to double-apply edits.

## Observed checks

- Hub exposes Parties, Roster, Chapters, Exchange and Items, with actual saved presets and a named Resume.
- Roster is five icons across, enrolled-first, with element/PL overlays and source-A/colour filters. An unenrolled
  outfit opens an explicit palette confirmation; advice never selects a colour or enables confirmation by itself.
- Party editor shows ordered slots, leader, finite kits and partial shared-stat totals. Its picker excludes assigned
  outfits by default; moving from another party is a separate, named source/destination confirmation.
- All fourteen chapters remain independent of racing ownership. Map contains all 28 nodes and exact guaranteed
  ticket quantities; three Guardians precede the five Champions. Won nodes are visibly replayable.
- Enemy preview holds content, shows concrete HP/intents/phase/weakness and gross/repayment/net. The Fire Champion
  in the seeded chapter shows **12 gross, 7 repaid, 5 inventory**. Dark Champion requires an explicit Pace/Late choice.
- The foreign-device Resume opens read-only recovery with its frozen identity/epoch and an explicit online takeover
  confirmation. It does not reserve a replacement. Real takeover/refresh/journal behavior is additionally automated.
- DEV Begin reports that nothing was reserved or rewarded; it never calls `begin`. T113 owns the playable board.
- At both sizes the fixed shell and internal scrolling retain navigation, modal close and thumb-zone actions. The
  short viewport scrolls the preview internally to reach rewards/Begin. Measured roster and preview controls are
  at least 44 CSS px and document width does not overflow the viewport. No battle timing claim is made here.

Automated component/presentation tests also cover off-flag gating before account/content I/O, enrollment,
profile lock, independent checkpoint selection, retained transfer revisions, open/stale transfer rejection,
true journal Resume, same-seed takeover, pending-edit refresh and account-selector isolation from journal appends.

## Screenshots

All art and names below are synthetic and safe to keep in Git. These are viewport captures, not full-page images.

| Screen | 390×844 | 375×667 |
|---|---|---|
| Hub | [Hub](puzzle-navigation/hub-390x844.jpg) | [Hub](puzzle-navigation/hub-375x667.jpg) |
| Roster | [Roster](puzzle-navigation/roster-390x844.jpg) | [Roster](puzzle-navigation/roster-375x667.jpg) |
| Party editor | [Editor](puzzle-navigation/editor-390x844.jpg) | [Editor](puzzle-navigation/editor-375x667.jpg) |
| Chapter map | [Opening path](puzzle-navigation/map-390x844.jpg) | [Finals path](puzzle-navigation/map-375x667.jpg) |
| Enemy preview | [Fire Champion and debt estimate](puzzle-navigation/preview-390x844.jpg) | [Scrollable Fire Champion preview](puzzle-navigation/preview-375x667.jpg) |

## Remaining acceptance

Local verification: `pnpm lint`, `pnpm test` (1,366 tests), `pnpm build` and `pnpm sim:puzzles` pass. Simulations
cover 288 engine battles, 600 campaign battles and 86,016 economy routes without changing pinned replay/regression
outputs; existing release-balance outliers remain open. Node 25's actual entry gzip is **152,873 bytes** (≤180,000),
Hub **1,634**, map **5,478**, existing Pixi core **85,300** and Spark screen **17,969** bytes, all lazy except the entry.
No Puzzle battle chunk exists until T113. These are individual chunks, not total downloaded sizes; setup also shares
the host/context/presentation modules. Production contains no isolated-proof namespace or fixture source strings.

T113 supplies touch gameplay/results/practice; T114 supplies real Exchange/Items destinations. Both release flags
remain false, Spark stays live and Home has no Puzzle entry. Permitted PAD originals/evidence are still the owner's
pinned T109 follow-up. T116 must verify the actual iPhone, private content, balance, migration/recovery and release
protocol before any live cutover. See [M030](../tasks/M030-uma-puzzles.md) and the
[implemented navigation contract](../technical/uma-puzzles-implementation.md#t112-implemented-setup-navigation-d275).
