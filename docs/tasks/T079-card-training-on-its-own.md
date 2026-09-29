# T079 — Card training on its own

**Goal:** card training no longer depends on Uma training. Every scenario is open in the Cards tab from the start, and a
Friendship Training run's partner cards are chosen for the run instead of borrowed from an Uma's card set (D199).

Depends on merged T078 (the three-star max). Read [M024](M024-card-training-loop.md), D131, D168, D199,
[Collection — the Cards tab](../design/collection.md), [Minigames — Friendship Training](../design/minigames.md#friendship-training--card-stars)
and the [Minigame kit](../design/minigame-kit.md). Branch from current `main`; open a PR; never push to `main`.

## Today

- `CardsScreen.tsx` and `CardPage.tsx` compute `highestTier` from the Umas and show scenario lenses and per-scenario
  rows only up to it (D131: "one per reached scenario").
- `PersistentMinigameHost.friendshipSetup` (`apps/web/src/game/minigame-runs.ts`) builds the deck from the named Uma's
  set in that scenario, else the first set any Uma holds there, then tops up from owned cards by seed. The target carries
  an optional `umaId` for that purpose.

## Scope

### Every scenario, from the start

- **Cards tab:** the Collection lens plus one lens per scenario, 1 to 14, always, in a horizontal scroller that keeps the
  chosen lens in view. The default lens stays the featured Uma's current scenario when there is one, else URA Finale.
  A scenario lens holds the cards its era allows (`era ≤ tier`, unchanged), owned and unowned.
- **A scenario lens says where it stands:** a header line with the eligible cards owned, bonded (any stars) and maxed
  there, e.g. "URA Finale · 18 owned · 7 bonded · 4 at 3★".
- **Card page:** one row per scenario from the card's era to 14, each with its stars there and a **Bond** action (or
  "3★ · Max"). The "later scenarios" split by Uma progress goes away.

### Partners chosen for the run

- The Friendship Training target becomes `{ kind: 'friendship-training', cardId, tier, partnerIds?: string[] }`. New runs
  never write `umaId`; stored rows that carry it still load, resume and commit.
- **Default partners** (when none are given): owned cards eligible in that scenario, other than the main card, ordered by
  stars there (most first), then a stat type the partners do not have yet, then newest era, then id. Deterministic, no
  Uma involved.
- **The start screen shows the five partners** with a **Change partners** control opening the existing card picker
  (`ui/album/CardPickerSheet`), limited to owned cards eligible there. The chosen partners are remembered per scenario
  on the device (like the scenario choice, D190) and revalidated whenever the screen opens.
- **From an Uma's card set**, the Bond action opens the run with that set as its initial partners: a convenience, not a
  dependency.
- Reservation validates partners: owned, eligible there, distinct, not the main card, at most five (`FT_SET_OTHERS`). An
  invalid list refuses with no write. The partners freeze into the run's setup (today's `setCardIds`); fewer than five
  are topped up by seed as today. Replay and commit are unchanged.
- `friendshipSetup` no longer reads `db.umas`.

## Docs and decision

Update [Collection](../design/collection.md) (the Cards tab: every scenario, the lens header), [Minigames](../design/minigames.md#friendship-training--card-stars)
(partners), [UX](../design/ux.md) and the [Minigame kit](../design/minigame-kit.md)'s entry-point line. D199 carries the
rule; note in it that D131's "one per reached scenario" is superseded.

## Tests

- A save whose Umas are all in scenario 1 can open the scenario 9 lens and reserve, play and commit a run there for an
  eligible owned card.
- Default partners are deterministic and follow the ordering above; a partner list that names an unowned, ineligible,
  duplicate or main card, or more than five, refuses with the save untouched.
- Frozen partners survive reload and replay to the same state hash; a stored row with `umaId` still resumes and commits.
- The lens header counts owned, bonded and maxed cards for the scenario exactly.

## Acceptance

- In the browser at 390 × 844 and 375 × 667: the lens scroller reaches all fourteen scenarios; a run starts in a scenario
  no Uma has reached; Change partners picks five cards and the run's deck shows them; a reload resumes with the same
  partners.
- `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm sim:training` pass; the main bundle stays under 180 KB gzip.
- This spec is deleted in the same PR (D104).

## Out of scope

The star scale (T078), card focus (T080), Bond achievements (T081), Friendship Training rules and balance, Uma training.
