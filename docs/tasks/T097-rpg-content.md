# T097 — Private PriConne chapter content pipeline

**Goal:** supply a real **URA Finale (tier 1)** first chapter of playable PriConne character-team opponents without putting third-party
data or art in git. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[implementation contract](../technical/uma-rpg-implementation.md), [RPG research](../research/uma-rpg.md),
`AGENTS.md` and the T095 chapter schema. Depends on T095; coordinate with T096's EXP rules before publication.

## Scope and contract

- Build importer/validator and runtime lookup for a versioned private RPG content pack: playable character IDs,
  chapter node rosters, roles, kits, affinity/formation, boss phases, portrait/art references and source/provenance
  metadata. Validate graph, skill, image and content-version references before publish. Runtime content mismatch or
  missing pack is a clear unavailable state; it never substitutes checked-in synthetic enemies.
- Follow the existing `content/` and `scripts/*/.cache/` gitignored pipeline. Check in **only code, schemas, small
  invented fixtures and documentation**. Real official-site extracts, names/rows, downloaded images, generated
  atlases and manifests remain private. No live network in tests and no production infrastructure edits.
- Coordinate the complete URA Finale chapter with the owner/Claude-owned private content process: curated playable
  PriConne teams throughout, meaningful route choices, intended affinities, a phase-changing boss, portraits and
  verified source links/variants. The code PR must state what private pack version is required; publishing it is a
  separate owner action and T099 release gate, not a reason to commit the rows.

## Concrete pack and owner handoff

The checked-in **schema/validator** takes: chapter id+scenario id+version/hash; graph nodes/exits; for each encounter
stable enemy-team ids, positions, RPG-adapted affinities, action-kit references, intent/phase script, recommended
tier/level, and portrait/variant asset keys; for each character a private source URL, chosen variant and attribution/
provenance note. It rejects a missing referenced actor, skill, image, boss phase, scenario, graph edge or old-pack
hash. It also rejects any combat action not in T091's catalog shape. The runtime fetches through the existing
authenticated private-content manifest and keeps any old pack still referenced by an open checkpoint. No production
fallback to the synthetic test chapter.

The private authoring checklist delivered to the owner/Claude is **per chapter**: select playable PriConne teams
for normal/fork/elite/boss nodes; verify official character page and exact portrait URL/variant; author Uma RPG
role/element/action/intent/phase values (never copy source damage numbers); validate all art and graph refs; run a
private end-to-end replay against the published pack; publish through the existing private content process; provide
pack version/hash and aggregate coverage report. The initial chapter must have meaningfully different fork teams
and a boss phase that changes a telegraphed tactical relationship. The PR must not include names/rows/art extracted
for that pack; public research links and synthetic fixture labels are okay.

Provide `pnpm data:rpg:validate` or an equivalent documented command that can validate local private content without
network or credential access from CI. CI tests only invented fixtures. A content-version change may not mutate an
open frozen battle or silently reauthor its chapter. Missing old-version pack is visible and blocks continuation until
recovered, rather than rerolling with the newest pack.

## Acceptance

Synthetic fixture import/validation and missing/stale-pack tests pass. A private dry run reports chapter node/skill/
art coverage, content hash/version and zero unresolved references without printing private rows into logs or PR.
The owner handoff names the exact private file shape, command, publication responsibility and version/hash needed by
T099; otherwise this task is not accepted merely because an importer compiles.
`pnpm lint`, `pnpm test`, `pnpm build` and relevant RPG replay sim pass. Update architecture/content docs and remove
this spec in its PR (D104). If private authoring or publish is unavailable, say so in the PR and leave T099 blocked.

**Out of scope:** publishing credentials/infra changes, all fourteen chapters, monster fallback and checked-in art.
