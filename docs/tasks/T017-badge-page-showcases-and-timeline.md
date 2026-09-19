# T017 — Badge page, showcases, and flair timeline (Milestone 6, part 3)

**Goal:** build the big mobile-first Badge destination and complete per-Uma flair presentation. The player can explore one
Uma or the whole Stable, search/filter/sort every visible definition, inspect exact progress/provenance, manage active
titles and unlimited grouped showcases, browse G1 trophies and the append-only timeline, and see the first 12 pins on the
Uma Profile. T017 changes presentation/preferences only; award truth remains T016.

Depends on: `T016-per-uma-badges-titles-and-awards.md`.

Read first: `AGENTS.md`, `docs/design/badges.md`, `docs/design/collection.md`, `docs/design/ux.md` §§Navigation/Uma
Profile/Badges, `docs/technical/architecture.md`, `docs/decisions.md`, T002, T003, T008, T011, and T015–T016.

## Scope and fixed choices

- Add a lazy `/badges` bottom-tab route. T017 enables **Uma** and **Stable** scopes. The **Trainer** scope is visible but
  disabled with a concise “Trainer achievements arrive next” state until T018; no placeholder achievements are invented.
- Uma scope always identifies one owned Uma in the URL/query state so refresh/deep link is stable. Missing/unowned ids fall
  back to the featured owned Uma, then deterministic first owned Uma, with an explicit empty state when none exist.
- Stable scope is a pure aggregation of all valid owned per-Uma badge entities and the current catalog. It does not persist
  a duplicate Stable award collection. Orphaned entities are reported but excluded from known-content completion/rarity.
- Showcase/title/view edits are local-first badge-entity writes with optimistic UI only after commit. They emit no flair
  events and never alter award timestamps/progress/Prestige. Same desired state is a write-free no-op.
- Pins are unlimited in persistence, but each award reference appears at most once across groups. The Profile displays the
  first 12 flattened references. A pin references the award identity, not its current tier, so a later tier upgrade updates
  display without rewriting showcase order.
- Tapping/dragging is not the only reorder path. Every group/pin has ≥44 pt Move up/down controls; pointer drag is a
  progressive enhancement using existing browser APIs. Add no drag/virtualization dependency.
- Use a small in-repo fixed-row/grid windowing helper or `content-visibility` with measured proof that the full catalog does
  not create a long-task. Keep startup ≤180 KB gzip; all Badge-page/detail/timeline code stays behind the lazy route.
- Generated semantic glyphs, CSS tier shapes, private Uma art, and existing icons only. No original-game badge art, sound,
  haptics, or new dependency.

## Deliverables

### 1. Pure catalog/view projections

- Build pure projections that join catalog v1, one/all Uma badge states, flair logs, private races/Umas, and current save
  into serializable view models. React components do not calculate criteria or mutate domain state.
- **Uma projection:** definitions with earned/current/next stage, progress/history label, hidden/locked status, tags,
  Prestige, active title, pin/group membership, trophies, and most recent source event.
- **Stable projection:** one tile per non-hidden definition with holder count, owned-Uma denominator, rarity percentage,
  highest holder tier, newest event, and ordered holder drill-down. Dynamic Goal Ribbon/trophy definitions group by their
  stable award key; missing private labels use safe ids.
- Stable completion counts only visible fixed/dynamic definitions currently applicable to at least one known owned Uma.
  Hidden unearned definitions and deferred definitions are absent from both numerator and denominator.
- Search normalizes case/whitespace and matches visible badge/title/trophy labels, criteria, scenario labels, and private
  race/venue names. It never exposes text for an unearned hidden badge.
- Implement typed filter intersection for category, tier/type, surface, distance, strategy, aptitude context, venue, grade,
  scenario, status, pinned, and earned date; Stable adds Uma and rarity. Unknown filter URL/view values are rejected, not
  silently broadened.
- Sorts are deterministic with award key as final tie break: most recent, tier, closest next tier, rarest (Stable),
  alphabetical, and category. “Closest” excludes completed/one-off/untracked entries and sorts by descending progress.

### 2. Badge destination and navigation

