# T081 — Bond achievements

> **Needs a revised counting contract before implementation (D255).** Stars are now global: a bonded card is one
> owned card at 3★, not one card×scenario pair. Type/style/distance counts still apply; Bonds Forged, scenario families
> and their thresholds below are historical proposals, not an instruction to multiply global progress across eras.
> Re-author those families separately after T104; this task does not block global-star delivery.

**Goal:** a family of trainer achievements that rewards bonding many cards to max across categories — stat type,
running style, distance, their combinations and scenarios — so training "many speed cards for different aptitudes" has
visible goals without asking for every card in every scenario (D202).

Depends on merged T078 (3★ max) and T080 (card focus). Read [M024](M024-card-training-loop.md), D202,
[Collection — trainer achievements](../design/collection.md#trainer-achievements-account-wide), [Badges](../design/badges.md)
and `packages/domain/src/trainer-achievements.ts`. Branch from current `main`; open a PR; never push to `main`.

## Units

- A **bond** is one card at 3★ in one scenario.
- A **bonded card** is a card with a bond in at least one scenario. Category families count bonded cards, so bonding
  one card in five scenarios does not fill a category; scenario families count that scenario's bonds.

## Catalog (fixed, D202)

Tiers are the trainer ladder: Bronze · Silver · Gold · Platinum · Rainbow. "All" is every card of the category in the
current catalog; a tier whose count is at or above the category's size is dropped, so a small category ends on "all".

| Family | One per | Counts | B / S / G / P / R |
|---|---|---|---|
| **Bonds Forged** | — | bonds, all scenarios | 5 / 25 / 75 / 200 / 500 |
| **[Type] Bonds** | stat type (Speed … Wit, Friend, Group) | bonded cards of that type | 1 / 3 / 6 / 12 / all |
| **[Style] Bonds** | Front, Pace, Late, End, Generalist | bonded cards with that style focus | 1 / 3 / 6 / 12 / all |
| **[Distance] Bonds** | Sprint, Mile, Medium, Long, Generalist | bonded cards with that distance focus | 1 / 3 / 6 / 12 / all |
| **[Type] · [Style]** | each of the five stat types × four styles with a card | bonded cards in both | 1 / 3 / all |
| **[Type] · [Distance]** | each of the five stat types × four distances with a card | bonded cards in both | 1 / 3 / all |
| **[Scenario] Bonds** | scenario 1–14 | cards at 3★ in that scenario | 1 / 6 (a full set) / 12 / 24 / all eligible |
| **Every Stride** | — | a bonded card of each of the four styles | one-off |
| **Every Distance** | — | a bonded card of each of the four distances | one-off |
| **Full Spectrum** | scenario 1–14 | cards of all five stat types at 3★ in that scenario | one-off |

About 85 families on today's pack: 1 total, 7 types, 5 styles, 5 distances, 20 type × style and 18 type × distance
combinations (only where a card exists), 14 scenarios, 2 one-offs and 14 Full Spectrums. Labels read like the rest of the
Badges page: "Speed Bonds", "Late Surger Bonds", "Medium Bonds", "Speed · Pace Chaser", "Stamina · Long",
"URA Finale Bonds". Thresholds live in `TRAINER_ACHIEVEMENT_THRESHOLDS`, mirrored in the doc table and pinned in tests.

## Implementation contract

- Extend the trainer catalog to **v2** with a new category `bonds`: dynamic definitions per type, focus, combination and
  scenario, built from the content catalog like Era Complete and Type Complete (`frozenKeys`, `allThresholdKey`), with
  focus from `cardFocus` (T080). Existing v1 awards (Maxed Out, Card Collector …) keep their keys and earned stages.
- Facts are **reconciled deterministically from card saves and content** at content-ready boot and after each commit
  that changes stars, as trainer facts already are: fully retroactive, no new save fields, no ledger rows.
- A content update that changes a card's focus or adds cards moves denominators, never takes an earned stage away.
- Every earned tier writes one Trainer flair event; the bootstrap's retroactive collapse into one archive summary still
  applies, so the first boot after the update shows one summary, not dozens of fanfares.
- Pure flair: nothing pays tickets, coupons or shards.

## Presentation

- **Badges page, Trainer scope:** a **Bonds** section grouped Totals · Types · Styles · Distances · Specialists ·
  Scenarios, each achievement with its progress (`7 / 12`) and next tier.
- **Card page:** a line naming the Bond families this card advances ("Counts toward Speed Bonds, Pace Chaser Bonds,
  Speed · Pace Chaser, Medium Bonds"), so the player can see why a card is worth bonding.
- A Friendship Training clear that earns a Bond tier shows it on the result, after the star.

## Docs and decision

Add a **Bonds** table to [Collection — trainer achievements](../design/collection.md#trainer-achievements-account-wide)
and the category to [Badges](../design/badges.md). D202 carries the catalog.

## Tests

- Synthetic catalog: bonding a card advances exactly its type, style, distance, the two combinations it belongs to and
  that scenario; bonding it in a second scenario advances only Bonds Forged and the second scenario.
- Tier clamping: a category of two cards has Bronze at 1 and its final tier at 2 ("all").
- Retroactive reconcile of a save equals the incremental path, byte for byte; v1 trainer state upgrades to v2 keeping
  every earned stage; one archive summary on the first reconcile.
- Every Stride, Every Distance and Full Spectrum fire once, on the exact bond that completes them.

## Acceptance

- In the browser at 390 × 844 the Bonds section lists the families with correct progress for a seeded save, and a clear
  that crosses a tier shows it on the result and in the flair timeline.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; the main bundle stays under 180 KB gzip.
- This spec is deleted in the same PR, and M024 with it when it is the last task (D104).

## Out of scope

Stars (T078), scenario access and partners (T079), focus derivation (T080), per-Uma badges, rewards of any kind.
