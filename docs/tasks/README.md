# Tasks

This folder holds **only work that is planned or in progress**. A task spec is a delivery instruction, not a record.

- The **design docs are the source of truth** ([Overview](../design/00-overview.md) and the rest of the
  [documentation map](../../README.md#documentation)). They describe the game as it is meant to be and are updated as
  each task lands.
- [decisions.md](../decisions.md) is the append-only record of *why*.
- A task spec is **deleted when its work is merged and the design docs carry the result** (D104). The full spec stays in
  git history; the table at the bottom names the last commit that holds each one.

## Current plan

| Milestone | Tasks | State |
|---|---|---|
| [M024 — Card Training Loop](M024-card-training-loop.md) | T078 three stars ✅ · T079 card training on its own ✅ · T080 card focus ✅ · [T081 Bond achievements](T081-card-bond-achievements.md) | **In progress** · T078–T080 landed; T081 next |
| [M028 — Global Uma RPG](M028-uma-rpg.md) | T089–T096 ✅ · T097 private pipeline/draft ✅ · [T098–T099](M028-uma-rpg.md#delivery-sequence) | **In progress** · Inspiration bridge next; private owner publication and release remain gated |
| [M029 — RPG chapter rollout](M029-rpg-chapter-rollout.md) | [T100–T103](M029-rpg-chapter-rollout.md#delivery-sequence) | **Specified, not implemented** · private content for the remaining thirteen scenarios and a 14/14 gate |
| [M010 — Collection depth](M010-collection-depth.md) | **[T035 — Race Select on the album engine](T035-race-select-browsing.md)**; T033 and T034 complete | Specified, delegable |
| [M011 — Game feel and device readiness](M011-game-feel-and-device.md) | T036 – T039 | Outlined: each spec is written when its task becomes next |

**M024 is the current unit of work** (D199–D202, D236): T078 and T079 landed on 2026-09-29 and T080 on 2026-10-02;
T081 is next. M025–M026's Farm and Produce bridge are complete. T035 stays specified and can be picked up any
time. **M027 — Training Rebalance** (D211–D214) is complete. Anything new starts with the next free numbers below.

The owner's device checks (every milestone's, including Spark Rival Circuit's physical-iPhone pass) wait in
[Open questions](../open-questions.md#needs-you-owner-actions-not-design-questions) and close together in T038 (D189).
Owner playability notes are fixed as they arrive, each under its own decision (D178 onward), rather than gathered into a
task.

**Next free numbers: M030 and T104.** Numbers are never reused, so a decision that mentions T014 always means the same
work. T057 was consumed by the per-scenario limit-break branch and is not reused.

## Completed and removed

Each row's specs are readable with `git show <commit>:docs/tasks/<file>`.

| Work | Landed | Carried by | Last commit with the specs |
|---|---|---|---|
| M027 — Training Rebalance (T087 linear levels and EXP bank, T088 spending Level-Up Tickets) | 2026-10-02 | [Training](../design/training.md#the-training-exp-bank-and-level-up-tickets), D211–D214 | git history |
| T089 — RPG pure progression rules | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#outfit-rpg-profile-and-progression), D227 and `packages/domain/src/rpg/` | `ce2aa37` |
| T090 — RPG save and grouped commands | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#five-member-combat-proposal), [Architecture](../technical/architecture.md), D228 | git history |
| T091 — RPG deterministic combat | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#settled-t091-combat-contract-d229), D229 and `packages/domain/src/rpg/combat/` | git history |
| T092 — RPG battle journal and host | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md), [Architecture](../technical/architecture.md), D230 and `apps/web/src/game/rpg-battle-host.ts` | git history |
| T093 — RPG roster and party hub | 2026-10-01 | [Global Uma RPG](../design/uma-rpg.md#phone-presentation), D232 and `apps/web/src/screens/rpg/` | git history |
| T094 — Phone battle screen | 2026-10-02 | [Global Uma RPG](../design/uma-rpg.md), D243 and [phone proof](../research/rpg-battle-phone-proof.md) | git history |
| T095 — Chapter maps and checkpoints | 2026-10-02 | [Global Uma RPG](../design/uma-rpg.md), D245, [content handoff](../technical/rpg-chapter-content.md) and [phone proof](../research/rpg-chapter-phone-proof.md) | git history |
| T096 — Battle EXP, skills and class promotion | 2026-10-03 | [Global Uma RPG](../design/uma-rpg.md), D246 and [phone proof](../research/rpg-progression-phone-proof.md) | git history |
| T097 — Private PriConne pipeline / URA draft | 2026-10-03 | [Content contract](../technical/rpg-chapter-content.md), D247 and [private publication handoff](../research/rpg-private-ura-handoff.md) | git history |
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
