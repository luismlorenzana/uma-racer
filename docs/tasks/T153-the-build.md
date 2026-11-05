# T153 — The build: deck, tree, bonds, skills and the racing build

> **M036, part 2 of 8.** Domain only. Starts after T152 has merged into `restart/g3`. Decision **D382**.

## Why

The restart's build is deterministic and hand-allocated ([v3 §4](../research/drawing-board/README.md#4-the-build-resources-trees-and-the-real-cards)):
- mini-games pay resources;
- the owner spends them in a tree;
- every tree pip grants what the original game's training formula gives, computed from the **real** effects of the
  support cards posted to that branch.

This part writes those rules as pure functions, with a sim that proves the bands.

## Context

Read first:
- [M036](M036-ura-finale-slice.md), "The rules → The build". This is the binding summary.
- [05 · card mechanics](../research/drawing-board/05-card-mechanics.md):
  - §2, the original's formula and its sources;
  - §3, the model: resources, the tree, posting, the session formula, bond tracks, the worked example and the balance
    check;
  - §4, skills;
  - §3.7, which of today's code to keep.
- The generation-3 save shapes from T152 (`packages/domain/src/save/`): the `career` record holds `deck`, `posts`,
  `pips`, `camps`, `skills` and `wallet`; the `bond` record holds (Uma, tier, card) → value and hints given. The
  operations `set-deck`, `post-card`, `buy-pips`, `pour-bond` and `buy-skill` are declared there with input parsers,
  and refuse with "not built yet" until this part implements them.
- The master adapter from T152 (`packages/domain/src/master/adapter.ts`): `SupportCardTemplate.effects` (effect id →
  level-50 value), `uniqueEffect` with `params`, `hintSkillIds`, `hintOthers`, `eventSkillIds`, `era`; and
  `UmaTemplate.baseStats` (star 5), `growthRates` and `aptitudes`.
- Kept code:
  - `tiers/scaling.ts`: `capProfileAt`, `capBudgetAt` and `spCapAt`;
  - `cards.ts`: `eraOf`;
  - `race-skills.ts`: the skill library and compiling;
  - `career-shapes.ts`: skill unlock shapes.
- Tests use `@luismlorenzana/uma-data/testing`'s synthetic cards and Umas, plus small fixtures of your own. **No real
  card value may appear in git.**

## Do

1. **`packages/domain/src/build/` (new area, subpath `@racer/domain/build`):**
   - **`facilities.ts`:** the facility base table for levels 1–5 (stat gains per facility and SP), as a rule constant.
     Take URA Finale's table from GameTora's URA Finals page and cite it in D382. Then `pipCost(level)`: 20, 22, 24, 26
     or 28 drills, cut by the posted cards' Energy Cost Reduction (rounded up).
   - **`deck.ts`:**
     - the deck holds six owned SSRs whose era allows the career's T;
     - `post(card, branch)` puts a card at one branch, by default its own type's (Friend and Group default to Wit);
     - a branch seats five, and a card posts once;
     - validation errors are in plain words.
   - **`session.ts`:** `sessionGain(input) → { stats: Stats5, sp }`, exactly 05 §3.3. It covers:
     - Stat Bonus, Friendship (own-type card at bond ≥ 80, unique friendship too) and Mood Effect at a fixed Great
       (+20%);
     - Training Effectiveness, the +5% card count bonus and growth;
     - the T scale `s(T)`, which is 1 at T1 (a table to fill per scenario later), and floors as in the original.
     
     Translate the unique-effect conditionals that 05 §3.3 lists, and ignore the dropped effects. One test per effect
     kind, on synthetic cards.
   - **`tree.ts`:**
     - The tree is five branches × five levels × four pips; pips open in order, and the next level opens when four are
       full.
     - Two Camp nodes open once any branch reaches level 3. Each is four level-5 sessions in a branch the owner picks.
     - `buyPips(career, branch, count)` spends drills of that colour.
     - `previewPip(career, branch)` shows the gain, the cost and the overflow over the cap.
     - **Derived when read:** gains are recomputed from the current deck, posts and bonds. Purchase order never
       matters.
   - **`bond.ts`:**
     - Tracks run 0–100 and start at the card's Initial Friendship Gauge.
     - `pourBond(track, amount)` takes Bond from the career wallet, multiplied by the extra-bond unique if present.
     - **Stops:**
       - a **hint** every `round(20 / (1 + HintFrequency))` bond: the card's next hint skill in list order at level
         `1 + HintLevels`, plus its `hintOthers` rewards when due;
       - **80**, friendship;
       - **100**, its event skills hinted, golds included.
     - Bonds are per (Uma, tier, card).
   - **`skills.ts`:**
     - her library is her own skills plus every hinted skill;
     - `skillCost(skill, hintLevel)` is `round(costSp × (1 − d))`, with *d* 0, 10, 20, 30, 35 or 40% at levels 0–5;
     - hints for one skill add up to level 5;
     - a gold needs its white;
     - SP spent in a career is capped at `spCapAt(T)`.
   - **`racing-build.ts`:** `deriveRacingBuild(career, uma, cards, bonds) → { stats, aptitudes, skills }`. Stats are
     `min(cap(T), star5 base + Σ deck Initial stats + Σ bought pips + hint stat rewards)`. Aptitudes are her template
     grades. Skills are those bought (≤ 64). It is the only input the race hand-off reads.
   - **`power.ts`:** `cardPower(card)` is the stat gain the card adds to the **reference session**: a level-3 pip at its
     own type's branch, bond 80, a reference Uma with 0% growth, and a fixed reference deck. Friend and Group cards are
     scored on their own scale. Release 3's refit uses it; here it is only built and tested.
