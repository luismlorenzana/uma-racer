# T107 — Deterministic five-Uma puzzle battle engine

**Depends on T106.** Read [design §5](../design/uma-puzzles.md),
[implementation §§1, 4–5](../technical/uma-puzzles-implementation.md) and Minigame kit before touching an engine.
One PR from latest main; no rendering/save/content publication.

## Deliverable

In `packages/domain/src/minigames/uma-puzzles/`, implement version-1 battle inputs/actions/state/parsers, board
construction and resolution, combat, finite skill/leader recipes, replay/hash, typed presentation events and bots.
Add a modest `scripts/sim/puzzles-combat.ts` plus `pnpm sim:puzzles` entry (T108 extends it). Use synthetic fixtures.
Shared board/path extraction is allowed only with before/after Spark hashes and sim outputs matching exactly.

## Board and replay

- 6×5 cells; Fire/Water/Wood/Light/Dark/Heart, seeded opening board with five each and no starting match. Named
  independent streams for opening, refill and conversions. Creation is bounded and deterministic; failure is an error.
- Held swaps are orthogonal/diagonal adjacent, include revisits, accept 2…256 positions and 0…7,000 ms. No-transition
  release is not an action. A moved zero-match drag consumes one turn. Reject invalid cell/jumps/NaN/overlong actions
  before advancing state or RNG. Skipped-pointer interpolation is a separately testable generic presentation helper.
- Match horizontal/vertical qualifying lines ≥3; union only qualified cells through same-kind orthogonal connectivity.
  Touching unmatched tails stay on board. Clear simultaneously, gravity per column, uniform seeded refill, cascade
  until stable within 64 passes. Each cascade's groups/events are ordered canonically and unique cells count once.
- Canonical state hash covers all rule state/RNG cursors. JSON-roundtrip replay must match every intermediate hash,
  not just outcome. Actions are drag/use-active/abandon; expected-count journaling is T111, but action parsers already
  enforce the complete 181-action transport bound derived in the implementation contract.

## Combat order and rounding

Use the design's candidate ATK/shape/combo/matchup/DEF/heal formulas, five-orb AoE, shared HP/RCV and mitigations.
Freeze focus per drag; default/retarget is lowest countdown then formation index. Damage iterates attack element,
party slot, resolved group and formation target in a documented stable order. Pattern bonus is at most one per group.
Hearts contribute to combo count and heal before attacks; cap HP. No unmatched Uma attack, divided AoE, corpse hit or
late heal after death. Enemy attacks use displayed values, not party-element average resistance.

Then phase-check surviving enemies once, tick countdowns, execute due intents in formation order, stop on death,
tick statuses/charge once per drag and publish next intent. Win on drag30 beats turn-limit loss; zero HP is terminal.
Retarget and guard/phase changes are engine events, never renderer decisions. No chapter-wide HP attrition.

## Finite first-release kit — close the catalogue in this PR

Author stable skill ids and a data table, not conditionals scattered in UI. The initial catalogue is bounded:

| Unlock | Available choices / behavior |
|---|---|
| PL1 | One equipped active from original-A archetypes: Front converts up to4 non-Heart off-colour cells, charge5; Pace next incoming-turn 35% shield, charge6; Late converts up to6 non-Heart off-colour cells, charge6; End delays focused foe1 step, charge7 |
| PL1 | One leader passive: four-combo party ATK×1.2; durable party HP×1.15; recovery RCV×1.2; only slot1 supplies it |
| PL5 | Four-orb single-target specialist pattern×1.25 may be equipped |
| PL10 | Six-cell full-row mass specialist pattern×1.25 may be equipped instead; one pattern, no stacking |

These are the accepted starting coefficients, to be tested/pinned rather than reported as tuned. Include exact
unlock/default/equip validation in the domain. Slots do not stack every ten levels. Later burst/Heart-creation/
row-conversion/cleanse variants and higher-band choices require published finite skill rows before becoming rewards;
do not display an empty “new choice” every ten levels or invent infinite passive/cooldown upgrades. Document the
initial table and the higher-band expansion boundary in the design. Lifetime PL/stat progression continues above10.

Skills start uncharged; charge once per accepted drag and reset on use. Once per member between drags; no charge on
conversion/target/animation. Conversions select eligible cells from a named stream and never remove Heart or auto-clear.
Shield percentages do not add across five Pace actives: strongest wins, next damaging enemy phase consumes it, and
all attacks in that phase are covered. Publish this timing before use. Delay rejects immune/already-delayed-before-
its-next-action foes without consuming charge; clear that foe's delay marker when it executes an intent. No infinite
repeated delay through multiple members. Abandon is terminal and does not pay.

## Enemy recipe reducer

Implement Striker, ally-Healer, one-turn 50% Guard with visible combo bypass, bounded Converter, Combo Ward and a
single warned below-50%-HP Rage phase. Stable semantic recipe ids, no original PAD stats/scripts/names. Healer chooses
lowest proportional-HP living ally, formation tie-break, excluding itself; no ally is a visible no-op. Converter
previews which kinds/count are affected, uses a separate stream, and does not clear its new board automatically.
Guard/ward thresholds/durations and rage attack/countdown must be explicit parsed recipe parameters and have fixtures.
Freeze reward identity before any phase changes. Opening ordinary ≤1 special mechanic, guardian ≤2, champion phased.
Hazard state must not be a half-implemented feature: poison/jammer/locks/colour ward remain deferred until separately
authored. Parser rejects unsupported recipes rather than applying a generic attack fallback.

## Tests and focused sim

Test every elemental pairing; group overlap/disjoint/tail/cascade/gravity ordering; count-five AoE versus separate
threes; HP cap; death before enemy phase; enemy simultaneous countdown ordering; dead support/retarget; guard/ward
bypass; exactly-at/below rage threshold; delay/no-op rejection; nonstacking shield; charges; drag30 victory/loss;
abandon; malformed/future data and bounds. Pin at least two full fixed-seed action journals with intermediate hashes,
one containing active use, Hearts, targeting and a boss phase. Test named-stream independence and forbidden imports.

Bots only use public actions. Start a modest documented fixed-seed sample, with novice/competent routing and basic,
mixed Light/Dark, mono and starter-shaped **synthetic** parties. Report clear rate, accepted drags, ending HP, Heart
use, active use and terminal reasons. Use design bands as tuning targets; T108 adds authored chapter-level scaling.
Do not spend weeks optimizing a bot or call an engine-only sample proof of production balance.

## Acceptance

Pure engine version1 replays deterministically and supplies enough ordered events for T113 to animate without
deciding hits or rewards. Exact skill/intent durations, rounding and table are in living docs. All executable constants
have domain pins; new decision and sim envelope explain any departures from starting candidates.
Run lint/test/build + sim:puzzles; shared Spark utility changes also pass sim:spark and fixed legacy hashes. Report
startup gzip. Delete spec, update M030/index/kit planned notes. No save fields, private cast, screen or live Spark removal.
