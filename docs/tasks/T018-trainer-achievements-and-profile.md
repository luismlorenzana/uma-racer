# T018 — Trainer achievements, records, and profile (Milestone 6, part 4)

**Goal:** close Milestone 6 with account-wide achievements and records derived from the same durable collection, race,
Journey, lineage, and per-Uma badge facts. Enable the Badge page's Trainer scope, Trainer profile/showcase, pinned Umas,
stable-wide recent flair, and fully local-first incremental/reconciled aggregation without duplicating or fabricating
per-Uma truth.

Depends on: `T017-badge-page-showcases-and-timeline.md`.

Read first: `AGENTS.md`, `docs/design/badges.md`, `docs/design/collection.md`, `docs/design/uma-progression.md`,
`docs/design/ux.md` §§Home/Stable/Badges, `docs/technical/architecture.md`, `docs/decisions.md`, T003, T009–T017.

## Scope and fixed choices

- Trainer achievements use the same Bronze → Rainbow tier order and points-as-label system as badges, but never add to an
  Uma's Prestige and never pay currency. Their exact thresholds are the frozen tables in `collection.md`.
- Trainer truth lives in the `badges/trainer` entity shell introduced by T017. It has T015's strict state version and a
  trainer-specific evaluator/catalog watermark, aggregate facts, earned stages, records, display preferences, showcase,
  pinned Uma order, and saved Trainer views.
- Stable scope remains a live derivation from known owned Uma states. Trainer state stores bounded account aggregates plus
  per-contributor fingerprints/watermarks so updates/reconciliation are idempotent; it does not copy every badge/timeline.
- Every gameplay/collection action that can cross a Trainer threshold updates Trainer state and appends Trainer flair in
  the same Dexie transaction. A content-ready reconciliation repairs missed/stale aggregates from authoritative local
  entities/logs before publishing ready state.
- “All” thresholds freeze their denominator/catalog version when awarded and are monotonic. Later private content may make
  current completion less than all, but cannot revoke an earned achievement.
- Trainer display name is a local-first preference in trainer badge state, not a profile save-v3 migration. Default is
  `Trainer`; a custom trimmed name is 1–32 Unicode characters after normalization.
- Trainer showcases may reference earned Trainer achievements or earned per-Uma flair with the owning Uma id. A missing
  current content join keeps a safe reference; an unearned reference is invalid.
- No currency, new gameplay criteria, social/global rarity, sharing, leaderboard, sound, haptics, bespoke art, dependency,
  or startup-bundle regression. Keep the entry chunk ≤180 KB gzip.

## Deliverables

### 1. Data-driven Trainer catalog

- Define `TRAINER_ACHIEVEMENT_CATALOG_VERSION = 1` with checked-in semantic definitions, exact thresholds, tags,
  visibility, criterion kind, and source drill-down. Use generic handlers rather than one function per row.
- Implement the collection achievements from `collection.md`:
  - Stable Master: owned Umas `30 / 40 / 60 / 90 / all current catalog`;
  - Card Collector: owned SSR cards `10 / 25 / 50 / 100 / all current catalog`;
  - Maxed Out: cards at LB4+level 25 `1 / 5 / 15 / 40 / 100`;
  - one-off `[Era] Complete` and `[Type] Complete` for every applicable current private-content bucket;
  - Coupon Clipper: successful Card+Uma coupon redemptions `1 / 5 / 15 / 40 / 100` (shard-to-coupon exchanges do not count).
- Implement stable-total achievements:
  - Stable Wins `10 / 100 / 500 / 1,500 / 5,000`;
  - Stable G1s `1 / 10 / 50 / 150 / 500`;
  - Stat Badges `5 / 25 / 75 / 200 / 500` counting earned Speed/Stamina/Power/Guts/Wit/Balanced stages;
  - Badge Hoarder `25 / 150 / 500 / 1,500 / 5,000` counting every earned per-Uma badge stage/one-off/Ribbon/Honors,
    but excluding titles and trophies;
  - Title Holders `1 / 5 / 10 / 20 / all`, counting distinct title definition keys held anywhere in the Stable;
  - Graduations `5 / 25 / 75 / 200 / 500` completed-scenario facts across all Umas;
  - Veteran Stable: Umas level 50+ `1 / 3 / 10 / 25 / 50`;
  - Legendary Stable: Umas at current maximum level `1 / 3 / 5 / 10 / 25`;
  - Heirs: Scenario Starts with at least one direct parent `5 / 25 / 100 / 250 / 1,000`;
  - Stable Goals `5 / 25 / 100 / 300 / 1,000` exact completed tracked goals;
  - Honors Collector `1 / 10 / 30 / 100 / 300` exact Honors;
  - Family Tree `2 / 5 / 10 / 25 / 50` distinct Umas with at least one evidenced direct-parent use.