2. **Operations**, implemented in `build/ops.ts` and wired into the dispatcher T152 set up: `set-deck`, `post-card`,
   `buy-pips`, `pour-bond` and `buy-skill`. Each is validated, spends from the career's wallet, refuses in plain words
   (not enough drills, the branch is full, the skill isn't in her library, over the SP cap) and is idempotent by
   operation id.
3. **`sim:decks`** (`scripts/sim`, the root script):
   - For each T (only T1 is required now), run 100 sessions with an empty deck, a median bonded deck and a strong
     bonded deck, built from the **private pack** when it is present locally, or from synthetic cards in CI.
   - Report each deck's share of the cap budget.
   - Fail when the median deck falls outside 55–75% or the strong deck outside 70–90%, or when any deck caps all five
     stats.
   - Commit only aggregates, never card ids with values.
4. **The manual:**
   - write `docs/game/05-the-build.md` (deck, posting, the tree, the session formula in words, caps, the racing build,
     skills);
   - write `docs/game/06-cards-and-bonds.md` (owned cards at maximum level, real effects and what each does here, bond
     tracks and their stops, card power and the refit noted as release 3);
   - add live blocks where numbers are rules (pip costs, the hint discount ladder, and the facility table's shape
     without values if that is simpler).
5. **D382** in `docs/decisions.md`: the facility table's source, `s(1)`, the posting defaults, the hint interval, and
   anything you decided.

## Done when

- [ ] `pnpm --filter @racer/domain test` covers every effect kind, posting rules, tree order, camps, derived-on-read
      (swapping a card changes open pips), bond stops, skill costs and caps, and `deriveRacingBuild` against
      hand-computed synthetic cases (05 §3.5's worked example, reproduced with its made-up numbers).
- [ ] The five operations work through `commitOperation` on synthetic saves, and are idempotent.
- [ ] `pnpm sim:decks` passes on synthetic cards in CI. Run it locally on the private pack and give the aggregate
      shares in the PR, not in git.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass. No real card value is in git
      (`git grep` for any number copied from the pack finds none).
- [ ] The two manual pages and D382 are written.

## Deliver

- Branch `feat/t153-the-build` from `restart/g3`. Open a PR **into `restart/g3`** titled
  `feat(domain): the build — deck, tree, bonds, skills (T153)`. Claude reviews and merges.
- Delete this file in the same PR (D104).
- In the PR: the verification, the local `sim:decks` shares, and the decisions.
