# T009 — Support-card album and progression (Milestone 4, part 1)

**Goal:** turn the Cards tab into the authoritative SSR album and complete the card progression loop. The player can browse
the full private catalog, inspect owned and unowned cards, understand generated effects and limit-break unlocks, spend
Training Tickets to promote a capped card, and earn a Card Select Coupon exactly once when a card reaches LB4 level 25.

Depends on: `T004-saved-uma-training-loop.md`, `T005-progression-races-and-rewards.md`, and the completed Milestone 3 tasks.

Read first: `AGENTS.md`, `docs/design/support-cards.md`, `docs/design/training.md` §Card EXP,
`docs/design/collection.md`, `docs/design/economy.md`, `docs/design/ux.md` §Cards,
`docs/technical/architecture.md` §1 and save model, `docs/decisions.md`, and T004.

## Scope and fixed choices

- Save schema v1 already has the required mutable fields: account-wide card rows contain level, EXP, limit break, and the
  one-time max-coupon flag; the profile contains tickets and Card Select Coupons. Do not add duplicated static card fields
  or bump the schema. Ownership is the presence of a card entity keyed by its private content id.
- Card promotion is available only at a filled LB cap: level `5 × (LB + 1)`, EXP equal to that level's full EXP bar,
  current LB below 4, and enough tickets. Promotion spends `20 × toLB`, advances both to the next LB and the first level in
  its band (5→6, 10→11, 15→16, 20→21), resets EXP to zero, and grants the normal +2 level-up tickets. The net profile
  change is therefore `-cost + 2`, represented by separate append-only ledger rows.
- A card reaching level 25 through Training grants exactly one Card Select Coupon in that same Training transaction and
  sets `maxCouponGranted`. Retry, reload, sync conflict, or future Training at max cannot grant it again. T011 owns spending
  the coupon; T009 only displays the balance and earned state.
- LB unlock rules become executable, not merely labels: Race Bonus contributes only at LB1+, Specialty Priority receives
  its documented boost at LB2+, gold hints are available at LB3+, and Initial Stats remains a displayed future-promotion
  effect until scenario promotion exists. LB4 raw unique tuples are never copied as values or evaluated as conditions.
- For the MVP typed LB4 signature, map only raw unique tuple types that correspond to the existing eight generated card
  effects. Each distinct mapped effect adds 25% of that card's normal generated level-25 value at LB4; unmapped tuples are
  safely inactive and shown as unsupported. The source tuple supplies identity only, never its original numeric value.
  Update the support-card design doc, the domain pinning test, and `docs/decisions.md` for this generated coefficient.
- Friend and Group cards appear in the album and may be owned, but remain clearly labeled unavailable for Training/decks.
  Do not silently treat them as stat cards or invent behavior for them.
- The album contains every content SSR. It groups deterministically by era then type, with stable id as the final tie break.
  Owned cards show art, level, EXP, and LB pips. Unowned cards use a silhouette treatment; private names/art may still be
  joined at runtime because the app is authenticated, but no original-game datum enters source or fixtures.
- Keep the initial JavaScript chunk at or below 180 KB gzip. The Cards route remains lazy and adds no dependency.

## Deliverables

### 1. Pure card progression and effect projection

- Add a pure, strictly validated card-promotion function. It returns the next card, ticket delta, reached level, exact cost,
  and deterministic ledger descriptors without reading storage or content globals.
- Add a single generated-effect projection used by Training, racing, and the Cards UI. It reports current values, LB gates,
  next-LB values, and the typed LB4 signature addition without exposing or copying raw source values.
- Make existing Training and Race Bonus calculations use that projection so the album cannot disagree with gameplay.
  Preserve all current non-card race behavior and replay inputs.
- Extend ledger parsing with the minimum explicit reason needed for the one-time max-card coupon. Reuse the existing
  `card-level` reason for the promotion-created level and `card-limit-break` for ticket spending.
- Extend Training resolution with `cardCouponReward` and newly maxed card ids. The reward is derived from transitions plus
  `maxCouponGranted`, never trusted from the UI.

### 2. Atomic local-first mutations

- Add `promoteCard(cardId, localDay, now)` through the lazy action/runtime layer. Re-read and parse profile/card/content at
  commit time; reject unowned/missing content, incomplete EXP, max LB, insufficient tickets, or concurrent promotion with
  zero partial writes.
- In one Dexie transaction update profile and card, append `card-limit-break:<cardId>:<toLB>` and
  `card-level-tickets:<cardId>:<newLevel>`, coalesce profile/card outbox rows, and queue both append logs. A matching retry is
  idempotent; a same-id mismatch is corruption.