- “All” in Title Holders means the eight enabled fixed race-set titles plus the Two-Time and Three-Time title for every
  retained G1 family in that private catalog version. Content-disabled title sets are excluded; the entire applicable key
  set is frozen with the earned stage.
- Dynamic era/type completion definitions use private content ids/labels only at runtime; checked-in fixtures are invented.
  An empty bucket is inapplicable, not automatically complete.
- Add all thresholds and “all” denominator rules to the domain pinning test.

### 2. Aggregate facts and deterministic reconciliation

- Add strict trainer aggregate types for collection counts/bucket completion, redemptions, race wins/G1s, per-Uma award
  stage totals, distinct titles, graduation/goal/Honors totals, level gates, parented starts, parent holders, and contributor
  fingerprints/watermarks.
- Derive collection facts from current known private catalog plus canonical owned Uma/card entities. Orphaned saves are
  surfaced but do not inflate denominators/numerators. A future-era owned card still counts as owned.
- Derive per-Uma totals from strictly parsed T015/T016 badge states, not UI projections. Reject duplicate Uma states and
  treat a malformed/newer contributor as a recoverable Trainer reconciliation error instead of silently undercounting.
- Derive redemption totals from target-keyed coupon-spend ledger reasons. Matching retry rows count once; shard exchanges,
  initial grants, and card-max grants do not count.
- `reconcileTrainerState` sorts contributors by stable id and returns byte-identical output under input reordering. It
  preserves monotonic awards/preferences while replacing current aggregate facts and contributor fingerprints.
- At boot/content update, reconcile when state/catalog/content/contributor fingerprints differ. Write trainer entity,
  newly earned Trainer flair events, and one coalesced outbox row atomically. Retry is idempotent; unchanged input is a
  write-free no-op.
- Full reconciliation is authoritative repair. Incremental commands below may optimize normal play but must produce the
  same parsed state/events as reconciliation, verified by property-style synthetic sequences.

### 3. Incremental atomic evaluation

- Implement pure deltas for every existing action that can change Trainer facts:
  - new starter/coupon Uma or card acquisition;
  - card promotion/max and Uma level/final completion;
  - Card/Uma coupon redemption and shard exchange (only actual redemptions increment Coupon Clipper);
  - race completion and its per-Uma badge/title/goal changes;
  - Training/per-Uma badge changes;
  - Scenario Start with parents, promotion, and Dynasty/Graduate/Honors changes.
- The action transaction re-reads trainer state and all directly affected contributor entities/logs, applies the per-Uma
  mutation first, updates aggregate facts, evaluates Trainer achievements, appends deterministic `scope: trainer` flair
  events, writes trainer outbox, then publishes all Zustand changes after commit.
- An action may award both per-Uma flair and Trainer achievement tiers. Results/Training/scenario feedback serializes the
  per-Uma list first, then a compact Trainer section; exact fresh event ids are returned by the committed command.
- Retry/no-op/same-target redemption cannot double count or replay fanfare. Same deterministic Trainer event id with a
  different payload is corruption. A Trainer write/log failure rolls back the entire originating gameplay action.
- If the trainer shell is absent on a valid older local save, initialize/reconcile it inside the action transaction rather
  than losing the action or writing a partial delta.

### 4. Stable records

- Derive and strictly store these records with value plus exact source Uma/result/event when available:
  - highest single stat ever observed and owning Uma/stat;
  - most wins by one Uma;
  - most G1 wins by one Uma;
  - most earned badge stages by one Uma;
  - biggest winning margin;
  - longest win streak.
- Record ties use earliest source timestamp, then stable Uma id, then source id. Later equal values do not replace the
  holder. A strictly better value replaces current display but does not emit an achievement/flair event by itself.
- Current/max stat history uses T015 peaks; race records use authoritative result/fact state. Missing content changes only
  labels/links, never the stored holder/value.
- Reconciliation recomputes the same records from contributor states/logs and repairs stale incremental values.

### 5. Trainer Badge scope and profile

- Enable T017's **Trainer** scope. It uses the same search/filter/sort/tile/detail/saved-view framework with Trainer
  achievement category/status/tier/date filters and no irrelevant race aptitude/venue filters.
- Trainer tiles show current stage, next threshold/progress, history provenance, frozen “all” denominator when earned, and
  holder/source drill-down. Dynamic Era/Type completion labels come from private content with safe ids.
- Add a Trainer profile surface reachable from Trainer scope/Home/Settings containing display name, stable completion
  meters, current achievement counts, showcase, pinned Umas, records, and recent Stable flair.
- Display-name edit is explicit confirm/cancel, strict 1–32 normalized characters, and an atomic preference-only trainer
  entity update. It never changes Firebase identity or auth.
