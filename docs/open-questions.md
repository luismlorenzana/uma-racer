# Open Questions

Every earlier design question has been resolved and logged in [decisions.md](decisions.md) (see D49–D58).

## ⭐ New finding for the morning (2026-09-15)

1. **Race stat scale.** The R1 race engine shows our stat caps are stamina-starved under the original HP formula: tier 1
   Mile, Medium, and Long fields run out of HP almost every race. → *Recommend:* a single `raceStatScale ≈ 1.75`,
   applied with Race Form before the engine, so the design's cap numbers stay as approved. Data and reasoning:
   [Race Engine R1 Findings](research/race-engine-r1-findings.md).
   (Strategy balance — Front Runners never winning — is expected until position keeping (R3) and recovery skills (R2.5) land.)

Draft numbers across the design docs (curves, costs, thresholds) are **tuning values**, not open questions. They get
adjusted through balance simulation and playtesting.

## Needs you (owner actions, not design questions)

- **Create the private GitHub repo** `luismlorenzana/uma-racer`. The scaffold is local only, with no remote and no commits.
- **Create the `uma-racer` Firebase/GCP project** and run the bootstrap. Steps are in [Infrastructure](technical/infrastructure.md#one-time-bootstrap-run-by-the-owner). They need your Google account, so Claude doesn't do them.

## Not questions, but still to come

- **Data research:** facts to gather from the original game, tracked in the [data backlog](research/data-backlog.md).

## Process

If a new question comes up, it goes here with a recommendation, gets resolved in the same session where possible, and
then moves to the decisions log.
