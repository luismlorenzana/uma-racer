# 02 · Unlocks

> **Status: generation 3, built (T152, T157, D381, D386).** The tickets and the two unlock operations are T152's; the
> Stable and the Card Library that spend them are T157's. Where each screen sits is
> [11 · Hub and places](11-hub-and-places.md) §3.1.

You **unlock** Umas and SSR support cards with tickets, one ticket each, for good. Nothing else is bought: there are
no coins, no shops and no gacha.

Code: `packages/domain/src/account/` (the operations), `packages/domain/src/hub/cards.ts` (a card's effect words), and
`apps/web/src/places/stable/` and `apps/web/src/places/card-library/` (the screens).

## 1. Tickets

<!-- live:unlock-tickets -->
| Ticket | A new account | Unlocks | Earned by |
|---|---|---|---|
| Uma Ticket | 20 | One Uma (the Stable) | Completing the URA Finals: +1 |
| Card Ticket | 24 | One SSR support card (the Card Library) | An objective's first win: +1; completing the URA Finals: +2 |
<!-- /live -->

- **`unlock-uma { umaId }`** and **`unlock-card { cardId }`** spend one ticket and write the Uma's or the card's
  record (`umas/{id}`, `cards/{id}`, each with the time it was unlocked). Each refuses in plain words, and changes
  nothing, for an id the content lacks, one already unlocked, or no ticket left.
- **Unlocking is final.** Nothing is ever locked again, and there is no refund.
- **Both tickets sit in the top bar** ([11](11-hub-and-places.md) §2.1). Each chip opens the Locked tab of the place
  that spends it.
- **`dev-grant { umaTickets, cardTickets }`** adds tickets in a dev build only, from Account's dev section; production
  refuses it.

## 2. The Stable: Umas

**The album** (`/town/stable`):
- **Two tabs, Owned and Locked,** each with its count. The Stable opens on Owned once you own any Uma, and on Locked
  before that, so a new account starts where its 20 tickets go.
- **uma-kit's album:** a search, a sort (newest release first, name, or latest unlock) and filters (her A-or-better
  surfaces, distances and running styles), kept on this phone, over a grid of her faces, five a row.
- An owned face carries a race mark while her career runs and a trophy once one is complete. A locked face is dimmed
  behind the kit's lock.

**Unlocking an Uma** takes two taps from the album:
1. Her locked face opens **one sheet**: her bust and outfit, the Uma Tickets going N → N−1, "Unlocking is final.", her
   **aptitudes** (surface, distance and running style, an icon and a grade each) and her **growth rates** (each stat's
   icon and its +%).
2. **Unlock · 1 Uma Ticket** commits `unlock-uma`. A short reveal follows in the same sheet: her bust grows in under
   "{name} joins your Stable", with **Her profile** preselected beside Done.

With no ticket left the button holds, and the sheet says a completed career earns one.