- Replace the current Badge-tab placeholder with the lazy screen, scope segmented control, search field, filter button,
  removable active chips, sort control, completion summary, and windowed grid.
- The Uma picker is a bottom sheet using owned private-catalog Umas, portrait, active title, level, Prestige frame, and badge
  count. Selection updates the URL without altering the featured Uma.
- Tiles show semantic glyph, tier shape+color+text, visible name, progress/complete/untracked state, and pin toggle in pin
  mode. Locked entries are silhouettes. Hidden unearned entries do not occupy a tile.
- Empty states distinguish no owned Uma, no awards yet, no matching filters, missing badge state, and recoverable/newer
  schema errors. The page never reseeds or overwrites state to recover.
- Back/deep link preserves scope, Uma, search/filter/sort, and detail selection in URL or typed route state where practical.
  Bottom-tab re-entry restores the last committed scope/view without making saved views implicit.
- Trainer scope explains T018 and remains noninteractive beyond returning to Uma/Stable.

### 3. Detail, trophy wall, and timeline

- Tapping a tile opens a bottom sheet with label, glyph/tier, criterion, complete threshold ladder, current progress,
  exact/since-tracking/untracked explanation, earned dates, Prestige contribution, tags, and source links.
- Source links open exact stored race Results/replay, Profile Journey goal detail, or a scenario/training explanation. Missing
  source/content remains a readable safe id and disabled link, never a crash or substituted record.
- Add an Uma-scope G1 trophy wall: one tile per distinct won family with count, first/last dates, and race/result links.
  Stable trophy aggregation is available through filters/detail, not a second giant wall.
- Add the full Uma flair timeline, reverse chronological by `(earnedAt, id)`, filterable by event kind. Retroactive events
  are labeled; migration-only events explain that exact original date is unavailable.
- Timeline pagination/windowing reads bounded pages from Dexie instead of loading unrelated Umas' entire logs. Offline and
  memory-only modes behave consistently.
- Direct detail/timeline links resolve from persisted ids and current content; they do not require a previous in-memory
  navigation.

### 4. Active title and showcase editing

- Title selection is available from an earned title detail and a dedicated picker. The chosen id must be earned by this
  Uma; clear is allowed. Re-read the badge entity on confirmation and reject stale/unearned selection.
- Pin mode supports single toggle and multi-select. Select all applies only to the currently visible filtered result and
  clearly reports the count. Changing a filter preserves visible selected items and drops now-hidden selections only after
  an explicit confirmation when a bulk action would otherwise surprise the user.
- Implement the unnamed default group plus at most 20 named groups. Names trim to 1–40 characters and must be unique under
  case-insensitive normalized comparison. Rename, reorder, and delete are explicit; deleting a nonempty group asks whether
  to move its pins to default or unpin them.
- A pin may occur once across all groups. Pinning defaults to the currently selected destination group or default. Bulk move
  preserves relative catalog/current showcase order and deduplicates.
- Pointer drag reorders within/across groups with transform-only feedback and auto-scroll bounded to the page. Accessible
  Move up/down/group actions perform the exact same pure reorder operation. Reduced motion removes lift/spring.
- Validate the complete desired preference state through the strict T015 parser, write one badge entity plus coalesced
  outbox row in one transaction, and publish after commit. Identical retry returns success without a version bump.

### 5. Saved views and Profile integration

- Stable-scope saved views live in a preference-only `trainer` badge entity initialized with the T015 empty schema; this
  does not create Trainer awards. Uma-scope views live on that Uma. Each scope supports at most 20 unique 1–40-character
  names with strict filter/sort enums.
- Save captures scope-compatible filters and sort, not transient search text, selected tiles, open sheets, or scroll
  position. Load applies atomically to the draft UI; rename/delete persists only on confirmation.
- A saved view referencing removed content/filter values opens with an explicit “Some filters are unavailable” warning and
  keeps the valid subset; persistence is not silently rewritten.
- Replace Uma Profile's compact recent section with a real Badges tab/showcase preview: active title, Prestige/frame,
  collection counts, first 12 flattened pins, recent timeline, and “View all Badges.” Empty showcase suggests opening pin
  mode; it does not auto-pin.
