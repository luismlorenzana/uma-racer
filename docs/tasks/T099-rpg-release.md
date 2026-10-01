# T099 — Playable RPG release and device acceptance

**Goal:** expose the RPG only when the real, privately published URA Finale chapter, progression and Inspiration reward
work end to end. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[implementation contract](../technical/uma-rpg-implementation.md), [Minigame kit](../design/minigame-kit.md),
[release runbook](../technical/infrastructure.md#release-runbook) and all landed T089–T098 contracts. Depends on
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

## Go/no-go evidence, not just a demo

- **Content:** authenticated production manifest contains the validated first chapter and art pack; local/private
  validator reports zero dangling references and a reproducible hash. The app never renders synthetic enemies when
  that pack is absent. An old frozen entry either finds its exact referenced version or shows a recovery error.
- **Progress and economy:** one normal fight, loss/retry, boss clear and voluntary replay produce exactly the
  accepted encounter/clear receipts. After reload/reconnect, outfit EXP, tree points, Items and Inspiration branch
  state agree with the ledgers. Pending offline result is visibly pending and unspendable. A second device takes over
  the same frozen entry; the stale device cannot commit. Race/Training/Farm resources are unchanged.
- **Experience:** no hidden role quota, five portraits readable at 390×844, weapon/element overlays across hub/map/
  battle/result, paged guide reachable from hub and battle, weakness/intent labels usable without color, 44 pt
  targets, `pb-safe`, reduced motion, VoiceOver, no battle document scroll and no startup Pixi/content import.
- **Release:** attach screenshots for hub, map fork, mid-fight, result/promotion and token spend at 390×844 plus a
  smaller iPhone layout. Record build commit, private pack hash/version, startup gzip and RPG chunk. CI green is
  necessary; owner physical-iPhone sign-off remains a distinct required acceptance. Do not merge as completed if
  content publication or owner sign-off is missing. M029 then owns the other thirteen scenario chapters.

## Acceptance

`pnpm lint`, `pnpm test`, `pnpm build`, RPG progression/combat/replay sims and any touched existing sims pass. Startup
gzip ≤180 KB; report RPG chunk size. The real-content flow above is repeatable without duplicate EXP/items or
seed changes. Private pack is published and visible in the deployed app. Owner device sign-off is recorded; if it
cannot be obtained, report the release as unverified and keep the task open instead of claiming completion.

**Out of scope:** fourteen fully authored chapters (M029), battle consumables, further class weapons/respec and new
infra. T099 is the first real chapter release, not a claim of full scenario coverage.
