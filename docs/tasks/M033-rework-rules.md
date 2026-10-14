# M033 — The rework's rules and the loop simulation

**Re-architecture phase 2** ([08](../rearchitecture/08-phases.md), [rework/13](../rework/13-removals-and-plan-changes.md) §4).
**State: specified 2026-10-14 (D339); implementation not started.**

## Outcome

Every rule of the [game rework](../rework/README.md) exists as a pure, tested module in `@racer/domain`, and
`pnpm sim:loop` proves [D334's pacing](../rework/12-economy-and-pacing.md) in CI. **The live game is untouched:** no
UI, no save change, and no change to what today's modules do. Phase 3 builds the generation-2 save and the new
screens on these modules, and wipes into them once (D335).

## Read first

- [AGENTS.md](../../AGENTS.md); this page; the rework [README](../rework/README.md) (shared numbers, glossary) and the
  pages each task names.
- Decisions D326–D339, in particular D336 (the owner's review) and D338 (the Gym and the time factor).
- [rearchitecture/01](../rearchitecture/01-target-architecture.md) §3 for where the domain package is going, and
  [rework/13](../rework/13-removals-and-plan-changes.md) §2 and §6 for what is kept and the save the rules must fit.

## Fixed choices (every task)

- **Where.** New modules live in `packages/domain/src/rework/<area>/` and are exported lazily as
  `@racer/domain/rework/<area>`: one pattern entry `"./rework/*"` in `packages/domain/package.json`, with the
  `require` (built `dist/cjs`) and `default` (source) conditions of the existing entries. Phase 3 moves them to their
  final homes when today's modules are deleted. Until then nothing in `apps/web` or `apps/api` imports them; only
  `rework/` itself, `scripts/sim` and the docs renderer do.
- **Pure.** No I/O, `Date.now`, `Math.random`, React, Dexie or browser globals. Time is passed in as `now`
  (integer milliseconds since the epoch). Randomness, where a rule needs it, takes the seeded RNG the race engine
  uses.
- **Durations are integer seconds.** Every duration is the rework's base minutes × **the time factor `TIME_FACTOR`
  (1.2, D338)** × 60, rounded to a whole second once, then divided by a building's speed and rounded once more.
  `TIME_FACTOR` is one exported constant in `rework/time.ts`; nothing else multiplies by 1.2.
- **Reuse, don't copy.** Where the rework says "as today", import today's module: the Racing EXP curve
  (`progression.ts`, D241), careers and goals (`scenario-goals.ts`, `career-stages.ts`), the constellation node
  math (`constellation.ts`: card-type shares, the per-card cap, era percentages), the Inspiration pick rules
  (`lineage.ts`, `inspiration.ts`, without tokens), card focus, scenarios and cap profiles, rivals (`opponents.ts`)
  and the race engine. Where the rework changes a formula (the node value's E term, baseline SP from opened nodes,
  Extra Stats), the new function lives in `rework/` and today's stays as it is for today's game.
- **Numbers.** Every draft number becomes a named constant in the module that owns it, with a comment citing its
  rework page and section. Pinning tests live beside the modules (`rework/**/*.test.ts`), not in `domain.test.ts`,
  which keeps pinning today's game. A number changes only together with its rework page, its pinning test and a
  decision entry (AGENTS.md).
- **Art ids.** Item and dish ids are uma-art's (`items/atlas.json`, `dishes/atlas.json`), except the Duos' own ids
  ([rework/08](../rework/08-item-catalogue-and-recipes.md) §4.3), which map to uma-art frames. `@racer/domain` adds
  `@luismlorenzana/uma-art` 2.4.0 as an exact-pinned **dev** dependency, and a test checks every art id the catalogue
  names against the package's indexes.
- **State, not saves.** Modules take and return plain typed state (`rework/types.ts`) shaped after
  [rework/13](../rework/13-removals-and-plan-changes.md) §6's kinds, so phase 3's save maps onto them one to one. No
  parsers, schema versions, sync or persistence in this milestone.
- **Operations are functions.** Each owner action in rework/13 §6's list (`start`, `queue`, `collect`, `collect-all`,
  `repeat`, `recall`, `speed-up`, `upgrade`, `advance-scenario`, `promote`, `buy`, `sell`, `unlock-uma` and the preset
  edits) is a pure function `(state, input, now) → { state, receipt } | refusal`. Refusals are typed values with
  plain-words reasons ([rework/02](../rework/02-check-ins-and-notifications.md) §9), never thrown strings.
- **Fixtures are synthetic.** Tests and the sim use invented Uma templates and cards (aptitudes, stats, types, eras).
  No master data, names or ids from the private packs.
- **The live manual.** Each task renders the tables it owns as `<!-- live:<key> -->` blocks through
  `packages/domain/src/docs/render.ts`, and puts the blocks **in the rework pages** that state those numbers, so
  the design can't drift from the code. T125 extends `docs.test.ts` to check `docs/rework/*.md` as well as
  `docs/game/*.md`. Phase 3 moves the pages into `docs/game/` as built.

## Tasks

| Task | Builds | Needs | Parallel with |
|---|---|---|---|
| T125 — Tiers and progression ✅ (D340) | The tier map, Racing Level per tier, careers per scenario, advancing, promotion with its resets and carries, Uma Tickets and Shards, tier scaling. Also `rework/types.ts`, `rework/time.ts`, the `./rework/*` export and the docs check over `docs/rework/` | — | T126, T129 |
| T126 — Items and recipes ✅ (D341) | The 8 × 10 catalogue, crafted items, planet dishes, Duos and Feasts, the side rotation, grade gates and work values, checked against uma-art | — | T125, T129 |
| [T127 — Jobs, sessions and the Farm](T127-jobs-sessions-farm.md) | One-after-another work with queues, collect, recall and Speed Tickets; buildings, slots, levels and speed; Farm Level and Farm EXP; the activity rule | T125, T126 | T128, T129 |
| [T128 — The Training Hub and the build](T128-training-hub.md) | The four facilities, the layers, unlock order, dish per unlock, the Extra Stats map and its capacity, bonds and card sets, presets, the reviewed scenario buffs ([04](../rework/04-tiers-and-promotion.md) §8), and stats derived after the rework | T125, T126, T129 | T127 |
| T129 — Constellations re-authored ✅ (D342) | Fourteen silhouettes (the 15th is drawn when it ships) at 12, 16, 20, 24 and 28 card nodes, breadth-first ids, the validator | — | T125, T126 |
| T130 — Prize Money and the Exchange ✅ (D345) | The prize table, the Daily Purse, featured races, Speed Tickets, the Exchange's goods and stock rule, selling | T126 | T127, T128 |
| [T131 — Check-ins and the planner](T131-check-ins-planner.md) | Collect all, Repeat, batch sizing to the next check-in, the planner's targets, needs and suggestions | T127, T128 | T130 |
| T133 — The rework's builds against the field | [rework/03](../rework/03-uma-progression.md) §12 and [05](../rework/05-training-hub.md) §12's balance checks on the new builds: the stamina ladder on the re-authored trees, every career winnable with full-layer builds at all 15 scenarios, and the buffs' typical values re-measured. It also checks the rivals: on the new trees today's `trainedStat` grows faster late in each tier (646 → 728 across tier 1, against today's 650 → 689), because E isn't discounted by the rivals' card factor. New sims beside today's, which stay unchanged. Outlined: its spec is written when T128 lands | T125, T128, T129 | T130–T132 |
| [T132 — `pnpm sim:loop`](T132-sim-loop.md) | The deterministic whole-economy simulation with its policies, variants, report and CI checks; the pacing tables rendered live; the Farm tables in rework/07, /08 and /12 rewritten from its output | T125–T131 | — |

**Order.** T125, T126 and T129 can start at once. T127 and T128 follow; T130 needs only T126. T131 waits for the
work and Training Hub rules. T132 closes the pacing, and T133 the balance of the new builds. Each task is one pull request (or a commit series on
`main` when Claude does it), green before the next that needs it starts.

## Cross-task acceptance

1. **A whole tier, unlocked by the rules.** A test takes one synthetic Uma from tier 1, scenario 1 to promotion by
   applying the operations only: 107 unlocks, each paid with exactly one dish of the right family and grade, every
   layer opened in its scenario, Racing Level 50, a promotion that resets her and carries the account's goods.
2. **Demand matches the design.** The representative deck's dish and crafted-item demand per Uma per tier equals
   [rework/08](../rework/08-item-catalogue-and-recipes.md) §7 (107 dishes, 539 crafted items).
3. **The pacing holds.** `pnpm sim:loop` passes [rework/12](../rework/12-economy-and-pacing.md) §12's checks in CI. If
   it doesn't, tuning follows §11's lever order, and every changed number lands with its page, test and decision.
4. **Nothing live moves.** `pnpm lint && pnpm test && pnpm build` stay green, every existing sim gives the same
   output, the startup budget holds, and `git grep "rework/" apps` finds nothing.
5. **The docs are the code.** Every table the rework pages state that a module owns is a live block, and the docs
   check passes.

## Out of scope

- The generation-2 save, parsers, sync, the wipe and every deletion: phase 3.
- Any screen, scene or place: phases 3 and 6–7.
- World Expeditions' rules, courses and `sim:expeditions`: phase 9. `sim:loop` uses a placeholder Expedition race
  count until then.
- Push notifications: phase 4, if the owner asks.
- Changing today's game, today's modules or their pinned numbers.
