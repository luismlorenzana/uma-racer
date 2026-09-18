# T016 — Per-Uma badges, titles, trophies, and award flow (Milestone 6, part 2)

**Goal:** turn T015's durable facts into the complete catalog-v1 set of per-Uma badge tiers, one-offs, Goal Ribbons,
Honors, titles, and G1 trophies. Awards are retroactive, monotonic, idempotent, and atomically attached to the gameplay
action that earned them. Results, Training, Home, and Uma Profile expose the first meaningful flair feedback without yet
building the full Badge page.

Depends on: `T015-accomplishment-facts-and-badge-state.md`.

Read first: `AGENTS.md`, `docs/design/badges.md`, `docs/design/collection.md`, `docs/design/racing.md`,
`docs/design/training.md`, `docs/design/scenario-goals.md`, `docs/design/ux.md` §§Home/Uma Profile/Training/Results,
`docs/technical/architecture.md`, `docs/decisions.md`, T008, T012–T015.

## Scope and fixed choices

- `BADGE_CATALOG_VERSION = 1` implements every earnable definition in `badges.md` Catalog v1. `Duelist` and `Upset` do
  not appear as placeholder tiles or awards. Definitions are pure checked-in game rules with semantic/dynamic ids only;
  original race/venue/Uma/card ids and names remain private joins.
- Evaluation reads T015 facts and shared catalog definitions. It does not scan React state, trust display projections, or
  independently re-simulate a race during an ordinary action. T015's fact transition happens first in the same pure
  transaction result, then T016 evaluates the new aggregate state.
- Awards are monotonic. A content/catalog update may change future progress, but cannot revoke an earned tier/title/trophy.
  New catalog versions require an explicit evaluator migration; v1 state is never silently reinterpreted.
- A multi-tier crossing persists every newly reached tier/event for audit, while immediate UI presents only the highest
  new tier for that definition. A Goal Ribbon, Honors, one-off, title, and first trophy each present separately.
- Flair pays no currency and changes no race/training/progression result. Prestige is derived from current awards and the
  pinned point table, never persisted as an independently mutable balance.
- The first title an Uma earns becomes active only when `activeTitleId` is null. Later titles never auto-replace the
  preference. T017 adds explicit selection/clear controls.
- T016 provides compact recent-award/Profile surfaces and action fanfare, not the full searchable page, trophy wall,
  showcase editor, saved views, Stable scope, Trainer scope, or Trainer achievements.
- Reuse generated CSS tier shapes/glyphs and current visual primitives. No new badge art, sound, haptics, dependency, or
  startup route weight; keep the entry chunk ≤180 KB gzip.

## Deliverables

### 1. Data-driven catalog and pure progress projection

- Define catalog types for tiered badge, one-off badge, dynamic badge, title, and trophy families. Every definition has:
  safe semantic id/prefix, label/description template, criterion kind/parameters, exact threshold ladder or one-off rule,
  visibility, Prestige points, tags/classification, history requirement, and source-link kind.
- Implement the fixed and reusable threshold constants from `badges.md`; include the exact tier order, Prestige values,
  one-off overrides, title points, and frame thresholds in the existing domain pinning test.
- Generate bounded dynamic definitions from private/runtime facts:
  - Venue Regular per known venue key;
  - per-scenario Capped, Perfect Form, Graduate, Speedrun, Fully Trained, and Honors;
  - Goal Ribbon per persisted tracked goal;
  - repeat-G1 titles and trophies per won family;
  - race-set titles from validated semantic series tags.
- A dynamic id uses safe ids/hashes and is stable under private-content reordering. Missing content yields the stored safe
  identity plus a missing-content label; it never aliases to another definition by current display name.
- Add pure progress projection returning value, next threshold, percentage, highest earned tier, visibility/status, and
  history grade. `since-tracking` progress renders “at least N”; `untracked` renders no fabricated percentage.
- Hidden definitions return no label/criterion/search text until earned. The evaluator still checks them; the projection
  reveals the full definition after its first award.

### 2. Pure award evaluator and current award state

- Implement a shared pure evaluator:
  `evaluateUmaFlair(catalog, previousBadgeState, triggeringSource) → { state, events }`.
- Evaluate every catalog-v1 criterion from bounded facts. The result contains only genuinely new stages/titles/first
  trophies; repeated evaluation of the same state returns no events and byte-equivalent award state.
