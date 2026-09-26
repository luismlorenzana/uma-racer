# T074 — Spark Rival balance and device closure

**Goal:** turn the complete Rival Circuit into a shippable daily game: tune the fourteen-scenario matrix, finish feedback
and accessibility, profile the installed iPhone, publish/verify private rosters and close every M022 acceptance item.

Depends on merged T073 and the authored T072 pack. Read [M022](M022-spark-rival-circuit.md),
[Minigames](../design/minigames.md#spark-match--rival-circuit), [UX](../design/ux.md#spark-match--rival-circuit), D169–D172
and [Game-like Web Tech](../research/game-web-tech.md). Branch from current `main`; open a PR; never push to `main`.

## Rule for tuning changes

Do not silently tweak constants while polishing. Any changed board size, timer, turn bound, ticket cost, advantage,
aptitude, damage, recovery, gauge, rival or EXP number updates all of:

1. `docs/design/minigames.md`;
2. the matching pin in `packages/domain/src/domain.test.ts`;
3. an appended decision row explaining the measured reason;
4. `pnpm sim:spark` expected ranges/fixtures.

The 6 × 5 board, one ticket, four-strategy ring, three waves, partial loss EXP, private roster boundary and authoritative
replay are product choices, not tuning knobs. Escalate rather than changing them in this task.

## Balance closure

Run at least 1,000 fixed seeds per matrix row (more where confidence bands overlap a gate). The checked simulator report
covers all fourteen tiers, TL 1–9, all four trainee best strategies, every rival recipe, low/average/high strategy aptitude
profiles and each loss reason. Keep a concise row set in normal output and a `--full` table for diagnosis.

Final targets for the planner agent:

| Measure | Acceptance band |
|---|---|
| Overall three-wave clear rate | 65–85% |
| Any tier/TL/style clear rate | 55–90%, or documented intentional boss outlier |
| Median competent clear EXP | 2,100–2,300 |
| TL1→10 path | median 9–12 clears; no more than 15 paid runs at p90 |
| Loss reward | less than 45% of same-row clear median; zero for zero progress |
| Wave length | median 4–7 drags; p90 never exceeds the eight-turn bound |
| Drive at clear | median 15–65%; neither Recovery-irrelevant nor full almost always |
| Spark Shift | used in 25–75% of planner clears; never mandatory in every row |
| Strategy fairness | no best strategy is >10 percentage points above every other across the whole matrix |
| Recipe fairness | no ordinary recipe is harder than the boss recipe in the same tier/TL band |

The random agent may lose heavily; it is a smoke floor. The greedy agent should improve materially over random and trail the
planner, proving visible intent and setup matter. Report confidence interval or sample count with rates, not only rounded
percentages.

Add adversarial simulation for: healing stall, deliberate no-match paths, farming damage then losing, Shift hoarding,
disadvantaged-orb-only play and repeated conversion pressure. None may create more EXP/ticket than competent clearing or an
unbounded run. Check that every seeded encounter terminates within action/journal bounds.

## Visual and interaction finish

Use existing private Uma art through the content runtime and existing app visual tokens. No original image enters git.

- Rival arrival: wave label, portrait/bust, strategy glyph and Resolve establish before the board enables.
- Orbs: distinct silhouette/glyph plus colour, crisp at capped DPR, visible held/source states and no aliasing shimmer while
  dragged. Recovery and Spark are unmistakable at a glance.
- Path: displaced orbs settle continuously; quick reversals and revisits do not snap or leave duplicate sprites.
- Resolution: match outline → clear → fall/cascade → attack/recovery/charge → rival intent. One combo counter owns
  the whole turn and never races damage text.
- Combat: short style-specific trail/glyph, bounded impact, readable integer damage and a clear weakness/resistance cue.
  Resolve/Drive use both meter motion and text; no screen shake is required to understand an attack.
- Wave/boss: a short transition that does not reset board/Drive/Spark visually; boss treatment is emphasis, not a blocking
  movie. Skip/reduced motion reaches the identical ready state.
- Terminal/result: loss is respectful and progress-forward; clear has the strongest celebration. EXP fill, crossed levels
  and opened nodes serialize without overlap, and Skip reveals every same fact.
- Loading/failure: art falls back to icon/silhouette; fallback roster displays a dev diagnostic but remains presentable;
  journal/content/save errors have actionable Retry/Return copy and never show a blank canvas.

All particles/sprites/damage labels come from bounded pools. Define and test maximum live counts. The debug overlay reports
FPS/frame time, active/pooled objects, action count, engine state hash, content source and renderer pause state without
printing private ids.

## Sound, motion and comfort

Wire the existing feedback service for drag ticks (rate-limited), match tones, attack/pressure, recovery, Shift, wave clear,
loss, circuit clear and TL-up. If the repository has no suitable licensed/local sound asset, land semantic cues with the
service muted/fallback-safe and record asset production as M009/T036 work; do not download or commit original-game audio.

- Respect global sound, haptic and reduced-motion settings. Haptics are progressive enhancement and may be unavailable on
  iOS; visual/audio feedback remains complete.
- Reduced motion removes screen shake, long trails and decorative particles; it keeps match/clear/fall ordering, meter
  changes, state glyphs and announcements.
- A hidden tab stops the Pixi ticker and movement clock. Resume cancels an uncommitted drag, reloads the action boundary and
  never spends elapsed background time.
- Orientation change or viewport resize outside a drag rebuilds layout without game-state change; during a drag it cancels
  safely. Portrait is supported; accidental landscape shows an intentional rotate/continue-safe treatment.

## Accessibility

- Strategy/orb/rival state uses glyph, short label and colour; contrast meets the app's AA target.
- DOM controls and result links are keyboard/focus usable and at least 44 pt. Focus never falls behind the canvas.
- One polite live region announces wave start, intent changes, turn outcome and terminal result without narrating every
  pointer cell. Damage bursts themselves are `aria-hidden`.
- Tutorial and help expose the advantage ring in text. The spatial drag is honestly identified as a touch/pointer mechanic;
  do not claim a false fully keyboard-playable board.
- Dynamic text at the owner's iPhone accessibility sizes cannot obscure gauges or the board; allow the HUD/result to adapt
  while keeping the active run page scroll locked.
- VoiceOver can reach Leave/Pause, help, Shift, gauges/intent summary and result actions in a coherent order.

## Physical-device protocol

Test the installed/Home Screen app on the owner's iPhone at normal and reduced motion, and on browser emulation at
390 × 844 plus 375 × 667. Record device/iOS/app/content versions without private ids.

1. Cold launch, open Training, start a paid authored run and verify one ticket charge.
2. Drag slowly through every direction; rapidly cross several cells; reverse; revisit; touch with a second finger; start
   near each board edge; release outside canvas; trigger system interruption/pointer cancellation.
3. Background mid-drag (no action), background after a resolved action (exact resume), hard refresh during wave 2, and
   kill/reopen the Home Screen app. Compare action count/state hash.
4. Trigger cascade, weakness, resistance, Recovery, Spark Shift, every intent, wave clear, Drive loss, turn-limit loss and
   full clear. Use deterministic dev fixtures where production content would make a state slow to reach.
5. Commit a partial loss and clear, retry result save/navigation, open every new node link, run again, and verify no double
   EXP/ledger/reward after reload.
6. Repeat offline from verified cached content; test missing optional rival pack fallback in local/dev without altering the
   production manifest.
7. Run VoiceOver/control focus, reduced motion, large text and silent mode checks.

During a 30-second worst-case cascade/attack trace on the owner device:

- target stable 60 fps, with p95 frame interval ≤20 ms and no repeated >50 ms long frames attributable to the scene;
- first visible held-orb response occurs within one presented frame of `pointermove` under normal load;
- no React commit occurs per pointer sample;
- sprite/effect pool totals plateau after warm-up and return to baseline after each resolution;
- no timer advances while hidden, and 120 Hz devices use extra presentation frames without changing action/reward hashes.

If Safari tooling cannot produce an exact percentile, record a screen capture plus debug-overlay min/median/p95 sample from
the app. A failed budget is fixed or explicitly brought to the owner; it is not waived in the PR.

## Content and release closure

- Run the private importer and verify aggregate 14/14 authored coverage with no row-level log.
- After the code prerequisite is deployed, publish through the existing manifest-last runbook and sign in to verify the
  active content version contains `spark-rivals` with authenticated integrity.
- Verify offline reload after one successful authenticated fetch and verify the fallback against a synthetic/old manifest.
- Do not edit `.github/workflows/`, `infra/`, Firebase config, env files or API Dockerfile.

## Regression and acceptance

- Run `pnpm sim:spark -- --full`, `pnpm sim:constellation`, `pnpm sim:careers`, `pnpm lint`, `pnpm test` and `pnpm build`.
- Startup stays ≤ 180 KB gzip; record Spark lazy chunk size. Compare before/after trace and bundle output in the PR.
- Bond Recall, race Pixi scene, service-worker update deferral, content diagnostics, offline startup and sync tests remain
  green. An open Spark run continues to defer silent app restart.
- Attach 390 × 844 screenshots of mid-drag, cascade/attack, boss intent, partial-loss result and clear/node result. Attach
  one physical-device capture or the owner's explicit validation note.
- Update minigame/UX/architecture docs with final measured constants and remove T074 plus M022/T071–T073 specs under D104
  only when the implementation PR completes the milestone. `docs/tasks/README.md` then marks M020 next.

## Out of scope

Friendship Training, new original-game art/audio, multiplayer/leaderboards, cloud in-progress sync, landscape gameplay,
new currencies/rewards, support-card combat, additional rival intents and unrelated visual-system work.
