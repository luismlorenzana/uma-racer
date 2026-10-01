# T099 — Playable RPG release and device acceptance

**Goal:** expose the RPG only when the first real, privately published chapter, progression and Inspiration reward
work end to end. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[Minigame kit](../design/minigame-kit.md), the release runbook and all landed T089–T098 contracts. Depends on
T093–T098 **and** a verified private first-chapter publish.

## Scope and contract

- Gate the Home RPG entry on validated runtime content availability. A missing/outdated pack shows an honest
  unavailable explanation, never synthetic production opponents. Add the in-mode paged guide for party/class choice,
  weapon/element legend, MP, action/weakness, checkpoints/resume, promotion and where scenario tokens go.
- Run one real-content scenario path: enroll five outfits, save preset, choose chapter, inspect route/enemies, win/lose
  and retry, pause/reload/switch devices, clear boss, see RPG EXP/skills, promote if eligible, receive a token in Items
  and spend it on a parent branch. Verify idempotence by reopening result and reconnecting after clear. Record pack
  version/hash, not private roster data, in the PR.
- Check 390×844 and a smaller iPhone viewport, thumb targets/safe areas/no battle page scroll, VoiceOver labels,
  text/glyph affinity cues, reduced motion, offline/background return and a long battle/chapter. Attach map, mid-fight,
  result and Inspiration screenshots. Request the owner's physical-iPhone sign-off; a browser pass is not that sign-off.
- Remove development-only synthetic route affordances from production while keeping synthetic test fixtures. Update
  README/status, RPG design's “today” notes, architecture and task index; delete the final M028/T099 specs when the
  release PR merges (D104).

## Acceptance

`pnpm lint`, `pnpm test`, `pnpm build`, RPG progression/combat/replay sims and any touched existing sims pass. Startup
gzip ≤180 KB; report RPG chunk size. The real-content flow above is repeatable without duplicate EXP/items or
seed changes. Private pack is published and visible in the deployed app. Owner device sign-off is recorded; if it
cannot be obtained, report the release as unverified and keep the task open instead of claiming completion.

**Out of scope:** fourteen fully authored chapters, battle consumables, further class weapons/respec and new infra.
