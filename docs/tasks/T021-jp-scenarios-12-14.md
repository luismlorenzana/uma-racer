# T021 — JP scenarios 12–14 (Milestone 7, part 3)

**Outcome:** the scenario ladder matches JP again. Three scenarios join the table, the Uma level cap moves from 110 to
140, and the 43 support cards released since October 2025 stop pretending to belong to era 11.

## Why this is needed

D55 committed to including every JP scenario. `SCENARIOS` stops at #11 (Design Your Island, 2025-06-27) while JP has
released three more. Everything downstream — level cap, gates, card eras, scenario badges — is derived from that list, so
the whole ladder is short by 30 levels and three card eras.

## Fixed choices

The dates below were verified against the public GameTora scenario dataset on 2026-09-19; the six rows previously marked
⚠️ in [Scenarios](../design/scenarios.md) were confirmed at the same time.

| # | Name | JP name | JP release | Uma levels | Baseline stat cap |
|---|---|---|---|---|---|
| 12 | Yukoma Hot Springs | ごくらく♪ゆこま温泉郷 | 2025-10-29 | 111–120 | 2080 |
| 13 | Beyond Dreams | Beyond Dreams 共に前へ、共に光を | 2026-02-24 | 121–130 | 2160 |
| 14 | Tracen Diner | らっしゃい！トレセン軒！ | 2026-06-29 | 131–140 | 2240 |

- **Ladder A continues at +80** (D76). The original game raised its own hard cap to 2500 with Beyond Dreams; we note that
  and keep our ladder, because caps here are balance values tied to the soft cap at 1200 (D108).
- Scenario **modifiers stay out of this task**. They are [Milestone 8](M008-scenario-identity.md).
- No new content fields, no new badges, no economy change.

## Implementation contract

### Ladder and derived rules

- Add the three rows to `SCENARIOS` in `packages/domain/src/scenarios.ts`. `MAX_UMA_LEVEL`, gate levels, `tierOfLevel`,
  `baselineStatCap`, `baselineSpCap`, and era assignment all derive from the list and must need no other edit.
- Card and Uma **era** is still "the latest scenario released on or before the JP release date". Verify the boundaries:
  2025-10-28 → era 11, 2025-10-29 → era 12, 2026-02-24 → era 13, 2026-06-29 → era 14.
- SP cap continues as `300 + 200 × (T − 1)`; tier 14 is 2900 at TL10.

### Saves already at the old maximum

- Level 110 becomes an ordinary gate. An Uma who was frozen as "latest scenario complete" must become promotion-ready
  again, keeping her existing tier-11 completion snapshot, Graduate flair, and parent snapshot exactly as they are.
- Promotion out of tier 11 must not re-award anything the Uma already holds; flair event ids are deterministic and
  monotonic, so a second evaluation is a no-op rather than a duplicate.
- The dynamic per-scenario definitions (Graduate, Capped, Perfect Form, Speedrun, Fully Trained, Era Loyalist) must
  generate for tiers 12–14 from the catalog's existing scenario-driven definitions. `Living Legend` keeps whatever it
  already awarded (D98: never revoked) and now requires the longer list for a new award.

### Decks that fall out of their era

Cards whose era moves from 11 to 12–14 stop being equippable for an Uma below that tier. That is the intended era rule,
not a bug, but it must be handled kindly:

- The deck editor marks such a card "Era locked" with its new era, keeps it visible, and offers to remove it.
- Training and Race Select refuse with the existing structured deck error naming the card, never with a crash or a silent
  drop, and the Auto fill action produces a valid deck.
- A saved deck is never rewritten automatically; the owner decides.

### Guard against falling behind again

The data pipeline gains a check: read the public `scenarios` dataset from the GameTora manifest, count the entries whose
JP start date is on or before today, and warn when that count exceeds `SCENARIOS.length`. The warning prints counts and
dates only — no names, ids, or other source rows are stored, packed, or committed.

## Deliverables

1. The three scenario rows and the verified dates, with the ⚠️ marks removed from the design doc.
2. Save/promotion handling for Umas sitting at level 110.
3. Deck era-lock presentation and error paths.
4. The importer's scenario-count warning.
5. Docs: [scenarios.md](../design/scenarios.md), [support-cards.md](../design/support-cards.md) if era text changes, the
   [data backlog](../research/data-backlog.md), and a decision row if anything here is adjusted.

## Tests

- Era boundaries at 2025-10-28/29, 2026-02-23/24, and 2026-06-28/29.
- Cap ladder: tier 12 = 2080, 13 = 2160, 14 = 2240; TL1 is 80% of each.
- Gate levels 110, 120, 130 promote; 140 is final; EXP at 140 stops banking as it does today at 110.
- A saved Uma at level 110 with a tier-11 completion snapshot becomes promotion-ready without losing or re-earning flair.
- A deck holding a card that moved to era 12 reports a structured, named error and survives a reload.
- The importer warns when the source has more released scenarios than the ladder models.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass.
- After a local `pnpm data:import`: era 11 holds only cards released between 2025-06-27 and 2025-10-28, and eras 12–14
  hold the rest (about 14 / 15 / 14 cards).
- No original-game data enters git; this spec is deleted in the same PR (D104).

## Out of scope

Scenario modifiers, cap-ladder changes, the 2500 hard cap, new scenario art, and any goal or title behavior.
