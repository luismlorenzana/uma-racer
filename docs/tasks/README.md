# Tasks

This folder holds **only work that is planned or in progress**. A task spec is a delivery instruction, not a record.

- The **design docs are the source of truth** ([Overview](../design/00-overview.md) and the rest of the
  [documentation map](../../README.md#documentation)). They describe the game as it is meant to be and are updated as
  each task lands.
- [decisions.md](../decisions.md) is the append-only record of *why*.
- A task spec is **deleted when its work is merged and the design docs carry the result** (D104). The full spec stays in
  git history: `git show 463edb8:docs/tasks/T014-scenario-goals-and-journey.md`.

T001–T018 and the Milestone 6 plan were completed and removed on 2026-09-19; commit `463edb8` is the last one that
contains them. T024–T027 and M008 were **superseded** on 2026-09-20 rather than completed; `0a57f4c` is the last
commit that contains them.

## Current plan

The training rework (D119–D125) replaced the turn-based training loop with per-scenario constellations and
two minigames. **M008 and its remaining modifier tasks were deleted**, not completed: they specified
multipliers on a training turn that no longer exists.

| Milestone | Tasks | State |
|---|---|---|
| [M021 — Turn-based races](M021-turn-based-races.md) | T067 – T070; T066 complete | In progress · now |
| [M007 — Align and stabilize](M007-align-and-stabilize.md) | T023; T019–T022 complete | In progress |
| [M020 — Friendship Training](M020-friendship-training.md) | T063 · T064 · T065 | Specified · next |
| [M009 — Look and feel](M009-look-and-feel.md) | T030 · T031 · T032 | Specified |
| [M010 — Collection depth](M010-collection-depth.md) | T035; T033 and T034 complete | In progress |
| [M011 — Game feel and device readiness](M011-game-feel-and-device.md) | T036 – T039 | Outlined |

M012 (the constellation engine, save v5, and the removal of the training turn), M013 (the constellation
screen) and M014 (Spark Match and Bond Recall) all landed on 2026-09-21; `ac1c157` is the last commit that
contains their specs. T058 then connected both games to the save and was removed under D104.

T057 was consumed by the per-scenario limit-break branch and is not reused.

M016 (cards by scenario: the Training scene's Card set tab, card pages, ticket unlocks and the Cards tab lenses)
landed on 2026-09-22 and was removed under D104; D129–D131 and the design docs carry it.

M017 (career goals: stage-gated careers per scenario, goal plan v3, the Race tab's tracker and Next up) landed on
2026-09-24 and was removed under D104; D137–D138 and [Scenario Careers](../design/scenario-goals.md) carry it.

M018 (race engine v5: the verified spurt plan, hills, duels, gate and green skills, 41 more skill conditions, and
the race drawn on its own course) and T060 (the early stamina wall, resolved by D139–D140) landed on 2026-09-24 and
were removed under D104; D139–D141, [Racing](../design/racing.md#engine-v5-m018) and
[Race Engine v5 Findings](../research/race-engine-v5-findings.md) carry them.

T052 (the fourteen constellation silhouettes, drawn on a grid) landed on 2026-09-25 with the constellation's visual
pass and was removed from M015 under D104; D143 and [Constellations](../design/constellations.md#silhouettes) carry it.

M019 (stars and tickets: 0★–5★ per card per scenario, one ticket per run, save v7) landed on 2026-09-25 and was removed
under D104; D147–D148, D150 and [Support Cards](../design/support-cards.md#stars) and [Economy](../design/economy.md) carry it.

T059 (chibi and outfit-stand art, from the owner's local copy rather than the wiki) landed on 2026-09-26 with the race
face tokens and was removed under D104; D160 and [Collection](../design/collection.md#art-tiers) carry it.

M015 (scenario identity: crests on the Stable's icons, scenario-linked races, minigame-era training badges and the
fourteen scenario buffs) landed on 2026-09-26 and was removed under D104; D163–D165, [Scenarios](../design/scenarios.md#scenario-buffs),
[Badges](../design/badges.md) and [Collection](../design/collection.md#icon-overlays) carry it.

Task numbers never get reused, so a decision entry that mentions T014 always means the same work.

## Writing a task spec

Follow the shape the earlier specs used: scope and fixed choices, an implementation contract, deliverables, tests,
acceptance, and what is explicitly out of scope. Every rule in a spec must be traceable to a design doc or a decision
entry; if a task needs a new rule, it updates the design doc and appends a decision in the same PR.

Agents: read [AGENTS.md](../../AGENTS.md) first. Work on a branch and open a pull request. Never push to `main`.
