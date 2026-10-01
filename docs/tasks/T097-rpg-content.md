# T097 — Private PriConne chapter content pipeline

**Goal:** supply a real first chapter of playable PriConne character-team opponents without putting third-party
data or art in git. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[RPG research](../research/uma-rpg.md), `AGENTS.md` and the T096 chapter schema. Depends on T096.

## Scope and contract

- Build importer/validator and runtime lookup for a versioned private RPG content pack: playable character IDs,
  chapter node rosters, roles, kits, affinity/formation, boss phases, portrait/art references and source/provenance
  metadata. Validate graph, skill, image and content-version references before publish. Runtime content mismatch or
  missing pack is a clear unavailable state; it never substitutes checked-in synthetic enemies.
- Follow the existing `content/` and `scripts/*/.cache/` gitignored pipeline. Check in **only code, schemas, small
  invented fixtures and documentation**. Real official-site extracts, names/rows, downloaded images, generated
  atlases and manifests remain private. No live network in tests and no production infrastructure edits.
- Coordinate a first complete scenario chapter with the owner/Claude-owned private content process: curated playable
  PriConne teams throughout, meaningful route choices, intended affinities, a phase-changing boss, portraits and
  verified source links/variants. The code PR must state what private pack version is required; publishing it is a
  separate owner action and T099 release gate, not a reason to commit the rows.

## Acceptance

Synthetic fixture import/validation and missing/stale-pack tests pass. A private dry run reports chapter node/skill/
art coverage, content hash/version and zero unresolved references without printing private rows into logs or PR.
`pnpm lint`, `pnpm test`, `pnpm build` and relevant RPG replay sim pass. Update architecture/content docs and remove
this spec in its PR (D104). If private authoring or publish is unavailable, say so in the PR and leave T099 blocked.

**Out of scope:** publishing credentials/infra changes, all fourteen chapters, monster fallback and checked-in art.
