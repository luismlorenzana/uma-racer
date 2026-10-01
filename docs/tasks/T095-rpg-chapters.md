# T095 — Chapter graph, map and checkpoint flow

**Outcome:** a complete branching **synthetic** chapter can be chosen, paused, resumed, lost, retried and cleared
without changing an encounter after entry. Depends on T090, T092 and T094. Read [M028](M028-uma-rpg.md),
[RPG design](../design/uma-rpg.md), [implementation contract](../technical/uma-rpg-implementation.md) and D219/D223.

## Pure content and graph contract

1. Define a versioned chapter object with stable chapter/scenario ids, content hash, recommended tier/local level,
   surface/distance/affinity preview, start node, nodes, directed exits and terminal boss clear. Node kinds must
   express encounter, optional recovery/setup, branch, reconvergence and boss; each encounter names a frozen enemy
   team, formation, action kit, intent/phase plan and art keys. A path preview identifies actual team roles and
   weaknesses, not only a difficulty number. Chapter graph and parser stay pure in `packages/domain/src/rpg/`.
2. Validate unique ids, safe references, no unreachable node, no unintended dead end/cycle, every route reaching a
   boss, resolved enemy/skill/art references and version/hash consistency. A missing private pack or outdated open
   chapter is **unavailable** rather than silently replaced by the synthetic fixture. The fixture in git has invented
   teams, one fork/rejoin, optional recovery/elite tradeoff and phase-changing boss; fixture size does not set the
   production chapter's fight count.
3. Map transitions use T090 checkpoints and T092 accepted battle receipts. Entry needs five filled slots and an
   advisory level warning, never a level gate. A preset can pause several chapters; selecting another does not wipe
   progress. Changing a preset after chapter start changes only future entries. Loadout edits occur at accepted safe
   checkpoints; the current battle continues with its frozen kit. Losing keeps earlier accepted nodes/rewards and
   retries the same frozen encounter free. Only an explicit replay after boss clear increments attempt identity.

## Screen and handoff

Add a lazy map screen with path cards, visible enemy team/affinity/level preview, checkpoint status and five-member
party overview (reuse T093 overlays). Separate **Pending sync** from Cleared: a locally finished but unacknowledged
battle cannot open the next node or boss reward. Route switching, backgrounding, direct URL and reload reconstruct
from checkpoint rather than component memory. At 390×844 and 375×667 the route fork, enemy team and continue CTA
remain readable and touchable. Deliver a content-authoring schema/example to T097 and an actual synthetic encounter
count/recommended-level fixture to T096 so its EXP payout can be measured instead of guessed.

## Acceptance

Graph parser tests cover invalid edges, cycles, unreachable boss, missing actor/art/skill, unknown scenario and pack
version drift. End-to-end browser fixture covers start→fork→two alternative paths→rejoin→boss, loss/free retry,
pause another chapter, stale second device, no reward before acknowledgement and voluntary replay with new attempt
identity. Include 390×844 and 375×667 screenshots. `pnpm lint`, `pnpm test`, `pnpm build` and replay tests pass;
report startup gzip ≤180 KB and map chunk. Update design/architecture; delete this spec in its PR (D104).

**Out of scope:** real PriConne rows/art (T097), encounter EXP and tree integration (T096), token grant (T098),
Home entry (T099), all-scenario coverage (M029).
