# Milestone 6 — Badges & Flair implementation plan

**Outcome:** every Uma and the Trainer gain a truthful, syncable accomplishment history. Per-Uma badges/titles/trophies,
Prestige, the full Badge page/showcase/timeline, Trainer achievements/records/profile, and all action feedback are complete
without changing gameplay rewards or committing original-game data.

Milestone 5 already supplies exact race results, finite lineage, skill history, scenario completion snapshots, and tracked
Journey facts. Milestone 6 deliberately adds missing fact capture before awards or UI so retroactivity and retries remain
correct.

## Delivery sequence

```text
T014 Journey/race facts (complete)
        │
        ▼
T015 accomplishment facts + badge-state v1
        │
        ▼
T016 per-Uma catalog/evaluator + flair events + action feedback
        │
        ▼
T017 Badge page + Uma/Stable scopes + title/showcase/timeline
        │
        ▼
T018 Trainer evaluator + records + Trainer scope/profile
```

| Task | User-visible result | Architectural result | Must not absorb |
|---|---|---|---|
| [T015](T015-accomplishment-facts-and-badge-state.md) — complete | No new award UI; existing play remains identical | Private series/venue tags, race fact snapshots, badge-state v1, honest bootstrap, atomic future facts | Award rules, fanfare, page, Trainer achievements |
| [T016](T016-per-uma-badges-titles-and-awards.md) — complete | Awards on Results/Training/scenario actions; Home/Profile recent flair, title, frame | Catalog v1, monotonic evaluator, append-only flair logs, retroactive awards | Full collection UI/preferences, Trainer aggregation |
| [T017](T017-badge-page-showcases-and-timeline.md) | Complete Uma/Stable Badge page, detail, trophies, timeline, title/pins/groups/views | Pure collection projections and preference-only atomic writes | Trainer achievement truth |
| [T018](T018-trainer-achievements-and-profile.md) | Trainer scope/profile, achievements, records, pinned Umas/showcase, Stable feed | Incremental account aggregates plus authoritative reconciliation | Polish/R4/social systems |

Each task is one branch/PR and must leave `main` playable. Do not combine tasks merely because later types are sketched in
T015; the intermediate acceptance gates are intentional rollback points.

## Cross-task invariants

### Privacy and content

- No source dataset rows, live ids/names/mappings, images, generated packs, or ignored overrides enter git. Fixtures are
  small and invented.
- Race-set/main-venue classification lives in `content/overrides/flair.json`; runtime receives only normalized semantic
  tags through authenticated private content.
- Dynamic labels join current private content. Persisted identities and safe fallbacks never depend on mutable names.

### Persistence and atomicity

- Profile/Uma stay save v2. Badge state has an independent version and lives in the reserved `badges` entity collection.
- Race results and flair events are append-only logs. Badge entities contain bounded current facts/awards/preferences.
- All changed game entities, badge/Trainer entities, logs, ledgers, and outbox work commit in one Dexie transaction; store
  publication follows commit. Retry is idempotent by deterministic action/evidence/event ids.
- The server validates strict shape/version/id relationships but does not reevaluate client game rules.
- A newer/corrupt badge schema is recoverable and visible; it is never reset or replaced with empty state.

### Retroactivity

- Exact durable history awards exactly. Lower-bound history displays “at least.” Missing dependencies display untracked.
- Awards are monotonic and never revoked. “All” criteria freeze the applicable denominator/catalog version when awarded.
- Bootstrap/reconciliation is deterministic under input ordering, transactional, resumable, and shows at most one archive
  summary instead of replaying every historical fanfare.

### Catalog and UX

- Catalogs are semantic, data-driven, versioned, generically evaluated, tagged, and pinned by domain tests.
- Flair never pays tickets/coupons/shards/stats/EXP/SP and never changes simulation.
- Hidden definitions leak no name, criterion, search text, or completion denominator before earning.
- Tier is communicated by shape+label as well as color. Controls are ≥44 pt; reduced motion is equivalent; route code is
  lazy; startup remains ≤180 KB gzip.
- No dependency is added unless the task proves the existing stack cannot safely meet the requirement and the PR justifies
  the bundle/maintenance cost.

## Fact availability matrix at T015 migration

