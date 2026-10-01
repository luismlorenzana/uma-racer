# T100 — RPG chapters for scenario tiers 2–5

**Outcome:** Unity Cup, Trackblazer, Our Grand Concert and Grand Masters each have a published private RPG chapter
with their own token destination. Depends on completed M028, especially T097's private pipeline and T099's real-
chapter release. Read [M029](M029-rpg-chapter-rollout.md) and the [implementation contract](../technical/uma-rpg-implementation.md).

## Delivery contract

- Author one versioned private chapter per named scenario using T095's graph schema and T091's legal action catalog.
  Normal/fork/elite/boss teams use playable PriConne characters; each chapter has a distinct role/affinity and route
  decision. Verify official portrait URL/variant and all local image/skill refs privately. Do not commit rows/art.
- Run the private validator for each chapter: reachable boss, no dangling nodes/actors/actions/images, semantic
  preview and intended scenario id. Fix importer/schema issues with **invented** fixtures in this PR only if needed.
  Publish the four packs privately; record version/hash and aggregate counts, not roster contents, in the PR.
- Browser-play one route and one alternate/retry per chapter; confirm four matching token item ids, no cross-tier
  grant, free entry, same-seed resume and no reward duplication after reconnect. A chapter missing its pack is
  unavailable individually while already-published chapters remain playable.

`pnpm lint`, `pnpm test`, `pnpm build`, RPG combat/progression/replay sims and private validation pass; report startup
gzip and affected RPG chunks. Any screen change gets 390×844 and small-iPhone screenshots. Update design's chapter
coverage table and delete this spec in the same PR (D104). Do not call T100 done before private publish succeeds.

**Out of scope:** tiers 6–14 and changing the global class/EXP system to disguise a bad chapter.