- Store per definition the highest stage plus first-earned evidence for every reached stage. Store earned titles with their
  source, and G1 trophies with family id, count, first/last win source. Counts update without emitting another trophy event
  after the first; two-/three-time titles emit independently.
- Course Record compares the current result with earlier player results on the exact stored course id. The first valid
  finish establishes the record; later times must be strictly smaller. A race may award Course Record even on a loss,
  matching “set the in-game record time,” while all other race feats retain their explicit win requirement.
- Perfect Journey requires at least three completed tracked Journeys and Honors in every one. Any completed
  `legacy-untracked` tier makes its historical condition unknown, so it cannot award until three fully tracked completed
  tiers exist and every completed tier from that tracked suffix has Honors. Record this suffix interpretation in the
  criterion text.
- Living Legend freezes the scenario count/catalog version in its earned record. Grand Tour freezes the required venue-key
  set. An already earned award is not revoked when later content expands either set.
- Validate evaluator output through the same strict badge-state parser before persistence. A definition bug aborts the
  triggering action rather than writing malformed partial flair.

### 3. Append-only flair events

- Complete T015's `FlairEvent` payload parser. An event includes: version, scope (`uma` for T016), Uma id, kind
  (`badge-tier`, `one-off`, `goal-ribbon`, `honors`, `title`, `trophy-earned`), award key, stage/tier, earned timestamp,
  source (`race`, `training`, `scenario`, `goal`, or `migration`) with safe source id/tier when applicable, and
  `retroactive`.
- Deterministic event ids are derived from scope+Uma+award key+stage, remain ≤120 characters (hash long dynamic portions),
  and are independent of display labels. Same id+payload is an idempotent success; same id+different payload is corruption.
- Append `flairEvents` through the existing log/outbox/sync pipeline. API/Firestore shape validation is strict; the server
  remains a shape validator and does not reevaluate game rules.
- Source time is the exact triggering race/result/Journey/snapshot time when available. Training uses commit time.
  Bootstrap-only current-state awards without a historical time use migration time and `retroactive: true`.
- Timeline ordering is `(earnedAt, event id)`. Event history is never rewritten when active title, pins, names, current
  content, or catalog progress changes.

### 4. Retroactive catalog bootstrap

- During content-ready coordination, find T015 badge states whose evaluator/catalog watermark is below v1. Strictly parse
  each state and all source records required for source links before evaluating.
- Award all thresholds already proven by exact or lower-bound facts. Never award from an `untracked` criterion. Preserve
  the recorded history grade on each earned stage so detail can explain its provenance later.
- Locate the earliest known threshold-crossing source by ordered race/Journey/history evidence where possible. If bounded
  aggregates prove an award but no historical crossing source survives, use the migration source/time and mark retroactive.
- Write every affected badge entity, flair log, and coalesced outbox row for all Umas in one Dexie transaction. Publish
  after commit; retry is event-idempotent. Memory-only mode produces the same in-memory awards and one warning.
- Do not play dozens of individual animations at boot. After a successful persistent bootstrap, show one dismissible
  “Flair archive updated · N awards” summary; details are available from Profile and later T017. Reload does not show it
  again because the evaluator watermark is committed.
- A catalog/content failure leaves the previous valid state usable and reports a recoverable migration error. It never
  erases T015 facts or partially advances the evaluator watermark.

### 5. Atomic incremental awards

- Extend T015's pure fact transition for race, Training, Scenario Start, promotion, and final completion to immediately run
  the evaluator with the committed source timestamp/id.
- In each existing Dexie transaction, write every affected badge entity and append new flair logs alongside current
  profile/Uma/card/result/ledger/Journey/outbox writes. Multi-Uma Legacy/Dynasty awards participate in the same transaction.
- New race results add an optional-rollout `earnedFlairEventIds` array. Once T016 is active, every new row includes it,
  including empty. IDs are unique and exactly match events created by that race transaction.
- Race retry returns stored ids and never reevaluates/animates. Same-attempt mismatches include facts and flair ids in the
  corruption comparison. Old rows without ids remain valid and render no “fresh earn” animation.
- Training and promotion return exact newly earned event ids in their in-memory committed result; persistence remains the
  source of truth on reload. A failed award/log write rolls back every gameplay effect.
- Cloud adoption/sync conflict handling must preserve a newer local badge payload and rebase its outbox version just like
  other entities. Append-log acknowledgement removes only matching flair outbox work.

### 6. Action feedback and compact flair surfaces

