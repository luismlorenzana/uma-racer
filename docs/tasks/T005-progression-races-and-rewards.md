# T005 — Progression races and rewards (Milestone 2, part 3)

**Goal:** connect the imported race catalog and deterministic race engine to the player's saved Umas. After completing the
opening Training turn, the player can choose a real content race, owned Uma, and strategy; inspect aptitudes and Race Form;
watch a reproducible race; and atomically persist the result, Uma EXP/levels, Training Ticket rewards, gate shard, history,
and sync work. This closes the first repeatable Train → Race → Improve loop.

Depends on: `T004-saved-uma-training-loop.md`.

Read first: `AGENTS.md`, `docs/design/racing.md`, `docs/design/uma-progression.md`, `docs/design/economy.md`,
`docs/design/ux.md` §§Race Select/Pre-race/Race/Results, `docs/design/scenarios.md`,
`docs/design/support-cards.md`, `docs/technical/architecture.md` §§1–2, `docs/decisions.md`, and T004.

## Scope and fixed choices

- This task implements progression races on the existing R1/R2 deterministic engine. Unique/recovery skills, the baseline
  four-skill NPC kit, skill popups, position keeping, blocking, overtaking, slopes, dueling, and rushed behavior remain in
  the Race Depth milestone. T005 passes no skills to the engine and does not imply that the later kits are active.
- Race history stays in the existing append-only `raceResults` store and cloud collection. Do not add a duplicated
  `raceHistory` array to `UmaSave` or change save schema v1. Screens query and join the log with current private content.
- A race attempt is identified by `race:<umaId>:<zero-based-sequence>`. The sequence is the number of already-recorded
  results for that Uma. Its simulation seed derives from the profile creation time, content version, Uma id, race id,
  strategy, and sequence. The URL carries the sequence; reloading an uncommitted attempt rebuilds the same field and
  timeline, while a committed attempt reads its stored result instead of paying twice.
- Race preparation and result resolution re-read current saved state. A stale attempt whose sequence or starting Uma state
  no longer matches is rejected without writes and returns the player to Race Select to prepare a fresh attempt.
- NPC identities are selected without replacement from every content Uma except the player's character. No two NPCs may
  share a `charaId`, including alternate outfits, and none may share the player's `charaId`. Selection, gates, and ordering
  use the attempt seed. A content race is unavailable when the catalog cannot fill its effective gameplay field size honestly.
- The importer preserves a source race's entry count up to 18. When that count is below the design's eight-runner gameplay
  minimum, T005 pads the generated NPC field to 8; Race Select displays the effective gameplay field size.
- An NPC uses the highest template strategy aptitude, with `front → pace → late → end` as the deterministic tie break.
  Its engine aptitudes are A for the selected strategy and the race's surface/distance, as documented; its stats use the
  existing generic field formula. Player race stats apply current Race Form to saved stats and use saved aptitudes.
- All imported races are visible from tier 1 after the Uma's opening Training. Races cost no Training Tickets. The Race tab
  defaults to the persisted featured Uma, and permits choosing another owned Uma. A race is enabled only when that Uma has
  `trainingsThisScenario >= 1` and is not waiting at a promotion gate.
- Equipped, owned, era-eligible stat cards contribute their generated Race Bonus. Friend/Group cards remain inactive. Raw
  unique-effect tuples remain inactive. An invalid deck/reference is a content/save error and prevents preparation.
- Finishing 1st pays the grade's full EXP with summed Race Bonus, 2nd–3rd pay the documented rounded 25%, and all other
  places pay zero. Every reached Uma level grants +5 Training Tickets, even over 500. Reaching a scenario gate grants one
  Uma Shard exactly once and banks subsequent EXP up to the next level's EXP requirement; promotion is not implemented.
- The result is committed when playback finishes or Skip reaches the finish. Navigating away before the finish abandons the
  derived attempt and writes nothing. Replay is read-only; “Race again” prepares a new sequence and can produce rewards.
- Keep the initial JavaScript chunk at or below 180 KB gzip. Race selection remains route-split and PixiJS remains isolated
  to the full-screen race route. Add no dependency.

## Deliverables

### 1. Progression-race domain rules

Add a focused pure module for content validation, preparation, and rewards.

- Validate every race field consumed by T005: safe ids, nonempty names/venues/course ids, known grade/surface/category,
  positive distance, category consistent with the derived distance band, integer season, and source field size 1–18;
  derive an effective gameplay field size of 8–18. Validate
  relevant Uma/card fields before constructing a field. Reject non-finite stats and effect inputs.
