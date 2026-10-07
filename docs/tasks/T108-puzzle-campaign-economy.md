# T108 — Generated chapters, enemy scaling and reward economy

**Depends on T106–T107.** Read [design §§4, 6–7, 11](../design/uma-puzzles.md),
[implementation §§2–5](../technical/uma-puzzles-implementation.md) and current RPG `campaign/chapters.ts` for presentation
structure only. RPG is now twelve-level Octopath combat; Puzzle chapters stay ten-level and use neither its save nor math.

## Pure campaign deliverable

Implement scenario-registry-driven chapter generation, stable node ids, entry eligibility, reached/cleared projection,
per-node attempts, exact reward vectors, encounter recipe/stat scaling and first-clear exchange access facts under
`packages/domain/src/minigames/uma-puzzles/campaign/`. Join synthetic or private cast through an explicit input contract;
generation never embeds original names or reads a content file. No runtime/UI/account migration in this task.

## Complete map contract

- One chapter per scenario in registry order. Tier t targets levels `10(t−1)+1…10t`; all current fourteen generated,
  an invented fifteenth also works. Assign ordinary rows local recommended levels **1,2,3 / 4,5,6 / 7,8,9,9**;
  guardians **3,6,9**; champions **10**. Keep those values named/pinned and tune only under the numerical rule.
- Opening/Middle/Final have 3/3/4 regular rows. Each row has two branch nodes; either clear unlocks the next row.
  Both choices are previewable at a reached row and remain replayable. Each sector ends in one required guardian.
- After all three guardians, five Fire/Water/Wood/Light/Dark champion routes open. Dark has one node with a PC/LS
  pre-entry variant selection, not a sixth node. Any champion clears the chapter; distinguish full-map completion.
- Total nodes 20 regular +3 guardian +5 champion =28; primary path14 wins, full map28 wins. No camps/carried MP,
  timed expiry, daily rotation, level hard lock or forced colour composition.
- Each ordinary trio is exactly one Light/Dark plus two **distinct** basic elements. Cycle all six side/pair
  combinations across each chapter deterministically, balanced over both branches; no save-seeded random reward map.
  Guardians use a declared mono-element; vary three guardians across scenario order without altering node identities.
- Exits have no dangling ids/cycles; all nodes reachable under progress rules. Preserve won nodes when a party changes
  outside a battle. Entry rejects inaccessible/unknown nodes and incomplete parties but only warns about low PL.

## Frozen encounter and scaling

Generation selects checked-in semantic roles/recipes, level, HP/ATK/DEF/countdowns/phase parameters and reward identity.
Private cast joins provide display identity/art, not damage stats. T107 limits mechanics; no hidden preemptive KO,
unannounced delay immunity or player-strength-dependent enemy scaling. Before-entry preview and frozen engine input
must come from the same resolver. Publish a compact level/kind/role coefficient table in design §5/§6, checked by pins.

Use a modest combat sim to settle these previously unpinned enemy coefficients. Derive a fixed synthetic baseline
party from invented source stats/growth ranges; never adapt foe strength to the party that entered. Test neutral as
well as advantage teams, healing/defensive utility and lower/higher PL. Record coefficients and rationale in a fresh
decision before downstream UI consumes them. No original PAD combat formulas are necessary.

## Reward and progression contract

Regular win: one ticket per foe, total3. Guardian4. Champion12. Fire→FR, Water→EC, Wood→LS, Light→PC;
Dark's declared variant→PC/LS. Freeze scenario/style/count at entry; changing an enemy phase element cannot change it.
Every repeat win has full base reward with a new terminal attempt identity; first clears grant no extra material.
Loss/abandon/partial-kill grant0. Award once for account, never once for each member.

EXP to each of five frozen entrants is T106's formula using authored encounter level and that entrant's frozen PL.
Tune initial ordinary/guardian/champion weights with the route projection so a roughly on-level party traverses
about ten levels per chapter. Do not copy RPG's D266 weights or force a level-up on every win. Carry all remainder.

Opening guardian first clear sets an immutable account exchange-edge fact for the edge below that chapter; first
chapter has no edge below. Other parties may use the edge. Facts are derived from accepted clears, not a claimed UI
boolean. Higher racing scenario ownership is irrelevant to playing/unlocking exchange; still required for CL spending.

## Economy sim and allocation

Extend `pnpm sim:puzzles` with campaign/progression/economy output and regression assertions:

1. Every primary branch choice totals `10×3 +3×4 +12 =54` gross; every full map totals132. Keep style vectors beside
   totals. The five entrants do not multiply either figure.
2. At least two successive ten-level chapters, starting/ending PL/EXP per member, higher/lower catch-up and repeat
   boss reward/EXP. Target roughly the next band, not mechanically clamp progression to10/20.
3. Small integer allocation report for mixed five-entrant and six-recipient original-A style groups, plus pure
   FR/PC/LS/EC recipient groups. Report usable materials, stranded stock and **extra targeted boss wins** for completion.
   Do not assert54 gross guarantees six arbitrarily restricted outfits or introduce cross-style conversion.
4. Initial debt, below/at/over-zero rewards, legacy credit bypass and all thirteen exchange edges. Show the8,192
   tier1-equivalent issue and locked-edge effect. No automatic allocation/spending into actual outfits.
5. Competent on-level design bands: ordinary85–95%, guardian70–90%, champion60–85%; median ordinary3–6 drags,
   champion6–12; remaining HP usually20–70%. Report by kind/colour, not only blended averages. Novice/counter/neutral
   outliers remain visible. If starting numbers cannot meet bands, tune modestly and record, not fake the envelope.

Use published seed lists and small bounded samples. Keep time and rewards-per-drag estimates honest; do not claim
physical-phone rewards per minute from a headless bot. `--combat`/`--economy` filters may be added without new deps.

## Tests / acceptance

Test map counts/DAG/alternative reachability, progression locks, all14+future scenario bands, all six squad mixes,
exact/drop-family roundtrips, Dark variants equal quantity, no rewards on loss, frozen reward across phase, repeats,
stable recipe generation, parser rejection and primary/full-clear distinction. Snapshot semantic map ids/recipes
with synthetic cast to prove a display-name/art update cannot alter combat or progress.

Run lint/test/build + sim:puzzles and report startup gzip. Update design tables, domain pins and decision for newly
settled scaling/weights; record published sim envelope and skill catalogue boundary. Delete spec and update M030/index.
Content acquisition (T109), persistent settlement (T110–111), live balancing and activation (T116) remain separate.
