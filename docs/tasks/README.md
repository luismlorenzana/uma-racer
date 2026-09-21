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
| [M007 — Align and stabilize](M007-align-and-stabilize.md) | T023; T019–T022 complete | In progress |
| [M012 — Constellation foundations](M012-constellation-foundations.md) | T042 · T043 · T044 · T045 | Next |
| [M013 — The constellation screen](M013-constellation-screen.md) | T046 · T047 · T048 | Specified |
| [M014 — Minigames](M014-minigames.md) | T049 complete · [T050](T050-bond-recall.md) | In progress |
| [M015 — Scenario identity](M015-scenario-identity.md) | T051 · T052 · T053 · T054 | Outlined |
| [M009 — Look and feel](M009-look-and-feel.md) | T030 · T031 · T032 | Specified |
| [M010 — Collection depth](M010-collection-depth.md) | T035; T033 and T034 complete | In progress |
| [M011 — Game feel and device readiness](M011-game-feel-and-device.md) | T036 – T039 | Outlined |

M012 and M014 are built **in parallel** against the `MinigameHost` port defined in
[M014](M014-minigames.md#the-host-port), so the constellation engine and the minigames never touch the same
files.

Task numbers never get reused, so a decision entry that mentions T014 always means the same work.

## Writing a task spec

Follow the shape the earlier specs used: scope and fixed choices, an implementation contract, deliverables, tests,
acceptance, and what is explicitly out of scope. Every rule in a spec must be traceable to a design doc or a decision
entry; if a task needs a new rule, it updates the design doc and appends a decision in the same PR.

Agents: read [AGENTS.md](../../AGENTS.md) first. Work on a branch and open a pull request. Never push to `main`.