- Apply the derived Prestige frame consistently to Home hero, Stable owned tile, Profile hero, Uma picker, and relevant
  reveal surfaces through one pure style projection. Shape/label remains visible without color.

### 6. Persistence, sync, and conflict behavior

- Add focused persistence commands for active title, full showcase, and saved-view replacement. Each re-reads current state,
  validates ownership/earned refs/catalog keys, increments only the badge entity version, and coalesces outbox work.
- An in-flight sync conflict adopts newer server award facts but reapplies a still-valid local preference mutation on top,
  analogous to existing outbox rebase. Never let a stale preference overwrite newly earned awards/facts.
- If a referenced award becomes unavailable because current content is missing, retain its safe pin/title ref and render a
  missing-content tile. If the award itself was never earned/corrupt, reject the preference state.
- Cloud bootstrap/adoption includes trainer preference state without requiring T018 achievements. New-device order and
  saved views match the source device after sync.
- Memory-only edits remain possible with a clear non-persistent warning and the same validation/projection.

### 7. Tests and documentation

- Pure tests cover every projection/filter/sort/search/status/rarity path, hidden privacy, tie ordering, URL parsing,
  missing content, trophy/timeline/source links, active title, pin flattening, groups, bulk/reorder, and saved-view rules.
- Persistence/API tests cover atomic/no-op/stale edits, validation, outbox coalescing/rebase, award-fact preservation, cloud
  adoption, trainer preference shell, memory-only mode, and corrupted/newer state handling.
- Component-free screen helpers remain testable without adding a DOM/component-test dependency. Manually exercise pointer,
  keyboard/accessibility controls, reduced motion, and iPhone geometry.
- Update badges/collection/UX/architecture docs and README status accurately. Append decisions only for changes made during
  implementation; do not modify established thresholds casually.
- Do not modify workflows, infrastructure, Firebase/environment files, or the API Dockerfile.

## Manual verification

1. At 390×844, switch Uma/Stable scopes, choose multiple Umas, search, combine filters, change every sort, open/close long
   details, and scroll the full catalog/timeline. Confirm no overflow, jank, leaked hidden text, or console errors.
2. Earn/use examples with exact, since-tracking, untracked, hidden, dynamic, and missing-content states. Confirm counts,
   rarity, progress, source links, and safe fallbacks.
3. Create/rename/reorder/delete groups; pin many items via single/multi-select; drag and use accessible buttons; change/
   clear title; save/load/rename/delete views. Reload, offline boot, sync to a clean device, and force a conflict.
4. Confirm Profile/Home/Stable frames and Profile's first 12 flattened pins match the Badge page. Upgrade a pinned badge and
   confirm its tier changes in place without altering order.
5. Measure startup and Badge-route chunks plus long-list interaction on the iPhone/Home Screen app when available.

## Acceptance

- The Badge tab is a complete, lazy, mobile-first Uma/Stable collection browser with truthful progress/provenance.
- Title, showcase, grouping, multi-select, reorder, and saved-view preferences are strict, atomic, syncable, accessible,
  offline-safe, and cannot overwrite award truth.
- Trophy wall, detail, and timeline reconstruct from persisted facts/events with safe private-content fallbacks.
- Profile/Home/Stable use one Prestige/frame/title/showcase projection and remain within performance/accessibility budgets.
- Trainer scope is honestly deferred to T018; lint/test/build pass and startup remains ≤180 KB gzip.

## Explicitly out of scope

- Trainer achievement evaluation, records, Trainer profile/scope/showcase, and pinned Umas (T018).
- New badge criteria/catalog tuning, Duelist/Upset/R4, currency rewards, sound/haptics, bespoke art, and social/global data.

## Implementation status

Implemented on 2026-09-18. The shipped slice includes the lazy Uma/Stable route, pure privacy-safe projections, typed URL
state, full detail/trophy/timeline views, active titles, unlimited pins and bounded groups/saved views, accessible and
pointer reorder paths, atomic local-first writes, preference-aware sync conflict rebase, trainer preference bootstrap,
Profile/Home/Stable/reveal frame integration, and synthetic tests. Trainer awards remain deferred to T018 as specified.