- When Training reaches level 25, its existing transaction also increments `profile.cardCoupons`, sets the card flag,
  appends `card-max-coupon:<cardId>`, and queues profile/card/log sync work. Training publication includes the coupon update
  only after commit. Memory-only mode applies the same pure rules with an honest persistence warning.
- Add a per-card runtime lock. Gameplay remains local-first and never waits for the API; refresh and schedule the existing
  outbox after commit.

### 3. Cards album and detail

- Replace the `/cards` placeholder with a route-split Cards screen. Handle signed-out, content loading/empty/error, save
  loading/error, memory-only, orphaned references, and an empty imported card catalog explicitly.
- Show completion totals plus owned/maxed counts, era sections, type filters, owned/unowned filter, and deterministic cards.
  Use the existing managed `AtlasSprite`; no GameTora/raw URL may reach markup or CSS.
- Card tiles have at least 44 pt targets and show type, era/scenario label, ownership, LB pips, level, and EXP state. Locked
  era means “not equippable yet,” not “not ownable.” Friend/Group availability is unambiguous.
- Tapping opens a safe-area-aware detail sheet with identity, ownership, generated current effects, unlock labels,
  next-LB diffs, hint counts, EXP, cost, coupon-earned state, and a promotion button. Errors retain the sheet and are
  retryable; success uses reduced-motion-compatible lift/glow/pip feedback and immediately updates every joined view.
- The top bar continues to show tickets/coupons from the same profile state. Do not add a second card cache or network-owned
  query state.

### 4. Tests and documentation

- Fixtures are small, invented, and synthetic. No original card id/name/effect row/image/pack excerpt enters git, and no
  test makes a network request.
- Domain tests cover every promotion precondition, exact four costs and level transitions, the +2 reward, effect/LB gates,
  typed LB4 signature mapping/dedup/unmapped handling, card max detection, and exactly-once coupon descriptors.
- Persistence/runtime tests cover atomic promotion, exact ledger/outbox ids, insufficient tickets and invalid/corrupt card
  state with zero writes, retry idempotency, concurrency protection, memory-only behavior, Training max-coupon award, and
  publication only after commit.
- Pure web tests cover album grouping/filtering/counts, current/next effect formatting, locked-era labels, and missing
  references. Do not add a component-testing dependency.
- Update `README.md`, `docs/design/support-cards.md`, `docs/design/ux.md`, `docs/technical/architecture.md`, and append a
  decision row. Do not modify infrastructure, workflows, environment files, Firebase config, or the API Dockerfile.

## Manual verification

With complete private local content and `pnpm dev`:

1. Open Cards at 390×844. Check all era/type groups, filters, completion counts, owned art, unowned silhouettes, ≥44 pt
   targets, safe areas, no horizontal overflow, and no console errors. Check a Friend/Group card is honestly unavailable.
2. Open owned cards at ordinary, filled-cap, and max states. Confirm current/next effects match Training/Race previews and
   the promotion button explains EXP, ticket, max-LB, and missing-content locks.
3. Promote through a synthetic/local capped card. Confirm exact ticket spend plus +2 reward, level/LB transition, animation,
   card/profile agreement after reload, exact ledger rows, and pending sync diagnostics.
4. Reach LB4 level 25 through Training. Confirm one Card Select Coupon, the max border/flag, and no duplicate after another
   Training, reload, retry, or sync flush.
5. Stop the API, promote a card and max another locally, reload, then restart the API. Confirm queued work drains without
   duplicate tickets, levels, coupons, or ledger rows.

## Acceptance

- The Cards tab is a complete private SSR album with truthful ownership, era/type grouping, progress, effects, and states.
- A valid capped card promotes locally and atomically using the documented cost/transition/reward rules; invalid, failed,
  concurrent, replayed, and retried actions cannot partially write or pay twice.
- Card effects shown in the UI are the same generated values used by Training and racing, including executable LB1–LB4
  gates, while original numeric effects remain private and inactive.
- Maxing a card grants exactly one persisted/synced Card Select Coupon. Spending it remains T011.
- `pnpm lint && pnpm test && pnpm build` pass, the PWA builds, and startup stays at or below 180 KB gzip.

## Explicitly out of scope

- Manual per-Uma deck editing and removing the temporary auto-fill bridge (T010).
- Card Select Coupon redemption, acquiring unowned cards, Uma albums/coupons, or reveals (T011).
- Friend/Group gameplay, card bond/events, original numeric card effects, scenario promotion/Initial Stats application,
  presets, badges/achievements, sound, haptics, or new visual assets.