- Export a deterministic attempt id/seed helper and a field builder. Given content, current Uma/card saves, race, strategy,
  and sequence, return the player gate/index, display identities, final `RaceInput`, summed Race Bonus, and immutable
  starting progression snapshot used for stale-attempt validation.
- Apply Race Form exactly once to the player's five saved stats. Build every NPC with `npcRaceStats(tier, grade,
  distanceCategory, umaLevel)`. Use the selected content race's distance and surface in `RaceInput`.
- Export Uma EXP resolution that supports multiple levels, carries remainder, stops at a scenario gate or global maximum,
  banks gate overflow up to one next-level requirement, and reports every reached level plus a newly reached gate.
- Resolve the player's placement from the engine results and calculate EXP via `raceExp`. Race Bonus affects the base win
  amount before the 2nd/3rd share. Return the new Uma, +5 ticket total, shard total, and enough summary for persistence/UI.
- Define and strictly parse a compact `RaceResultRecord`: content version, Uma/race ids, sequence and seed, selected
  strategy, starting level/EXP/stats, deterministic field identities and engine inputs, ordered finish results, placement,
  EXP/reward summary, and creation timestamp. Keep static names and art out of the log.

### 2. Atomic local mutation and sync integration

Add focused race runtime/persistence functions instead of putting simulation or IndexedDB calls in Zustand.

- `prepareRace(umaId, raceId, strategy, sequence?)` resolves current content and save state. Persistent mode counts and
  parses the Uma's recorded results; memory-only mode uses an in-memory append log. It returns an existing record for an
  already-committed matching sequence or a new deterministic prepared attempt for exactly the next sequence.
- `completeRace(prepared, localDay, now)` re-reads and validates the profile, Uma, deck cards, content version, sequence,
  and starting snapshot, then simulates the pure engine again. Never trust placement or rewards supplied by the UI.
- In one Dexie transaction:
  - update the Uma's level/EXP and the profile's tickets/shards;
  - append the typed race result under `race:<umaId>:<sequence>`;
  - append `uma-level-tickets:<umaId>:<level>` with +5 tickets for each newly reached level;
  - append `uma-gate-shard:<umaId>:<gate>` with +1 shard when a gate is newly reached;
  - coalesce profile/Uma outbox entries and queue each new append-only result/ledger id.
- Existing result and ledger ids make retry exactly-once. A same-id result with different data is corruption; a matching
  result is returned without rewriting entities or rewards. Any validation/simulation failure rolls the transaction back.
- Publish profile/Uma updates to Zustand only after commit. Prevent two completions for the same Uma in one runtime.
  Refresh/schedule the existing outbox afterward; gameplay never waits on Cloud Run.
- Add a typed recent-history read used by Race Select. History parse errors become explicit save errors rather than being
  silently dropped. Server snapshot and sync validation strictly parse `raceResults` instead of accepting generic objects.

### 3. Race Select and pre-race setup

Replace the hard-coded demo catalog with the private content registry.

- Signed-out, content-empty/error/loading, save-error/loading, no-owned-Uma, missing-reference, insufficient-field, and
  memory-only states are explicit. Memory-only races remain playable with the existing honest persistence warning.
- Show every content race with grade, venue, surface, distance/category, field size, and win EXP. Sorting is deterministic:
  grade strength, distance, then name/id. No raw GameTora URL or copied content enters source code.
- Default to the featured owned Uma. The pre-race bottom sheet can change owned Uma and strategy; show her icon/name,
  level/tier, race-unlock or promotion-gate status, three relevant aptitude grades, player/field Form percentages, summed
  Race Bonus, and resulting first-place EXP. Disable Start with a useful explanation when preparation is invalid.
- Starting asks the runtime for the next prepared sequence, then navigates to `/race/run` with only safe ids, strategy, and
  sequence. Do not use `Math.random`. Home/Profile Race actions navigate with their featured/selected Uma preselected once
  opening Training is complete; locked actions explain the requirement.
- Show a compact recent-results section joined to current content, including placement, EXP, levels/tickets/shard rewards,
  and timestamp. Missing retired race/Uma content uses ids rather than making history unreadable.

### 4. Full-screen race and results

Adapt the existing lazy Pixi route to a prepared progression attempt.

- While preparing, show an explicit full-screen loading state. Invalid/stale URLs and content/save errors offer a safe
  return to Race Select. Do not silently substitute a demo race, strategy, Uma, sequence, or seed.
- Playback continues to support 1×, 2×, and Skip, safe areas, wake lock, progress rail, phase/remaining-distance display,
  stamina, finishing order, margins, and reduced-motion behavior. Runner labels/icons come from the prepared identities;
  the player's Uma is visibly distinguished. Full character atlas textures may remain a Race Depth presentation follow-up
  if the current Pixi scene cannot accept managed textures without increasing the startup chunk.
- Completion begins once and disables navigation/actions while the atomic mutation resolves. On failure, retain the
  finished timeline and offer Retry; never run a different result. On success, results show placement/time, exact Uma EXP,
  level progress and reached levels, +5 ticket rewards, gate shard/Ready to promote state, and the full ordered field.
- “Races” returns to Race Select with the same Uma. “Race again” requests the next sequence for the same race/strategy;
  replaying the just-finished timeline is read-only and grants nothing.

### 5. Tests and documentation

- All fixtures are small and invented. Never copy a real Uma/card/race/skill name, id, value row, image, or pack excerpt
  into git. No test makes a network request.
- Domain tests cover strict race content/result parsing; stable attempt ids/seeds; identity uniqueness across outfits;
  insufficient fields; best-strategy tie break; player Form/aptitudes; NPC stats; deterministic fields; Race Bonus; exact
  1st/2nd/3rd/other EXP; remainder and multi-level progression; global/gate caps; overflow bank; and reward events.
- Persistence/runtime tests cover atomic success, exact log/ledger/outbox ids, retry idempotency, stale attempts, invalid
  deck/content and locked racing with zero partial writes, reload-stable preparation, memory-only completion, same-Uma
  concurrency protection, history parsing, offline queueing, and publication only after commit.
- Pure web tests cover pre-race/history joins and missing references. Do not add a component-testing dependency.
- Update `README.md`, `docs/technical/architecture.md`, and affected screen inventory/status text. Append a decision row for
  T005's attempt identity, append-only history, and temporary skillless field; never edit an old decision row.
- Do not modify `.github/workflows/`, `infra/`, `firebase.json`, environment files, or `apps/api/Dockerfile`.

## Manual verification

With complete private local content and `pnpm dev`:

1. Train a fresh Uma once. Open Race from Profile/Home, choose a content race and each strategy, and verify the pre-race
   identity, aptitudes, Form, field size, Race Bonus, and EXP preview. Confirm an untrained Uma cannot start.
2. At 390×844, run and skip races. Confirm safe areas, no horizontal overflow, ≥44 pt controls, stable player highlight,
   correct distance/phase/HUD, ordered results, and no console errors. Reload before finish and confirm the same attempt.
3. Finish 1st, 2nd/3rd, and outside the places across deterministic development fixtures. Confirm exact EXP, level
   remainder, +5 tickets per level, profile/Uma agreement, and recent history after reload.
4. Reach level 10. Confirm one shard, Ready to promote, capped/banked EXP, disabled new races at the gate, and no duplicate
   shard/tickets after result reload or sync retry.
5. Stop the API, complete a race, reload, and confirm the result/rewards remain local with pending sync. Restart the API
   and confirm the queue drains without duplicate entities, result rows, or ledger records.
6. Force a stale prepared sequence/state and malformed result log in tests or local development. Confirm no partial writes
   and an explicit recoverable error.

## Acceptance

- An owned Uma with one Training turn can enter every valid imported race, using current saved stats/aptitudes, documented
  Race Form, equipped-card Race Bonus, generic deterministic NPC fields, and the existing seeded race engine.
- Each completed attempt is recorded once and atomically applies documented EXP, multi-level +5 ticket rewards, gate
  overflow, and the one-time shard locally before background sync. Abandoned, stale, failed, replayed, or retried attempts
  cannot duplicate rewards.
- Race Select, pre-race, playback, results, and recent history form a coherent mobile-first loop with honest locked/error/
  offline states and no demo data or `Math.random` path.
- No original-game byte or datum is added to git. `pnpm lint && pnpm test && pnpm build` pass, the PWA builds, and the
  production startup chunk stays at or below 180 KB gzip.

## Explicitly out of scope

- Unique/inherited/recovery skills, baseline NPC skill kit, complex triggers, skill popups, and any engine skill effects.
- Position keeping, lanes/blocking/overtaking logic, dueling, rushed behavior, slopes, upgraded start-gate presentation,
  photo-finish polish, sound, haptics, or new visual assets (Race Depth/Polish milestones).
- Promotion, parent snapshots, scenario reset, inheritance, goals, badges, achievements, titles, and retroactive awards.
- Card Album/detail, deck editing, limit breaks, coupons, Friend/Group behavior, and raw card unique-effect mappings.