- Pinned Umas are an unlimited duplicate-free ordered list of currently owned ids. Missing-content owned Umas remain pinned
  with safe ids; no-longer-owned/corrupt refs are rejected. Use the same pointer+accessible reorder semantics as T017.
- Trainer showcase uses T017's default+20-group model and can pin earned Trainer achievements or earned per-Uma award refs.
  Per-Uma refs include Uma id+award key and display current highest stage while preserving order.
- Home receives a compact Stable recent-flair strip only after featured-Uma content; it merges per-Uma and Trainer events,
  excludes hidden-unearned data by construction, and links to exact details.

### 6. Completion, sync, and UX behavior

- Cloud adoption/new device downloads per-Uma badge states, trainer state, and flair logs; the coordinator reconciles before
  ready and preserves newer local preference mutations through entity-version rebase.
- A content update recomputes current collection completion/progress and dynamic definitions. Earned “all” stages preserve
  their frozen denominator/catalog evidence; unearned progress uses the new current denominator.
- Missing private content, offline boot, and memory-only play have explicit safe states. The Trainer profile/page never
  blocks ordinary gameplay solely because a nonessential display join is missing.
- Achievement fanfare reuses T016's cards after per-Uma flair. Bootstrap reconciliation collapses retroactive Trainer awards
  into one archive summary; reload does not replay it.
- Use Motion `m.*`, transform/opacity only, tier shape+label beyond color, safe areas, ≥44 pt controls, and windowed lists.
  Trainer routes remain lazy; startup stays ≤180 KB gzip.

### 7. Tests, documentation, and milestone closure

- Fixtures are invented and small; no original ids/names/data/art enter git. Tests make no network request.
- Domain tests cover every achievement boundary, dynamic buckets, exact exclusions, “all” freezing, contributor ordering,
  aggregation, record ties, evaluator/event idempotency, and incremental-vs-reconcile equivalence.
- Persistence/API tests cover every action delta, dual per-Uma/Trainer awards, rollback, retry, ledger counting, bootstrap/
  repair, catalog/content update, outbox/coalescing/conflict rebase, cloud adoption, missing contributors, and memory-only.
- Pure web tests cover Trainer filters/sorts/details, frozen denominators, profile meters/records, display-name validation,
  pinned Umas, mixed showcase refs, recent Stable flair, missing content, and fresh/reloaded fanfare.
- Update README to mark Milestone 6 complete and identify Milestone 7 polish next. Update badges/collection/UX/architecture,
  task statuses, decisions, and add owner iPhone Badge/Trainer-page validation to `docs/open-questions.md`.
- Run `pnpm lint && pnpm test && pnpm build`, live private content import, 390×844 Badge/Trainer smoke, and targeted offline/
  reload/conflict checks. Do not modify workflows, infrastructure, Firebase/environment files, or the API Dockerfile.

## Manual verification

1. Reconcile an established save. Check every collection/stable-total achievement, exact ledger exclusion, records, one
   archive summary, deterministic reload, and cross-device sync.
2. Cross thresholds through acquisition, redemption, card max, race, Training badge, goal/Honors, parented start, and
   promotion. Confirm per-Uma then Trainer fanfare, one atomic commit, and no duplicates on retries.
3. Add/remove current private catalog entries in a local synthetic pack. Confirm unearned “all” progress changes, earned
   stages retain frozen evidence, dynamic buckets stay correct, and orphaned saves do not inflate completion.
4. At 390×844 exercise Trainer scope/profile, long details, all filters/sorts, display name, many pinned Umas, mixed showcase
   groups, accessible reorder, records/source links, recent Stable flair, reduced motion, and missing content.
5. Verify offline action/reconnect, clean-device bootstrap, conflict rebase, startup budget, route chunking, no overflow,
   no console errors, and physical iPhone/Home Screen feel when available.

## Acceptance

- Every documented Trainer achievement is data-driven, pinned, correctly aggregated, retroactive, and incrementally
  maintained with authoritative reconciliation.
- Trainer events and per-Uma events commit exactly once with triggering actions; retries/reloads/sync never duplicate
  progress or fanfare.
- Trainer scope/profile, records, pinned Umas, showcase, saved views, and Stable recent flair are complete and mobile-ready.
- “All”/dynamic content behavior is explicit and monotonic; missing/orphaned/private content never fabricates completion.
- Milestone 6 docs/status are complete, lint/test/build pass, and startup remains ≤180 KB gzip.

## Explicitly out of scope

- Sound, haptics, bespoke badge/icon art, night theme, 120 Hz tuning, or other Milestone 7 polish.
- Duelist/Upset/R4 badge criteria, new gameplay systems, affinity/blue sparks, social profiles, sharing, leaderboards,
  cross-player/global rarity, server-authoritative rules, and any flair currency rewards.

## Implementation status

Definition complete; implementation has not started.
