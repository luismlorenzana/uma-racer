# Milestone 29 — RPG chapter rollout across all scenarios

**Outcome:** after M028's first playable real chapter, every one of the fourteen current training scenarios has a
distinct, privately authored RPG chapter and an earnable scenario-specific Inspiration token. The chapter picker
permits any five-outfit party to enter any published chapter with a recommended-level warning, not an order gate.
This milestone is not permission to put PriConne rows/art in git. Read [RPG design](../design/uma-rpg.md),
[technical contract](../technical/uma-rpg-implementation.md), [first release record](../research/rpg-release-acceptance.md),
D224/D257 and `AGENTS.md`. M028's retired spec is retained in git history (see the task index).

## Delivery sequence

| Task | Private chapter coverage | Required public PR evidence |
|---|---|---|
| [T100](T100-rpg-chapters-2-5.md) | Tiers 2–5: Unity Cup, Trackblazer, Our Grand Concert, Grand Masters | Schema/validator adjustments, pack hashes, aggregate graph/art/replay report |
| [T101](T101-rpg-chapters-6-9.md) | Tiers 6–9: Project L'Arc, U.A.F. Ready GO!, Great Food Festival, Run! Mecha Umamusume | Same, plus stronger mid-tier party/EXP regression |
| [T102](T102-rpg-chapters-10-14.md) | Tiers 10–14: The Twinkle Legends, Design Your Island, Yukoma Hot Springs, Beyond Dreams, Tracen Diner | Same, plus later-tier/promotion/legacy checks |
| [T103](T103-rpg-all-chapter-closure.md) | All fourteen together | Full coverage validator, cross-chapter pacing, catalog/browser/device checks |

T100–T102 are batches of **private content authoring/publishing plus validation**, not invitations to copy rosters
into a PR. Each task has one code/docs PR based on latest `main`; any importer/schema fixes and synthetic tests go
there, with only aggregate private validation output and content hashes. The owner/Claude publishes the matching
gitignored pack through the existing private process before the batch is called complete. If the pack is absent,
leave the task open; do not mark it done because its schema compiles. T103 runs after all three batches.

## Common chapter acceptance

Every scenario chapter has its own stable scenario id, at least one meaningful branch/rejoin, previews identifying
actual opposing playable-character teams and affinities, a telegraphed phase-changing boss, authored recommended
level, complete portrait/action references and one clear token of the **matching** scenario. Normal enemies are
playable PriConne characters; no generic-monster or synthetic production fallback. Content authoring varies teams,
roles, element pressure and route tradeoffs; it does not merely reskin the first chapter. First-entered battles and
paused checkpoints retain their old content version when a later pack is published.

Each batch runs the checked-in synthetic tests, `pnpm lint`, `pnpm test`, `pnpm build`, RPG sims and a private
validator/dry-run reporting only counts, zero unresolved references and pack hash. T103 proves 14/14 chapters and
14/14 scenario-token destinations, all playable/replayable with idempotent rewards. Startup gzip remains ≤180 KB;
content and RPG routes stay lazy. Screen changes get 390×844 and smaller-iPhone screenshots. Delete each spec in its
delivery PR (D104); delete M029 with T103 once all chapters are verifiably published.

**Out of scope:** new class system, PvP, battle consumables, race outcomes, infrastructure/workflows/env edits and
checking extracted data/art into git. Future scenarios require a new content batch, not silent reuse of an old token.
