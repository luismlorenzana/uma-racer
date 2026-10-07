# T113 — Mobile Pixi battle, visible rewards and contextual guide

**Depends on T112 and the real T111 host.** Read design §§5,9 and Minigame kit; use the implementation contract §§4–7,9.
One PR. This implements the playable screen but does not enable the account cutover or production Home launch.

## Battle stage contract

Lazy battle screen under `screens/puzzles/`, Pixi scene under `scenes/puzzles/`. DOM owns header/back/guide, HP, status,
five portrait actives, target intent sheets and result actions. Pixi owns monster reactions, board/pointer and pooled
effects. No React rerender per pointer sample; renderer animates events the engine already decided. No fake host in
production, direct save writes, per-frame rule math or random effects that consume engine streams.

At 390×844 and 375×667 fit header + three-foe stage + HP + five actives + 6×5 board + thumb controls with **no fight
page scroll**. Reduce decorative foe height first. Every non-board action ≥44 pt. Safe areas padded once by shell;
board hit regions must map correctly with browser zoom/safe-area/viewport changes. Portraits show element, charge and
selected skill; ready activation opens clear preview/confirm, not accidental cast on detail tap.

## Touch controller acceptance

Reuse/extract proven Spark drag geometry and pointer capture, not its old Drive/Resolve UI or reward path. One pointer
owns a lifted held orb; interpolate skipped cells and diagonal crossings consistently; revisit allowed. First valid
transition starts the monotonic7s clock, holding still first does not. Pointer release or expiry produces one bounded
drag with target frozen at start. Release without transition cancels. Second pointer cannot alter it.

Background, viewport/orientation change, lost capture, browser pointercancel, navigation or guide opening cancels
unaccepted gesture and restores authoritative board/seed without append. Unsupported landscape shows a continue-safe
portrait prompt. On resume reload journal before enabling input. Await append success before resolution animation;
append conflict/error restores authoritative state with Retry/Return. Lock input while saving, animating or committing.
RNG/results cannot depend on animation speed/60vs120Hz. Hidden ticker pauses; effects use elapsed delta, transform/
opacity only, pooled sprites and reduced-motion immediate but readable state changes.

## Combat feedback and controls

Use actual privately verified PAD enemies, art/element/HP/countdown/next mitigated hit and target mark. Focus is free
between drags; default target and retarget animation come from engine. Show phase warning, ward/guard/immunity and
duration in plain short labels. Make five-orb mass attack, combo count, Heart heal, shield absorption and active charge
visible without cluttering every cell. One DOM live-region announcement per resolved turn, no narration per frame.
Colour + glyph + accessible name; Matchups legend always reachable. Avoid a second green colour.

Chibi board uses held private Uma art as a frozen **display-only** join with element ring/glyph; Heart is pink and
distinct. Plain-orb visual preference offers comparison/reduced clutter without changing input/state/seed/hash.
Enemy art remains monsters, not old rivals. No unsupported control-accessibility claim: drag remains a pointer mode;
accessible HUD/guide and isolated practice are required, non-drag assist is deferred.

## Result, resume and saving

Terminal result shows clear/loss, combo/damage summary, each entrant's exact EXP/before-after PL/stat deltas and newly
unlocked **authored** kit choices, even if no full level crossed. Material table is gross→repaid→Items, by real scenario/
style, with pending/synced correction when needed. Loss/abandon explains zero reward and preserves prior progress.
Continue map/Replay/Items; Replay is a new attempt only after previous terminal receipt is saved. No auto-CL spend.
After refresh reopen original result receipt; never award from animation or call commit with a UI quantity.
Foreign/missing journal uses T111 explicit takeover; error state does not silently reset or delete history.

## Guide and isolated practice

One illustrated eight-page `PagedGuide`/`createGuideMemory`: global levels; drag/clock; combos/cascades/AoE; elemental
graph; HP/Heart/target/countdown; actives/one leader; map/repeated loot; styles/debt/exchange/CL spend. All numbers and
unlocks read domain rules/table, with copy regression test. Auto-open once before first enrollment/entry; Hub and battle
open relevant `startAt` page immediately. Storage failure remains usable. Guide opening cannot spend/reserve/advance.
Practice uses synthetic standalone input, no account host/auth/EXP/Items/Dexie account writes. Use real components,
not a static tutorial pretending to teach touch behavior. Retain old game's guide until retirement.

## Verification

Unit/presentation/pointer tests: cell mapping at both sizes, skipped/edge/fast/revisited/diagonal paths, timer start/
expiry/no-transition cancel, pointer capture/multi-touch/background/orientation cancel; same hash for chibi/plain and
reduced motion; append rejection/input lock/restore; result derived from receipt including debt; stale epoch recovery;
guide memory/context/practice isolation. Replay fixtures match domain hashes, not visual inference.

Capture both sizes for start, mid-run three-foe board, active preview, phase/legend, win/debt result, loss and guide.
Profile browser sustained drag/resolution and lazy loading; report observations, not invented iPhone latency. Run
lint/test/build + sim:puzzles + sim:spark if controller utilities changed, with legacy hash equivalence. Report startup,
battle/map and Pixi gzip chunks. Physical phone60/120Hz/low-power checks remain owner protocol in T116, not silently passed.

Update living visual/guide/kit contracts, delete spec/update M030/index. No paid entry/continues, hazard catalogue,
dual elements, content publish, new RPG mechanics, profile training removal or enabled cutover in this task.
