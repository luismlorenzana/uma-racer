# T035 — Race Select on the album engine (Milestone 10, part 3)

**Outcome:** choosing among 321 races stops being a scroll. The third long list in the game gets the same browsing
chrome as the Stable and the Cards album.

**Prerequisite:** T033 has merged. Reuse its engine, chrome and preferences; extend the engine generically if a race
facet needs a new facet *kind*.

Read [Racing — Race catalog](../design/racing.md#race-catalog), [Scenario Goals — Presentation](../design/scenario-goals.md#presentation)
and [Collection — Shared browsing chrome](../design/collection.md#shared-browsing-chrome).

## Fixed choices

- **The Race tab's career tracker and Next up list stay on top** (M017, D137). This task turns the collapsed **All
  races** section below them into the album; pinned goal targets are Next up's job.
- **Goal targets keep their privileges.** Active goal races stay pinned above normal ordering with their ribbons, and
  Goals-only remains a one-tap preset. Filtering never hides a pinned goal target; it is shown with a note instead.
- No change to race rules, rewards, fields, eligibility or the pre-race flow.
- Race Select is per-Uma, so every facet that depends on the selected Uma recomputes when she changes.

## Implementation contract

- **Default order:** goal targets first, then the grade the Uma's tier is working toward, then aptitude fit, then
  distance. A player opening Race Select should see something sensible for *this* Uma without touching a control.
- **Sorts:** aptitude fit · grade · distance · venue · surface · win EXP · field size · recently raced (from her own
  history).
- **Facets:** grade · surface · distance category · exact distance range · venue · direction · field size · series tag
  (Triple Crown and the rest, from the private override) · goal target · never raced here · won here before ·
  aptitude fit at B or better for this Uma.
- **Tiles carry decision data:** grade crest, name, venue, surface, distance, field size, win EXP, and **her aptitude
  fit for this race** — the reason you would pick it. The secondary line follows the active sort, as elsewhere.
- Series-tagged races show their series chip, so hunting the Triple Tiara legs is a filter rather than a memory test.
- Grouping by grade or by venue inserts sticky headers with counts.
- Presets: *Goals only* · *G1* · *Best aptitude* · *Never raced here*.
- Preferences persist per device alongside the album ones, and the list restores scroll position when you come back
  from a race.

## Tests

- Default order on a synthetic catalogue: goal targets first, then the tier's grade band, then aptitude fit.
- Each facet, including the Uma-dependent ones, recomputes when the selected Uma changes.
- A filter that would hide an active goal target keeps it visible with its note.
- Aptitude fit matches the saved pre-race aptitude rules, not the improved current grades where those differ.
- Preset queries are exactly as documented, and scroll position survives a round trip to a race.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; startup stays within budget.
- In the browser at 390×844: the full race list scrolls smoothly, switching Uma updates fit and facets, and a Triple
  Tiara leg is reachable in two taps from the series filter.
- The PR includes screenshots of the default view, a filtered view, and grouping by venue.
- This spec is deleted in the same PR (D104).

## Out of scope

Race rules, rewards, opponents, the pre-race screen, the Pixi race scene, and any change to goal selection or pinning
semantics.
