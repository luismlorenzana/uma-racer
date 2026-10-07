# M030 — Uma Puzzles and material-driven Constellation Levels

**State: T106–T107 pure foundations/battle complete (D269–D270); T108 next. No runtime/save/cutover change yet.**
Owner-approved gameplay: [Uma Puzzles](../design/uma-puzzles.md), D267.
Delivery/transport baseline: [implementation contract](../technical/uma-puzzles-implementation.md), D268.

## Outcome

Home opens a self-contained, account-wide five-Uma puzzle campaign. Real privately imported PAD monsters fight a
continuous-drag party with shared HP, Hearts, elemental attacks, active skills and a leader passive. Winning raises
the five outfits' independent Puzzle Levels and awards scenario/style materials into global Items, repaying matching
legacy debt first. Those materials buy shared CL1–10 on an owned outfit's unlocked racing scenario; they do not buy
Inspiration, Extra stats, racing EXP or card stars.

The owner can play any of today's fourteen chapters, resume each of five parties, select elemental bosses for a
particular material, exchange adjacent same-style tickets and see exactly why a reward did or did not enter Items.
The old training loop remains usable until that replacement and the preservation migration are ready together.

## Execution order — one task, one completed PR at a time

| Order | Task | Must be true at completion |
|---|---|---|
| 1 | T106 — Progression and material rules · **complete** | [Pure v1 exports](../technical/uma-puzzles-implementation.md#t106-implemented-foundations-d269): registration, PL, CL spend, exchange, frozen debt and legacy credit; no runtime writes |
| 2 | T107 — Deterministic party battle · **complete** | [Battle v1 exports](../technical/uma-puzzles-implementation.md#t107-implemented-battle-v1-d270), finite kit/intents, two literal journal pins and 288-battle synthetic sim; no runtime writes |
| 3 | [T108 — Campaign and reward economy](T108-puzzle-campaign-economy.md) | Fourteen ten-level chapters, 28-node maps, 54/132 gross budgets and allocation/progression reports work |
| 4 | [T109 — Private PAD content](T109-puzzle-private-content.md) | Import/art/runtime contract works and real cast availability is verified, or an explicit content blocker prevents release |
| 5 | [T110 — Save and sync protocol](T110-puzzle-save-sync.md) | Additive storage, API validation and conditional economic operations cannot duplicate or lose rewards/spends |
| 6 | [T111 — Journal and real host](T111-puzzle-journal-host.md) | Real enrollment, reservation, replay, settlement, resume and conflict recovery persist correctly |
| 7 | [T112 — Hub, parties and maps](T112-puzzle-hub-maps.md) | Real saved roster/presets/checkpoints drive a compact phone UI; no production Home entry yet |
| 8 | [T113 — Touch battle and guide](T113-puzzle-touch-battle.md) | Pixi battle, results and isolated practice use the real host with correct phone input and guide behavior |
| 9 | [T114 — Materials, exchange and CL UI](T114-puzzle-material-surfaces.md) | Real Items/icons, debt/exchange and one reusable CL spend sheet show actual nodes/SP changes |
| 10 | [T115 — Preservation and retirement](T115-puzzle-legacy-cutover.md) | Rehearsed one-time cutover, old-client protection and Spark retirement code are ready but dormant |
| 11 | [T116 — Release and acceptance](T116-puzzle-release.md) | Published content, balance evidence, enabled cutover and verified production loop; owner phone checks recorded honestly |

Rebase each task from the then-current main; do not run several task branches in parallel or overwrite Claude's RPG
changes. Each task's PR deletes **that task's spec**, updates the living design/technical docs and this table under
D104, and passes lint/test/build. Remove this milestone spec when T116 closes. Numbers are never reused.

T109 is a real dependency, not a request to leave art to an imaginary other agent. If allowed source material cannot
be verified, report precisely what is missing. Completed pipeline work may be proposed separately, but do not mark
the private-content acceptance complete or claim production playability. Safe synthetic engine/storage work can
continue only with the blocker visible; T116 cannot pass without real content.

## Shared definition of done

Read AGENTS, the design, this milestone, the implementation contract and the specific task before acting. Re-read
current RPG/save/content docs when changing a shared boundary; file names here are starting points, not permission
to restore a stale version of a file. Branch + PR, never push to main. No infrastructure/env/workflow/credential
changes are implied. No original rows/art/monster lists in git; fixtures are tiny invented data.

Every PR includes:

- `pnpm lint`, `pnpm test`, `pnpm build`, with results and relevant sims. Use `pnpm sim:puzzles` once T107 exists;
  run `pnpm sim:spark` and `pnpm sim:training` for shared-board, retirement, card or training changes.
- Startup entry gzip size, always ≤180 KB; measure actual built bytes, not the sum of unrelated lazy chunks.
  UI PRs also report Puzzle Hub/map/battle and Pixi chunk sizes and include 390×844 and 375×667 screenshots.
- Fixed-seed/action-hash evidence for engine/shared utility changes; rollback/retry tests for persistent writes.
- Design + domain pin + sim-envelope + fresh decision for changed tuning numbers; never edit historical decisions.
  Transport limits and new versions are documented and tested separately from gameplay caps.
- What remains unverified: private publication, real account writes, production deployment and physical iPhone
  checks are different evidence. Synthetic screenshots cannot close any of those.

## Safe landing and activation

T106–T114 are additive. The release gate is a small checked-in capability module, initially **off**; it is not an
edit to `.env.production`. DEV proofs use a visibly isolated synthetic account/store. Gated routes must not enroll
or grant real-account rewards just because someone guessed a URL. Current Spark, universal-ticket spending and
training EXP banking remain operational before cutover. T115 installs dormant migration/retirement code; T116 alone
enables it after the replacement, API and content are ready. Do not announce a usable Home card prematurely.

For an enabled account: prepare the authoritative bank/legacy receipt once, then let normal battles and material
operations work locally with background sync. A failed preparation leaves unrelated modes usable and presents Retry;
it does not retire Spark halfway through. Historical old runs and receipt evidence remain recoverable.

## Non-negotiable acceptance examples

1. Dirt-A + Front-A enrollment offers all five colours; non-Dirt Front+Pace offers only Light; Front+Late offers
   basics, not Light. Combat colour never changes source-A CL spending eligibility.
2. Reload a moved-but-uncommitted board: same accepted journal, board, seed, HP, foe intents and cooldowns.
3. A regular win grants three tickets **once for the account**, EXP to five frozen entrants, zero racing EXP and
   zero daily Training Ticket charge. A partial-kill loss grants neither EXP nor materials.
4. With matching debt −7, a 12-ticket boss reports 12 gross / 7 repaid / 5 deposited and ends at debt 0.
5. A mixed FR/PC spend on a Front+Pace source-A outfit raises one shared scenario CL; all four distance presets see it.
   CL9/10 show SP benefit without inventing extra card nodes or an Inspiration unlock.
6. Repeated reward/spend/exchange operation ids return their original receipt. Conflicting offline spends on two
   devices cannot both consume one stack; a displaced journal cannot create a second reward.
7. Migration charges CL−1 once per existing outfit/scenario, not once per preset/A style, preserves earned levels,
   pools only unapplied EXP, rounds once per account, and refunds each unfinished paid Spark at most once.
8. Production uses verified PAD art with retained hashes. Missing content is visible, not a generic enemy fallback.

## Explicitly deferred

Dual elements; second/friend leader; RPG classes/MP/trees; paid entry/continues; same-scenario style exchange; automatic
CL spending; infinite skill multiplier growth; unapproved hazard catalogue; multi-floor attrition, boss rush and
no-skyfall challenge types. Published higher-band kits can extend the finite first-release skill catalogue later.
These are not stealth acceptance requirements for this milestone.
