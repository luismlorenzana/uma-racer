# T161 — Cards by scenario: the Library unlocks only what a career can use

> **M037, part 2.** Domain, web and docs. Branch from `main`. Decision **D392**. Independent of T160.

## Why

The owner: "Cards should be locked on a per scenario basis, can't equip cards that were not released only after the
current scenario ended."

The deck already refuses a card from a later era (`build/deck.ts`, `card-era`), and the Deck tab lists only the era's
cards. The Card Library, though, unlocks any card ([02](../game/02-unlocks.md) §4: "Unlocking never depends on the
era"). On 2026-11-05 the owner's account held 13 cards, 6 of them from eras 2–5. That's 6 Card Tickets spent on cards
no URA Finale career can use until much later releases.

## Context

Read first:
- [02](../game/02-unlocks.md): tickets, the Card Library and eras.
- [04](../game/04-tiers-and-scenarios.md) §3: card eras.
- `account/ops.ts`: `unlock-card`.
- `scenarios.ts`: `eraOf` and `SCENARIOS`.
- `career/start.ts`: `OPEN_SCENARIOS`, which is `[1]` today.
- `build/deck.ts`: the deck's era gate.
- The web: `apps/web/src/places/card-library/` (the Peek, the Locked tab, `CardPage.tsx`'s era words).

## Do

1. **The rule:** a card can be unlocked once its era's scenario is open in the game (`card.era` ∈ `OPEN_SCENARIOS`).
   - Opening a later scenario in a release (Unity Cup in release 2) opens its era's cards with it.
   - This replaces 02 §4's "Unlocking never depends on the era". Promotion (release 4) doesn't change the rule: a
     scenario is open for the account, not per Uma.
2. **`unlock-card`** refuses a card from an era that isn't open:
   - code `card-era`;
   - the words "`<title>` arrives with `<scenario>`, which isn't open yet.";
   - it writes nothing.
3. **Return the cards already unlocked:**
   - a new operation, **`return-later-cards {}`**, re-locks every unlocked card whose era isn't open and gives back one
     Card Ticket for each;
   - its receipt is `{ returned: string[], ticketsLeft }`;
   - it's idempotent: with nothing to return, it's a no-op receipt;
   - it can't touch a card in a deck, which can't happen today since the deck refuses later eras, but guard it;
   - the Card Library shows it as a one-time banner while such cards exist: "6 cards from later scenarios: return them
     for 6 Card Tickets", with one Return button;
   - this is the only way a card is ever re-locked: 02 §1's "unlocking is final" gains this one exception.
4. **The Card Library:**
   - **Locked tab:** later-era cards stay visible, filterable and sorted, with an "Opens with `<scenario>`" chip and no
     Unlock button. Only open-era cards are unlockable. The ticket chip's Locked tab opens on the open-era cards first.
   - **A card's page:** a later-era card says "Opens with `<scenario>`" in place of Unlock.
   - **The Peek:** counts only the unlockable cards.
5. **Docs:**
   - rewrite [02](../game/02-unlocks.md) §1, §3 and §4, [04](../game/04-tiers-and-scenarios.md) §3, and the Card
     Library in [11](../game/11-hub-and-places.md);
   - add the new operation to the save's operation list in [the architecture](../game/architecture.md);
   - update the career guide's unlocks section;
   - add **D392**.

## Done when

- [ ] Domain tests:
  - [ ] `unlock-card` refuses a later era and accepts an open one;
  - [ ] `return-later-cards` returns exactly the later-era unlocked cards with one ticket each;
  - [ ] it's a no-op the second time;
  - [ ] it never touches open-era cards;
  - [ ] the API replays both alike (the operation runs in the shared registry).
- [ ] Web tests at 390×844, in light and dark:
  - [ ] the Locked tab's "Opens with" chip, with no Unlock button for a later card;
  - [ ] the Return banner, which disappears once used.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass.

## Deliver

- Branch `feat/t161-cards-by-scenario` from `main`, with a PR into `main` titled
  `feat: cards unlock by scenario, later ones returned (T161)`.
- CI must pass before the merge.
- Delete this file in the PR.
- It deploys on merge. After verifying the deploy, tell the owner that the Card Library offers the Return banner for
  their 6 later-era cards.