- **Results:** after placement/rewards and T014 Goal Ribbons, serialize new badge/title/trophy fanfare in catalog order:
  goal-derived persisted flair, ordinary badge tiers/one-offs, trophy, then title. Each card shows tier shape/color/label,
  criterion summary, and Prestige change. Multiple tiers of one definition collapse to its highest newly reached tier.
- Skip/reduced motion reveals the same list immediately. A direct/reloaded result shows an “Earned in this race” summary
  from stored event ids but does not replay shine/confetti as new.
- **Training:** after ordinary gains/hints/card feedback, show a compact earned-flair stack. It never delays the next deal;
  reduced motion is instant.
- **Scenario Start/promotion/final completion:** present earned scenario/lineage flair after the committed scenario title or
  completion summary. Do not let fanfare block a successful commit or make Back repeat it.
- **Home:** add the featured Uma's latest three non-hidden flair events below the goal tracker, with safe content fallbacks
  and a route placeholder/link ready for T017.
- **Uma Profile:** show derived Prestige/frame, active title (first-title default), total badge/title/trophy counts, and a
  compact recent-awards section. Keep the existing Journey intact. Do not pretend the 12-pin showcase exists before T017.
- All projections are pure/tested, use private joins only for labels/art, and handle missing Uma/race/content safely.
  Motion uses `m.*`, transform/opacity only, safe areas, and ≥44 pt controls.

### 7. Tests and documentation

- Fixtures are small and invented; no real source data/ids/names/art enters git. Tests make no network request.
- Domain tests cover every fixed/dynamic catalog definition, thresholds/boundaries, aptitude context, streaks, breadth,
  private series sets, repeat G1s, race feats, records/ties, stats/caps, Speedrun, Training, goals/Honors, skills/lineage,
  hidden projection, history grades, frozen set semantics, Prestige, and id/order determinism.
- Persistence/API tests cover bootstrap, multi-tier crossings, deterministic event ids, race/training/promotion atomicity,
  multi-Uma Legacy/Dynasty, retries, rollback, cloud adoption/conflicts, old/new result shapes, outbox acknowledgement,
  memory-only behavior, and catalog migration interruption.
- Pure web tests cover fanfare ordering/collapse, fresh versus reload summaries, reduced motion, Home/Profile recent flair,
  missing content, active-title default, and no duplicate presentation.
- Update badges/racing/training/scenarios/goals/UX/architecture docs and append decisions. README may say the Milestone 6
  award engine is implemented, but must not claim the Badge page or Trainer achievements are complete.
- Do not modify workflows, infrastructure, Firebase/environment files, or the API Dockerfile.

## Manual verification

1. Load a pre-T016 save with varied races, goals, stats, and skills. Confirm one archive summary, accurate exact/lower-bound
   awards, no untracked inventions, stable active-title default, sync, and no repeat summary after reload.
2. Run races that cross multiple tiers, complete a goal/Honors, set/lose/tie a course record, earn a G1 trophy/title, and
   trigger hidden feats. Confirm stored event ids, ordering, skip/reload behavior, and no duplicate fanfare on retry/replay.
3. Train to thresholds/TL10/Full House, start with parents, promote, and complete a descendant scenario. Confirm all affected
   Umas receive facts/awards atomically and failures roll back gameplay too.
4. At 390×844 inspect Results, Training, Home, and Profile in normal/reduced motion with missing private content and long
   labels. Confirm safe areas, no overflow, ≥44 pt actions, entry bundle budget, and no console errors.

## Acceptance

- Catalog v1 is entirely data-driven, pinned, privacy-safe, and evaluates every non-deferred design definition.
- Existing provable accomplishments award once retroactively; incomplete history stays honestly labeled and never guessed.
- Every future award is atomic with its triggering action, has one deterministic append-only event, and survives retry,
  reload, offline play, sync, and content-name changes.
- Results/Training/scenario actions present exact new awards; Home/Profile provide useful compact flair and Prestige.
- No rewards or simulation outcomes change; startup remains ≤180 KB gzip; lint/test/build pass.

## Explicitly out of scope

- Full Badge page, showcase pins/groups, saved views, title picker, trophy wall, and full timeline (T017).
- Stable aggregation, Trainer achievements/profile/showcase, and pinned Umas (T018).
- Duelist/Upset/R4 mechanics, sound, haptics, bespoke art, social/global features, and currency rewards.

## Implementation status

Definition complete; implementation has not started.