| Criterion family | Existing evidence | Migration grade |
|---|---|---|
| Starts, placements, wins, streak, grade/surface/distance/strategy, G1 families/course times | Typed race results + current private race join | Exact when content resolves |
| Start/section/final-spurt/activation feats | Frozen versioned replay | Exact when replay/content resolves; otherwise untracked |
| Level/stat peaks | Current Uma (monotonic values) | Exact |
| Skills | Lifetime skill history + current library | Exact |
| Goals/Honors | T014 tracked Journeys/result ids | Exact for tracked tiers; legacy tiers untracked |
| Graduate/Speedrun | reached tier/Journey + race sequences | Exact |
| Current-scenario Training turns/TL10 | current counters/TL | Lower bound / exact active evidence |
| Past friendship, Full House, TL10, completion deck/stats | Not previously stored | Since tracking / untracked past |
| Parent/grandparent uses still present in finite lineage | current lineage/latest snapshots | Lower bound |
| Earlier discarded lineage | Not previously stored | Since tracking |
| Collection/redemption facts | canonical entities + ledger | Exact |

## Catalog-v1 boundary

Catalog v1 includes all fixed/dynamic definitions enumerated in [Badges](../design/badges.md), including private-tag race
sets, repeat-G1 titles, trophies, race feats supported by v1–v3 replay, stats/scenarios, Training, goals, skills, and lineage.

Explicitly not part of Milestone 6 completion:

- `Duelist`, spot struggle, rushed, slopes, or other race-engine R4 facts;
- `Upset` until a per-runner rating is documented;
- sound, haptics, bespoke icons/art, night theme, and 120 Hz physical tuning;
- rewards/currency, social/global rarity, sharing, public profiles, leaderboards, or server authority.

The UI omits deferred criteria rather than showing permanently fake locked tiles.

## Integration surfaces

| Existing action/surface | Milestone 6 integration |
|---|---|
| Content import/runtime | normalized semantic flair tags; strict validation; aggregate diagnostics |
| Boot/cloud adoption | T015 fact bootstrap → T016 award migration → T018 Trainer reconciliation before ready |
| Training | facts and per-Uma/Trainer awards in existing transaction; compact post-result feedback |
| Race completion | immutable facts + goal evaluation + per-Uma/Trainer events/ids in existing transaction |
| Scenario Start | direct-parent Legacy evidence/awards; no draft writes |
| Promotion/final completion | completion facts, Graduate/Perfect/Speedrun/Honors, Dynasty, Trainer aggregates |
| Home | featured recent flair, then Stable recent feed |
| Stable/Profile | Prestige frames/title; Profile first 12 showcase pins and Journey links |
| Results | goal feedback, then per-Uma flair, then Trainer achievements; exact reload summary |
| Badge tab | T017 Uma/Stable, T018 Trainer; search/filter/sort/detail/timeline/preferences |

## Milestone-wide verification

Every task runs its targeted tests plus `pnpm lint && pnpm test && pnpm build`. T015 and any content-shape change also run
the live private importer and confirm ignored outputs. T016–T018 perform 390×844 normal/reduced-motion smoke tests with
missing content, refresh/deep links, offline/memory-only state, and no console errors. T017/T018 additionally measure long
catalog/timeline interaction and perform the owner iPhone check when available.

Milestone 6 is complete only when:

- T015–T018 are merged and their task implementation-status sections are updated;
- the full local/CI gate passes and production deploy verification succeeds;
- the Badge page's three scopes, all atomic award paths, cross-device sync, and honest legacy states work;
- README marks Milestone 6 complete and points to Milestone 7 polish;
- no private content/override/cache is tracked and the startup entry remains ≤180 KB gzip.

## Risk controls

| Risk | Control |
|---|---|
| Badge work corrupts progression saves | Independent badge-state version; strict parsing; atomic rollback |
| Historical awards are fictional | Exact/lower-bound/untracked provenance and no zero-as-history assumption |
| Retry duplicates awards/fanfare | Evidence keys, deterministic flair ids, stored fresh-event ids |
| Trainer totals drift | Incremental updates checked against authoritative reconciliation |
| Private identifiers leak | Ignored override, semantic tags, aggregate diagnostics, synthetic fixtures |
| Large catalog hurts startup/scroll | Lazy route, pure projections, windowing/content visibility, bundle gate |
| Drag is poor/inaccessible on iPhone | Full Move up/down/group controls; drag only enhancement |
| Catalog/content expansion revokes flair | Monotonic awards and frozen “all” denominators |
