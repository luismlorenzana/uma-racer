# T157 — The shell: the Hub, Stable, Card Library and Account

> **M036, part 6 of 8.** Web, with small domain words and ids. Starts after T152 has merged. Decision **D386**.

## Why

After T152's clean slate the app signs in to a Hub with only Account. This part rebuilds the places a player meets
first:
- the Hub's two pages, **Town Hall** and **Career**;
- the **Stable**, to unlock Umas with Uma Tickets;
- the **Card Library**, to unlock support cards with Card Tickets and read their real effects;
- **Account**.

All of it sits on the generation-3 save and the shared kit.

## Context

Read first:
- [M036](M036-ura-finale-slice.md), "Unlocks" and "The places". This is the binding summary.
- [v3](../research/drawing-board/README.md) §2 and §4.3 (owning cards).
- The current manual's [11 · Hub and places](../game/11-hub-and-places.md) and the
  [architecture's uma-kit section](../game/architecture.md#uma-kit): how the kit's `HubMap`, `RacerShell`, `PlacePeek`,
  `PlacePageHeader`, the place registry and peeks work. T152 leaves them in place with only Account registered.
- The change protocol ([docs/change-protocol.md](../change-protocol.md)): pass props to the kit, and never fork a kit
  component.
- **From T152:**
  - the domain's `account` operations `unlock-uma` and `unlock-card`;
  - the `account`, `uma` and `card` records;
  - the master adapter's `UmaTemplate` and `SupportCardTemplate` (with real effects);
  - the `G3Game` port.
- **Art:**
  - `uma-kit/album` (`FaceTile`, `UmaBust`, `AlbumGrid`, `UmaPicker`);
  - the card art through the content runtime;
  - `uma-art` 2.10.0's racer buildings and tiles. Don't pin a newer one in this part.

## Do

1. **The Hub's pages** (`packages/domain/src/hub/*` and `apps/web/src/hub/*`):
   - **Town Hall** (today's Town Hall ground): Stable, Card Library and Account. The plaza crowd (SA7) stays, as the
     owned Umas.
   - **Career** (today's Training ground and buildings, relabelled): **Careers**, **Training Yard** and
     **Furlong Hand**. The two game places open their T155 and T156 hosts. Until those merge, they show the kit's
     "not ready" state.
   - The Racing and Farm pages and their places are gone. The bottom bar holds Town Hall, Career, the raised centre
     button (**Career**: her current season) and Menu.
   - Words in `hub/words.ts`. Peeks:
     - the Stable peek: tickets and owned count;
     - the Card Library peek: tickets and owned count;
     - the Careers peek: careers in progress and the next objective.
2. **The Stable** (`apps/web/src/places/stable/`):
   - **Owned** and **Locked** tabs on the kit's album.
   - **Unlock:** a Locked Uma opens a sheet with her bust, aptitudes and growth rates and **Unlock · 1 Uma Ticket**,
     which commits `unlock-uma`. A short reveal follows; today's `places/reveal` may be reused if it still fits.
   - **Her profile:**
     - her bust and template;
     - her **racing builds**, one per completed career (URA Finale for now): the five stats, aptitudes and skills;
     - her current career, with a link to it;
     - **Start career**, which commits T154's `start-career`, or "Coming in T154" until T154 merges.
3. **The Card Library** (`apps/web/src/places/card-library/`):
   - **Owned** and **Locked** tabs, filtered by type and focus (`card-focus.ts`) and sorted by release.
   - **Unlock · 1 Card Ticket** commits `unlock-card`.
   - **A card's page:**
     - its art and type;
     - **its real effects at maximum level**, named in plain words (Training Effectiveness 15%, Speed Bonus +1…) and
       read from the private pack at runtime, **never bundled in git**;
     - its unique effect's description;
     - its hint skills and event skills;
     - its era, shown as the first scenario it can be used in;
     - its **power** (T153's `cardPower`) as a small bar against its type's median, once T153 merges.
4. **Account** (`apps/web/src/places/account/`):
   - sync status, Appearance, App build and Content, and sign-out;
   - no check-in times, and no Playtesting rows for retired systems;
   - the dev section keeps `dev-grant` (tickets) when `DEV_OPERATIONS` is on.
5. **The top bar** (`RacerShell`'s `AccountBar` props): Uma Tickets and Card Tickets as the two currencies, drawn with
   `UiMark` or `uma-art` marks. There are no coins and no Speed Tickets.
6. **The manual:**
   - write `docs/game/02-unlocks.md` (tickets, the Stable, the Card Library, eras);
   - rewrite `docs/game/11-hub-and-places.md`'s menu tree for every route, sheet and place this part ships. T158 adds
     the career screens.
7. **D386:** the Hub's two pages, the bottom bar, the top-bar currencies and the unlock flow.

## Done when

- [ ] Web tests cover the Hub's pages and places, unlocking an Uma and a card (the ticket spent and the record
      written), the profile's racing builds (with a synthetic completed career), the card page's effects (synthetic
      card) and Account.
- [ ] Light and dark both use the theme tokens. Every target is ≥ 44 pt. The layout works at 390×844 (component tests
      at that size).
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass, within the 180 KB budget.
- [ ] No real card value is in git. The card page reads them from content at runtime.
- [ ] The manual pages and D386 are written.

## Deliver

- Branch `feat/t157-the-shell` from `restart/g3`. Open a PR into `restart/g3` titled
  `feat(web): the Hub, Stable, Card Library and Account (T157)`.
- Delete this file in the PR. Claude merges.