**Her profile** (`/town/stable/outfit/:umaId`, uma-kit's profile frame):
- her bust, name and outfit;
- **her career:** the one in progress, where she stands ("URA Finale · Classic Spring") and her next objective, with
  **Open her career**; or **Start career · URA Finale**, which commits `start-career` (T = 1) and opens the new career;
  or, once her URA Finale career is complete, a line saying more scenarios come later
  ([03](03-careers.md) §1: one career at a time, one URA Finale career each);
- **her racing builds,** one per completed career, frozen when she won the URA Finals: the five stats, her aptitudes and
  her skills ([05](05-the-build.md) §7);
- **her template:** her own aptitudes and growth rates.

A locked Uma's profile shows **Unlock · 1 Uma Ticket** in place of her career, which opens the same sheet.

## 3. The Card Library: support cards

Every SSR in the content is in the Library, owned or locked. Cards are account-wide: every Uma's deck draws on the
same ones ([06](06-cards-and-bonds.md) §1).

**The album** (`/town/card-library`):
- **Owned and Locked tabs,** opening as the Stable's do.
- **A search, the seven card types and the eight focus marks** (four running styles, four distances: the card's focus
  from its skills, `card-focus.ts`, D201), each a 44 pt icon that toggles. Every filter rides in the URL, so Back from a
  card returns to the same view.
- The cards, **newest release first,** four a row: the card's icon with its type, dimmed behind a lock while locked.

**A card's page** (`/town/card-library/card/:cardId`):
- its art, type, name and title;
- **its era,** shown as the first scenario it can be used in ("First usable in Unity Cup"), and whether URA Finale
  careers take it (§4);
- its running-style and distance focus, when it has one;
- **Unlock · 1 Card Ticket** while it's locked, with the Card Tickets going N → N−1: one tap commits `unlock-card`,
  the art pops, and the page says "In your Library";
- **its power:** a bar of the card's power against its type's (the bar's full width is the type's strongest card, its
  mark the type's median), with both numbers. Power is the stat gain the card adds to a reference session
  ([06](06-cards-and-bonds.md) §5, `cardPower`); Friend and Group cards compare only with their own type;
- **its effects at level 50,** its top level ([06](06-cards-and-bonds.md) §1), each named in plain words and read as the
  original reads it, a percentage or a flat amount ("Training Effectiveness 15%", "Speed Bonus +1"), in effect-id
  order; an effect at 0 is left out;
- **its unique effect's description,** or, where the content has none, its always-on terms named the same way;
- **its hint skills and event skills** by name, golds starred.

**The values are the original's,** read at runtime from the private content pack behind the authenticated API. None is
in git: the names below are the code's, and the tests use invented cards with invented values.

<!-- live:card-effect-words -->
| Id | Effect | Reads as |
|---|---|---|
| 1 | Friendship Bonus | *n*% |
| 2 | Mood Effect | *n*% |
| 3 | Speed Bonus | +*n* |
| 4 | Stamina Bonus | +*n* |
| 5 | Power Bonus | +*n* |
| 6 | Guts Bonus | +*n* |
| 7 | Wit Bonus | +*n* |
| 8 | Training Effectiveness | *n*% |
| 9 | Initial Speed | +*n* |
| 10 | Initial Stamina | +*n* |
| 11 | Initial Power | +*n* |
| 12 | Initial Guts | +*n* |
| 13 | Initial Wit | +*n* |
| 14 | Initial Friendship Gauge | +*n* |
| 15 | Race Bonus | *n*% |
| 16 | Fan Bonus | *n*% |
| 17 | Hint Levels | +*n* |
| 18 | Hint Frequency | *n*% |
| 19 | Specialty Priority | +*n* |
| 20 | Max Speed | +*n* |
| 21 | Max Stamina | +*n* |
| 22 | Max Power | +*n* |
| 23 | Max Guts | +*n* |
| 24 | Max Wit | +*n* |
| 25 | Event Recovery | *n*% |
| 26 | Event Effectiveness | *n*% |
| 27 | Failure Protection | *n*% |
| 28 | Energy Cost Reduction | *n*% |
| 29 | Minigame Effectiveness | *n*% |
| 30 | Skill Point Bonus | +*n* |
| 31 | Wit Friendship Recovery | +*n* |
| 32 | Initial Skill Points | +*n* |
| 41 | All Stats Bonus | +*n* |
<!-- /live -->

An id the table doesn't know reads "Effect *id*". What each effect does in the game is [06](06-cards-and-bonds.md) §2.

## 4. Eras

- **A card's era** is the latest scenario released on or before its JP release (`eraOf`,
  [04](04-tiers-and-scenarios.md) §3). Its page names that scenario as the first it can be used in.
- **A career takes only cards of its scenario's era or older.** This release runs URA Finale careers (T = 1), so only
  era-1 cards go in a deck; the Library still holds, shows and unlocks every card, ready for later scenarios.
- Unlocking never depends on the era.
