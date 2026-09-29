# T084 — Farm screen and Home entry (Milestone 25, part 3)

**Outcome:** the owner lands directly in a persistent one-to-six-plot Farm, manages outfit workers from its own menus,
grows future stats, and sees both outfit Farming Levels and aggregate Farm Level unlock the field.

**Prerequisite:** T083 has merged. Read [Stable Farm — Screen contract](../design/farm.md#screen-contract),
[Visual system](../design/visual-system.md), [UX](../design/ux.md) and the private-art boundary in
[Collection](../design/collection.md#art-tiers).

## Fixed choices

- Add a lazy Farm shell and Home Farm card. `/farm` always lands on Field with no entry picker; Workers and Crops are Farm
  menus. Do not add a bottom tab or load Farm code into the startup chunk.
- All six positions are a 2 × 3 field at 390 × 844, with five initially locked. Assignment and crop choice are explicit
  plot actions, not a miniature free-place farming canvas.
- Reuse standing chibis through `useArt`/`useArtSet`, `TypeIcon`, Paddock primitives and original code-native crop marks.
  Original-game crop icons and emoji are prohibited.
- Outfit Farming Levels appear only on Farm routes. Home may show account Farm Level, ready/working counts and next unlock.

## Screen contract

- Home card: Farm Lv, `ready / unlocked`, nearest deadline and next plot/crop unlock. Ready state updates when Home regains
  focus without writing a save.
- Header: Back, **Stable Farm**, Farm Lv/next unlock and **How it works**. Internal Field · Workers · Crops · Items
  navigation respects one safe-area owner; Items becomes live in T085.
- Plot panels implement Locked, Unassigned, Idle, Growing and Ready exactly as `farm.md` describes, with text plus visual
  state, accessible progress and 44 pt actions.
- Assign/Change opens the shared Farm outfit picker from the plot. It lists every owned outfit separately, shows Farming
  Lv/progress/current plot, and disables outfits assigned elsewhere. Same-character outfits remain separate.
- Plant opens the crop picker for the saved outfit. It groups by scenario/stat and names aggregate-Farm and outfit-level
  locks separately; confirmation names outfit, crop, stat, destination and local ready time.
- Controls lock through transactions and a stale conflict reloads the field with a plain explanation.
- Growing detail shows exact timestamps and destination. It offers no cancel or edit.
- Harvest animates only after commit: item `+1`, XP progress and every level crossed, with an instant reduced-motion path.
  It then returns the same assigned outfit to Idle and celebrates any Farm unlock; retry after an ambiguous error asks the
  host for the authoritative result.
- **Workers** is the complete outfit roster and reuses the same picker; **Crops** is the catalog with two lock tracks.
- **How it works** uses `PagedGuide` or the shared accessible sheet primitives, but never mutates state or auto-opens before
  the Home screen. It covers assignment, offline growth, harvest XP and scenario/stat produce.

## Responsive and lifecycle contract

- Verify 390 × 844 and 375 × 667. The field may scroll as one account page; sheets own their scroll and primary actions
  remain above `pb-safe`.
- Progress is derived from `plantedAt`/`readyAt`. A single minute-aligned presentation timer updates remaining labels and
  is paused while hidden. Visibility/focus immediately recomputes.
- No per-frame React updates. Motion uses `m.*` under `LazyMotion strict`, transform/opacity only.
- Missing worker art shows the established labelled silhouette. Missing private content never invalidates a saved cycle.
- VoiceOver names plot number, worker, crop, stat, scenario, status and remaining/ready time. Color is never the only cue.

## Tests and verification

- Home view model: one-plot start, each plot/Farm unlock, multiple growing, one/many ready, missing art and a deadline.
- Outfit identity, same-character parallel outfits, persistent assignment, no duplicate outfit, level sort and reassignment.
- Crop filters, both locks, next unlocks and exact confirmation copy from domain constants.
- Timer hook uses one shared interval, cleans up, pauses hidden and never writes persistence.
- Plant/harvest busy, error, stale conflict, restored success and reduced-motion states.
- Browser at 390 × 844 and 375 × 667: one-plot start, progressive/fully open field, picker, growing, ready/harvest,
  Workers and Crops. Attach screenshots; include same-character outfits and one long-name/missing-art case.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; startup gzip remains at or below 180 KB and the lazy Farm chunk is stated.
- Farm is reachable from Home and return navigation is correct online/offline.
- The one-to-six field and persistent crew are usable without the Item screen; harvest quantity remains visible.
- This spec is deleted in the same PR (D104), and M025 marks T084 complete.

## Out of scope

Global inventory browsing (T085), constellation consumption, expansion beyond six/decoration, batch actions, notifications,
sound/music, farm badges and private new art publication.
