# T096 — Branching RPG chapters and checkpoints

**Goal:** make one complete authored-shape chapter playable with invented test opponents and durable map progress.
Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md), D219–D220 and T090/T092 contracts. Depends on
T090, T092, T094 and T095.

## Scope and contract

- Define a versioned chapter schema: scenario destination, recommended tier/level, surface/distance theme,
  branching/reconverging nodes, opponent team/formation, visible element and role preview, recovery/setup points,
  telegraphed boss phases and clear identity. Validate graph reachability, terminal boss and referenced assets/skills.
- Pure map transition rules preserve one checkpoint per preset+chapter. Switching chapter pauses rather than erases
  another; five filled slots are required to start. The player sees an advisory low-level warning, not a gate. Each
  entered battle freezes the chapter version and current party/kit; loadout edits happen only at cleared checkpoints.
- Present a lazy mobile map with route choices, enemy-team previews and resume/loss/retry. A loss keeps prior cleared
  nodes/rewards; free retry starts the same frozen entry. Only a voluntary post-boss replay creates a new attempt.
  Test a small **synthetic** branching chapter in git; do not include PriConne rows or art.

## Acceptance

Graph tests reject dead ends, invalid teams and version drift. Browser flow proves branch choice, boss clear,
pause/switch/resume, two-device conflict and free loss retry without extra rewards. Screenshots at 390×844 and
375×667; `pnpm lint`, `pnpm test`, `pnpm build` and replay sim pass, startup gzip ≤180 KB. Update design/architecture
and remove this spec in its PR (D104).

**Out of scope:** private content publish, Inspiration grant/sink, Home entry and all-fourteen-chapter coverage.
