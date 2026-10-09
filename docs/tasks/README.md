# Tasks

This folder holds **only work that is planned or in progress**. A task spec is a delivery instruction, not a record.

- The **design docs are the source of truth** ([Overview](../design/00-overview.md) and the rest of the
  [documentation map](../../README.md#documentation-map)). They describe the game as it is meant to be and are updated as
  each task lands.
- [decisions.md](../decisions.md) is the append-only record of *why*.
- A task spec is **deleted when its work is merged and the design docs carry the result** (D104). The full spec stays in
  git history; the table at the bottom names the last commit that holds each one.

## Current plan

**[M031 — Farm production/cooking rework](M031-farm-kitchen-rework.md) — specified, implementation not started.**
The owner authorized full task authoring through production release (D298–D299).
[Design](../design/farm-kitchen-rework.md), [technical contract](../technical/farm-kitchen-implementation.md)
and [research](../research/farm-kitchen-games.md) cover thirty fully open spots, independent outfit levels,
scenario-specific symmetric ingredients, batched recipes, shared-block Extra Stats and the guarded future reset.
Work one task/green PR/merge at a time: T118 rules/balance → T119 save/sync → T120 dormant cutover → T121 real
host → T122 Farm/cookbook screens → T123 Extra/race wiring → T124 complete production release. T118–T123 keep
normal capabilities off; existing Farm remains live until the whole loop and backup/reset are ready. No reset
or deployment is executed by this documentation plan. Fixed choices are settled; measured balance/device checks remain.

**M030 / T116 — Uma Puzzles release is complete** (D289–D290): the owner approved verified
**original-placeholder art** for production, so permitted PAD portraits no longer block release.
[The design](../design/uma-puzzles.md) and [implementation contract](../technical/uma-puzzles-implementation.md)
carry registration, pure battle/campaign rules, the real replay host/atomic sync, mobile Hub/maps/battles,
global materials/exchange/CL and protected save16 preservation with a device-local whole-account backup.
Both application gates are enabled. [Release acceptance](../research/uma-puzzles-release-acceptance.md)
records private publication and application/deployment witnesses separately from still-pending owner gameplay,
iPhone and second-device checks. Completed specs are removed under D104. T109's owner-export art upgrade is now
complete (D292); [art acceptance](../research/puzzle-art-release-acceptance.md) records private derivatives, full
coverage and placeholder retention without changing mechanics.
Implement one task to completion/PR/merge before the next, from latest main; do not alter RPG mechanics.

**T117 — Puzzle setup parity is complete** (D293): ten parties, free-only highest-PL pickers, Add/Swap/Remove,
party→profile member strips, enrolled/unenrolled roster sections and no Puzzle dropdowns. The narrowed authoritative
lock read set stays within the existing sync limits. [Setup phone proof](../research/puzzle-setup-parity/README.md)
records synthetic browser checks separately from pending owner iPhone acceptance. No next Puzzle task is specified.

**Owner detour — the RPG campaign is complete** (D260–D266): local-first RPG saves with no Sync steps, one generated
twelve-level chapter per scenario, replayable maps, Octopath element/weapon breaks with carried MP and camps,
and EXP plus tokens from every win. It supersedes M029's private chapter rollout (T100–T103), deleted unbuilt.

**Owner detour T105 — Inspiration advance is complete** (D256): one-time shared scenario unlocks, a negative token
bank, and receipt-gated RPG repayment. Its first updated online sync applies the server-owned frozen-cohort advance.
T099's production-first acceptance sequencing is D257.

**Owner detour T104 — Global card stars is complete** (D255). It preserves all four distance presets from D252–D254;
T081's old scenario-occurrence definitions need separate re-authoring before implementation.

| Milestone | Tasks | State |
|---|---|---|
| [M031 — Farm production and cooking](M031-farm-kitchen-rework.md) | [T118 rules](T118-farm-kitchen-rules.md) · [T119 sync](T119-farm-kitchen-save-sync.md) · [T120 cutover](T120-farm-kitchen-cutover.md) · [T121 host](T121-farm-kitchen-host.md) · [T122 screens](T122-farm-kitchen-screens.md) · [T123 Extra Stats](T123-farm-kitchen-extra-stats.md) · [T124 release](T124-farm-kitchen-release.md) | Specified; pick up T118 first, one PR/merge at a time |
| [M024 — Card Training Loop](M024-card-training-loop.md) | T078 three stars ✅ · T079 card training on its own ✅ · T080 card focus ✅ · [T081 Bond achievements](T081-card-bond-achievements.md) | **Pending** · T078–T080 landed; re-author T081 for global cards before implementation |
| [M010 — Collection depth](M010-collection-depth.md) | **[T035 — Race Select on the album engine](T035-race-select-browsing.md)**; T033 and T034 complete | Specified, delegable |
| [M011 — Game feel and device readiness](M011-game-feel-and-device.md) | T036 – T039 | Outlined: each spec is written when its task becomes next |

**M024 remains separately pending** (D199–D202, D236): T078 and T079 landed on 2026-09-29 and T080 on 2026-10-02;
T081 needs re-authoring for global cards before pickup. M025–M026's Farm and Produce bridge are complete. T035 stays
specified and can be picked up any time. **M027 — Training Rebalance** (D211–D214) is complete. Anything new starts
with the next free numbers below.

The owner's device checks (every milestone's, including Spark Rival Circuit's physical-iPhone pass) wait in
[Open questions](../open-questions.md#needs-you-owner-actions-not-design-questions) and close together in T038 (D189).
Owner playability notes are fixed as they arrive, each under its own decision (D178 onward), rather than gathered into a
task.

**Next free numbers: M032 and T125.** M031/T118–T124 belong to the planned Farm rework;
M030/T106–T117 belong to the completed Puzzle sequence. Numbers are never
reused, so a decision that mentions T014 always means the same work. T057 was consumed by the per-scenario limit-break
branch and is not reused.

## Completed and removed

Each row's specs are readable with `git show <commit>:docs/tasks/<file>`.

| Work | Landed | Carried by | Last commit with the specs |
|---|---|---|---|
| T117 — Puzzle setup parity with the RPG | 2026-10-08 | [Setup contract](../technical/uma-puzzles-implementation.md#t112-implemented-setup-navigation-d275), D293 and [synthetic phone proof](../research/puzzle-setup-parity/README.md); ten parties, unchanged sync limits | `8665513` |
| T109 — Private owner-export Puzzle art upgrade | 2026-10-08 | [Content contract](../technical/puzzle-content.md), D292 and [aggregate art acceptance](../research/puzzle-art-release-acceptance.md); old placeholder packs retained | `4951830` |
| M030 / T116 — Verified-placeholder Puzzle release, tuning, Home and preservation backup | 2026-10-08 | [Uma Puzzles](../design/uma-puzzles.md), D289–D290 and [release/owner checks](../research/uma-puzzles-release-acceptance.md); later T109 art upgrade retained | `0879ce5` |
| T115 — Rehearsed preservation migration and safe Spark retirement | 2026-10-08 | [Preservation v2 contract](../technical/uma-puzzles-implementation.md#t115-implemented-preservation-v2-d287), D287 and [synthetic phone/restore proof](../research/puzzle-preservation-phone-proof.md); release remains off | `ed99e2d` |
| T114 — Global materials, original vectors, debt/exchange and shared CL spend | 2026-10-08 | [Material surface contract](../technical/uma-puzzles-implementation.md#t114-implemented-material-surfaces-d283), D283 and [synthetic phone proof](../research/puzzle-material-phone-proof.md); release remains off | `bf5585b` |
| T113 — Mobile Pixi battle, receipts and contextual guide | 2026-10-08 | [Battle presentation contract](../technical/uma-puzzles-implementation.md#t113-implemented-mobile-battle-d276), D276 and [synthetic phone proof](../research/puzzle-battle-phone-proof.md); release remains off | `9bc12a4` |
| T112 — Global Puzzle Hub, roster, five parties and chapter maps | 2026-10-08 | [Setup navigation contract](../technical/uma-puzzles-implementation.md#t112-implemented-setup-navigation-d275), D275, isolated real-host phone proof; release remains off | `fabfa27` |
| T111 — Real Puzzle host, local journal and recovery | 2026-10-07 | [Real host/journal contract](../technical/uma-puzzles-implementation.md#t111-implemented-real-hostjournal-d274), D274, isolated IndexedDB replay/rollback and lazy runtime adapter | `bb8c80b` |
| T110 — Additive Puzzle saves and atomic background sync | 2026-10-07 | [Persistence/protocol v1](../technical/uma-puzzles-implementation.md#t110-implemented-persistenceprotocol-v1-d273), D273, pure resolver/API adapters/Dexie coordinator | `0c8b5e7` |
| T108 — Generated Puzzle campaign and reward economy | 2026-10-07 | [Campaign v1 contract](../technical/uma-puzzles-implementation.md#t108-implemented-campaign-v1-d271), D271, domain campaign and `sim:puzzles` | `a68da98` |
| T107 — Deterministic five-Uma puzzle battle | 2026-10-07 | [Battle v1 contract](../technical/uma-puzzles-implementation.md#t107-implemented-battle-v1-d270), D270, domain engine and `sim:puzzles` | `58de801` |
| T106 — Puzzle progression and Constellation materials | 2026-10-07 | [Pure contract](../technical/uma-puzzles-implementation.md#t106-implemented-foundations-d269), D269 and `packages/domain/src/minigames/uma-puzzles/` | `e5b17fe` |
| M029 / T100–T103 — RPG chapter rollout (superseded unbuilt by D262) | 2026-10-05 | [RPG design](../design/uma-rpg.md#chapters-and-the-map-d262), D262 | `9acfb84` |
| M028 / T099 — First playable RPG | 2026-10-04 | [RPG design](../design/uma-rpg.md), D257 and [release/owner checks](../research/rpg-release-acceptance.md) | `8e1b881` |
| T105 — Inspiration advance | 2026-10-04 | [Advance](../design/skills-and-inheritance.md#temporary-inspiration-advance-d256), D256 and [phone proof](../research/inspiration-advance-phone-proof.md) | `1ac3b19` |
| T104 — Global card stars | 2026-10-03 | [Support Cards](../design/support-cards.md#global-star-cutover-d255), D255 and [phone proof](../research/global-card-stars-phone-proof.md) | `cea441c` |
| M027 — Training Rebalance (T087 linear levels and EXP bank, T088 spending Level-Up Tickets) | 2026-10-02 | [Training](../design/training.md#the-training-exp-bank-and-level-up-tickets), D211–D214 | git history |
| T089 — RPG pure progression rules | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#progression), D227 and `packages/domain/src/rpg/` | `ce2aa37` |
| T090 — RPG save and grouped commands | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#saving-and-sync-d260-d263), [Architecture](../technical/architecture.md), D228 | git history |
| T091 — RPG deterministic combat | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#battles-engine-v3-d265), D229 and `packages/domain/src/rpg/combat/` | git history |
| T092 — RPG battle journal and host | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md), [Architecture](../technical/architecture.md), D230 and `apps/web/src/game/rpg-battle-host.ts` | git history |
| T093 — RPG roster and party hub | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#phone-presentation), D232 and `apps/web/src/screens/rpg/` | git history |
| T094 — Phone battle screen | 2026-10-02 | [Global Uma RPG](../design/uma-rpg.md), D243 and [phone proof](../research/rpg-battle-phone-proof.md) | git history |
| T095 — Chapter maps and checkpoints | 2026-10-02 | [Global Uma RPG](../design/uma-rpg.md), D245, [content handoff](../technical/rpg-chapter-content.md) and [phone proof](../research/rpg-chapter-phone-proof.md) | git history |
| T096 — Battle EXP, skills and class promotion | 2026-10-03 | [Global Uma RPG](../design/uma-rpg.md), D246 and [phone proof](../research/rpg-progression-phone-proof.md) | git history |
| T097 — Private PriConne pipeline / URA draft | 2026-10-03 | [Content contract](../technical/rpg-chapter-content.md), D248 and [private publication handoff](../research/rpg-private-ura-handoff.md) | git history |
| T098 — Inspiration rewards / independent unlocks | 2026-10-03 | [RPG rewards](../design/uma-rpg.md#rewards-d263), [Lineage](../design/skills-and-inheritance.md#lineage), D250 | git history |
| M026 — Produce nodes (T086) | 2026-09-30 | [Stable Farm](../design/farm.md), [Constellations](../design/constellations.md) and [Architecture](../technical/architecture.md) | `f6dd79a` |
| M025 — Stable Farm (T082–T085) | 2026-09-30 | [Stable Farm](../design/farm.md) and [Architecture](../technical/architecture.md) | `4ac41d7` |
| T001–T018 and the Milestone 6 plan | 2026-09-19 | design docs | `463edb8` |
| T024–T027 and M008, **superseded** by the training rework (D119–D125) rather than completed | 2026-09-20 | — | `0a57f4c` |
| M012 (constellation engine, save v5), M013 (constellation screen), M014 (Spark Match, Bond Recall), then T058 | 2026-09-21 | [Constellations](../design/constellations.md), [Minigames](../design/minigames.md) | `ac1c157` |
| M016 — cards by scenario | 2026-09-22 | D129–D131, [Support Cards](../design/support-cards.md) | git history |
| M017 — career goals | 2026-09-24 | D137–D138, [Scenario Careers](../design/scenario-goals.md) | git history |
| M018 — race engine v5, and T060 (the early stamina wall) | 2026-09-24 | D139–D141, [Racing](../design/racing.md#engine-v5-m018), [Race Engine v5 Findings](../research/race-engine-v5-findings.md) | git history |
| T052 — constellation silhouettes | 2026-09-25 | D143, [Constellations](../design/constellations.md#silhouettes) | git history |
| M019 — stars and tickets | 2026-09-25 | D147–D148, D150, [Support Cards](../design/support-cards.md#stars), [Economy](../design/economy.md) | git history |
| T059 — chibi and outfit-stand art | 2026-09-26 | D160, [Collection](../design/collection.md#art-tiers) | git history |
| M015 — scenario identity | 2026-09-26 | D163–D165, [Scenarios](../design/scenarios.md#scenario-buffs), [Badges](../design/badges.md), [Collection](../design/collection.md#icon-overlays) | git history |
| M009 — look and feel | 2026-09-26 | D166–D167, [Visual System](../design/visual-system.md) | git history |
| M020 — Friendship Training | 2026-09-26 | D146, D168, D173, D177, [Minigames](../design/minigames.md#friendship-training--card-stars) | git history |
| M007 — align and stabilize (T019–T022; T023 retired, D189) | 2026-09-28 | D105–D108, D114, [Infrastructure](../technical/infrastructure.md#release-runbook) | `7129d77` |
| M021 — turn-based races (T066–T070) | 2026-09-28 | D153–D155, D158–D159, D163, [Racing](../design/racing.md#engine-v7-the-originals-physics-and-field) | `7129d77` |
| M022 — Spark Rival Circuit (T071–T074) | 2026-09-28 | D169–D172, D187, [Minigames](../design/minigames.md#spark-match--rival-circuit) | `7129d77` |
| M023 — minigame kit (T075–T077) | 2026-09-28 | D185, [Minigame kit](../design/minigame-kit.md) | `04b395a` (M023, T075) · `19a8dc0` (T076) · `ef1ac35` (T077) |

"git history": `git log --diff-filter=D -1 --format=%h -- docs/tasks/<file>` finds the commit that removed a spec; its
parent (`<hash>^`) still holds it.

## Writing a task spec

Follow the shape the earlier specs used: scope and fixed choices, an implementation contract, deliverables, tests,
acceptance, and what is explicitly out of scope. Every rule in a spec must be traceable to a design doc or a decision
entry; if a task needs a new rule, it updates the design doc and appends a decision in the same PR. A new minigame
follows [Minigame kit — Adding a minigame](../design/minigame-kit.md#10-adding-a-minigame).

Agents: read [AGENTS.md](../../AGENTS.md) first. Work on a branch and open a pull request. Never push to `main`.
