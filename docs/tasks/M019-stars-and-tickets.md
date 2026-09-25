# Milestone 19 — Stars and tickets

**Outcome:** a card's power in a scenario reads as **0★ to 5★**, and one training ticket buys **one minigame run**.
Both change what saved numbers mean, so they ship together as **save v7**, with one migration and one release.

Decisions: D147 (stars), D148 (tickets). Owner: Claude. Lands before [M020](M020-friendship-training.md), whose run
lengths and ticket price assume both.

| Task | Scope |
|---|---|
| T061 | Stars: limit breaks become 0★–5★ per card per scenario |
| T062 | Tickets: one ticket per run, a 10-ticket day, a 5-day bank, every price divided by 5 |

## T061 — Stars

### Fixed choices (D147)

- A card holds **0★ to 5★ in each scenario** (per scenario and shared by every Uma there, as D127). Every card starts
  at 0★ in every scenario. **5★ is max**: full node value and every bonus at full strength.
- **One clear of the card minigame is one star.** Bond Recall is the bridge until Friendship Training replaces it
  (M020).
- **What a card node pays**, as a share of node value: `60 · 68 · 76 · 84 · 92 · 100` for 0★–5★ (+8 points a star).
  The ceiling is unchanged, so every balance gate that assumes a max card (`sim:constellation`, `sim:careers`)
  still holds.
- **Race Bonus** is 0 at 0★ and `full × stars / 5` from 1★, full at 5★.
- **The unique effect's bonus** applies at 5★, as it does at max limit break today.
- **Card Select Coupon** at a card's first 5★ anywhere, once per card ever (`maxCouponGranted` is unchanged).
- On screen a card's power in a scenario is its **stars** (`★★★☆☆`, "3★"), replacing bond pips and "Bond 3". **Bond**
  stays the verb: the button that launches the card minigame, and the minigame's purpose. Save fields keep their
  names (`limitBreaks`), as D130 did.

### Migration (save v6 → v7)

`stars = ceil(1.25 × limitBreak)`: LB0 → 0★, LB1 → 2★, LB2 → 3★, LB3 → 4★, LB4 → 5★.

No card loses node value (LB1 70% → 2★ 76%, LB2 80% → 84%, LB3 90% → 92%), every maxed card stays maxed, and no coupon
is granted or withdrawn by the migration. It runs once, on load, inside the save transaction, and is idempotent by
schema version.

### Implementation contract

- **Domain:** `MAX_LIMIT_BREAK` 4 → 5 (exported as the star cap); `LB_NODE_PCT` → the table above; replace the old
  card-level projection that still feeds Race Bonus and the unique bonus (`cardLevelCap`, `LEVELS_PER_LIMIT_BREAK`,
  `EFFECT_UNLOCK_LB` and the rest of the dead effect model in `cards.ts`) with a star table for the two effects that
  survive; save v7 types, parser and migration; trainer achievements and album sorts that count max breaks count 5★.
- **API (D128):** the save validator accepts v7 card entities (`limitBreaks` values 0–5) **and still accepts v6**, in the
  same change; `save.test.ts` covers a v6 → v7 round trip.
- **Web:** a `Stars` component replaces `BondPips` everywhere (album tiles, card page, card set, node sheet, Bond Recall);
  "Bond N" copy becomes "N★"; the card page's per-node ladder runs 0★–5★.
- **Bond Recall bridge:** five boards, one per star being earned:

  | Earning | Pairs | Grid | Mismatches allowed |
  |---|---|---|---|
  | 1★ | 6 | 3 × 4 | 10 |
  | 2★ | 8 | 4 × 4 | 12 |
  | 3★ | 9 | 3 × 6 | 13 |
  | 4★ | 10 | 4 × 5 | 14 |
  | 5★ | 12 | 4 × 6 | 16 |

- **Sims:** the harness and both balance gates read stars; the constellation gate is re-run and must be unchanged at 5★.
- **Docs:** support-cards.md (the bond table and "Bond, not levels"), constellations.md (what a card node pays),
  collection.md, minigames.md, economy.md (coupon at 5★), ux.md.

## T062 — Tickets

### Fixed choices (D148)

**One ticket is one run.** The day is sized so the owner can max one card in one scenario per day and still train:

| | Before | After |
|---|---|---|
| Card minigame run (Bond Recall, then Friendship Training) | 10 | **1** |
| Spark Match run | 5 | **1** |
| Daily grant | 50 | **10** |
| Storage cap (stops the daily grant only) | 500 | **50**, five days |
| Uma Level-up | +5 | **+1** |
| Card advance (a star) | +5 | **none**: a run is already one ticket |
| Unlocking a card | 25 + 5 × era (30–95) | **5 + era** (6–19) |
| Unlocking the next scenario | 25 × fromTier (25–325) | **5 × fromTier** (5–65) |

Everything except the card run and the card-advance refund is the old price divided by 5, so what a day buys in
scenario unlocks and card unlocks is unchanged. The card run gets cheaper relative to the rest because a Friendship
Training run takes 6–12 minutes where a Bond Recall run took two.

### Pacing

- **Maxing one card in one scenario** is 5 clears, 0★ → 5★. All-or-nothing (D146) means a lost run costs its ticket,
  so budget **about 6 tickets and 45 minutes** (runs grow from about 5 minutes for 1★ to 12 for 5★).
- **One Uma through a scenario's Training Levels** is about 10 Spark Match runs: 10 tickets.
- **A day's 10 tickets** max one card with 4 Spark Match runs to spare, or take one Uma through a scenario.
- **Banking:** five days (50) accrue while away; tickets from Uma Level-ups are always added, even above the cap.

### Migration (in save v7)

- `tickets = ceil(tickets / 5)`, recorded as one ledger entry with the new reason `ticket-redenomination`. A balance
  above 50 is kept; the cap only stops the daily grant.
- Past ledger entries stay as written, in old units: the ledger is append-only.
- `lastDailyGrant` is unchanged, so no day is granted twice or lost.

### Implementation contract

- **Domain:** `economy.ts` constants and `cardUnlockCost`, `umaPromotionCost`; drop `TICKETS_PER_CARD_LIMIT_BREAK`
  and its grant; `ticket-redenomination` joins `LEDGER_REASONS`.
- **API (D128):** the ledger vocabulary gains the new reason in the same change (the existing test that compares the
  API's vocabulary with the domain's must pass).
- **Web:** every price label reads from the domain; Bond Recall and Spark Match cost 1; the post-run summary drops
  "+5 tickets".
- **Docs:** economy.md rewritten around the table and pacing above.

## Tests

- Migration: every LB value maps as specified; node value never decreases; a maxed card stays maxed; a v7 save
  re-migrates to itself; a v6 card entity still validates in the API.
- Tickets: the redenomination rounds up, is recorded once, and never runs twice; the daily grant stops at 50 but
  never removes tickets; prices match the table.
- Node pay and Race Bonus by star; coupon at the first 5★ only.
- `sim:constellation` and `sim:careers` pass unchanged.

## Acceptance

- The owner's production save loads as v7: every card shows stars equal to `ceil(1.25 × LB)`, the ticket balance is
  a fifth of the old one (rounded up), and nothing previously unlocked or maxed is lost.
- Every screen that showed bond pips shows stars; Bond Recall and Spark Match cost 1 ticket.
- Sync keeps working through the release: the API accepts v6 and v7.

## Out of scope

- Friendship Training (M020).
- A gold skill at a star threshold: support-cards.md mentions one at bond 3, never implemented; stars do not add it.
