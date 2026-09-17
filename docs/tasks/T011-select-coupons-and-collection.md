# T011 — Select Coupons and collection (Milestone 4, part 3)

**Goal:** close Milestone 4 by making the collection expand. The player can spend earned Card Select Coupons on any
unowned SSR, exchange five Uma Shards for an Uma Select Coupon, spend it on any unowned Uma outfit, experience an
idempotent reveal, and inspect complete Card and Uma albums with honest completion counts.

Depends on: `T010-manual-support-decks.md`.

Read first: `AGENTS.md`, `docs/design/collection.md`, `docs/design/economy.md`,
`docs/design/support-cards.md`, `docs/design/uma-progression.md`, `docs/design/ux.md` §§Stable/Cards,
`docs/technical/architecture.md` §1 and save model, `docs/decisions.md`, T003, T005, T009, and T010.

## Scope and fixed choices

- Ownership remains entity presence. Redeeming creates a normal level-1/LB0 card save or level-1 Uma save through the
  existing domain constructors; static names/art/metadata remain in private content. Save schema v1 does not change.
- A Card Select Coupon may acquire any unowned imported SSR, including a later-era or Friend/Group card. Ownership never
  bypasses equip eligibility: later-era cards stay locked by tier and Friend/Group cards remain unavailable for gameplay.
- Five Uma Shards are explicitly exchanged for one Uma Select Coupon. Exchange is a separate atomic action so the player
  can see the two collection items; it may be repeated while at least five shards remain.
- An Uma Select Coupon may acquire any unowned imported Uma outfit, including future releases. The new Uma starts from its
  template at level 1/TL1 with base stats, aptitudes, own unique library, no deck, and no races. It does not become featured
  automatically unless no valid featured Uma exists.
- Redemption uses a review step, then commits locally before the reveal. Closing/reloading the reveal cannot spend again.
  The result route carries only a safe kind/id; it reconstructs the owned entity/content join and is read-only.
- Deterministic append ids make acquisition exactly-once per target: `card-coupon-redeem:<cardId>` and
  `uma-coupon-redeem:<umaId>`. Each exchange uses the next transactionally derived integer sequence and two rows under
  `uma-shard-exchange:<sequence>:{shards,coupon}`. Matching retries return the acquired result; mismatches are corruption.
- Card and Uma completion count outfits/templates, matching saved entity ids. Character-level rollups, trainer achievements,
  badges, titles, and global “all content ever” server statistics remain Milestone 6.
- The existing Cards album from T009 remains the card collection surface. Stable gains an All/Owned album view with
  unowned silhouettes; tapping an unowned tile opens acquisition only when a coupon is available, otherwise explains the
  path. No original data or art is placed in git or the public bundle.
- Keep startup at or below 180 KB gzip. Selection/reveal routes are lazy, Motion-only, and add no dependency.

## Deliverables

### 1. Pure collection rules and ledger contracts

- Add strict pure mutations for shard exchange, card redemption, and Uma redemption. Validate nonnegative balances, safe
  target ids, ownership absence/presence, and content/save constructors; return next profile/entity plus ledger descriptors.
- Extend ledger reasons with explicit `uma-shard-exchange`, `card-coupon-redeem`, and `uma-coupon-redeem` reasons. Shard
  exchange emits -5 Uma Shards and +1 Uma Coupon; redemption emits -1 matching coupon. Never encode two resource movements
  in one ledger row.
- Add pure collection projections for owned/total/maxed card counts, era/type card counts, owned/total Uma counts, filters,
  deterministic ordering, and target eligibility. Missing saved references remain surfaced as orphaned rows and do not
  inflate known-content completion.
- Reuse `createCardSave` and `createUmaSave`; do not create a second initialization formula in the web app.

### 2. Atomic local-first acquisition

- Add lazy runtime actions `exchangeUmaShards`, `redeemCardCoupon(cardId)`, and `redeemUmaCoupon(umaId)`. Use separate locks
  for exchange and each collection kind. All actions re-read/parse profile, existing entities, and current content inside
  their Dexie transaction.
- Exchange updates profile, appends its two ledger rows, queues profile/log outbox work, and publishes after commit.
- Card redemption updates profile, inserts the new version-0 card entity, appends the deterministic ledger row, and queues
  profile/card/log work atomically. Uma redemption does the analogous profile/Uma/log mutation.
- Existing matching entity+ledger state is an idempotent success; target ownership without the matching redemption record
  is “already owned,” not permission to consume another coupon. Any mismatch, insufficient balance, missing content,
  conflict, or storage failure writes nothing.
- Memory-only mode uses the same pure rules and updates Zustand with an explicit warning that acquisition will not persist.
  Persistent actions refresh/schedule the existing outbox and never wait for Cloud Run.
- Sync/server parsers accept only the new explicit ledger reasons and existing strict entity shapes. No new API route is
  needed.

### 3. Coupon selection, albums, and reveals

- Cards displays the Card Coupon balance and a Redeem action. The selection view is the same complete deterministic album,
  filtered to unowned targets, with type/era filters, completion context, later-era ownership explanation, and disabled
  empty/no-coupon/error states. Review shows the exact target and one-coupon cost before commit.
- Stable gains Owned/All filters, owned/total completion, aptitude filters, deterministic sorting, owned progress frames,
  and unowned silhouettes. Owned tiles keep navigating to Profile; unowned tiles open an explanation or Uma Coupon review.
- Surface shard progress (`n / 5`) and an Exchange action. On success, animate the five shards into one coupon with a short
  reduced-motion equivalent. Allow another exchange when enough shards remain.
- Add a full-screen, safe-area-aware reveal for successful card/Uma acquisitions: anticipation, managed private atlas art,
  identity, “New” state, and a CTA to Card detail or Uma Profile. Use Motion `m.*`, transforms/opacity only, and an instant
  reduced-motion path. Refresh/direct navigation after a committed acquisition is read-only and cannot repay.
- All actions disable during commit, retain review state on error, and clearly distinguish owned, no coupon, missing
  content, save error, memory-only, and offline/pending-sync states. Targets and controls remain ≥44 pt at 390×844.

### 4. Tests and documentation

- Use only invented synthetic templates. Tests make no network requests and contain no original-game id/name/value/image.
- Domain tests cover exact shard exchange, insufficient balances, owned/unowned target rules, constructors, all collection
  counts/groups/filters, deterministic ordering, and exact ledger descriptors.
- Persistence/runtime tests cover atomic exchange and both redemption types, entity version zero, exact ledger/outbox ids,
  matching retry idempotency, already-owned and same-id mismatch, insufficient balance/missing content with zero writes,
  concurrency locks, memory-only behavior, offline queueing, and publication only after commit.
- Pure web tests cover card/Uma selection projections, completion counts, future-era/Friend states, orphaned references,
  reveal reconstruction, and direct/reloaded result routes. Do not add a component-testing dependency.
- Update `README.md` to mark Milestone 4 complete; update collection/economy/UX/architecture docs and append a decision row
  for explicit shard exchange plus target-keyed idempotent redemption. Add owner iPhone collection/reveal checks to
  `docs/open-questions.md` if desktop emulation cannot verify them.

## Manual verification

With complete private content and `pnpm dev`:

1. At 390×844, inspect complete Card and Stable albums: counts, filters, owned state, silhouettes, safe areas, ≥44 pt
   targets, private art, no overflow, and no console errors. Verify alternate outfits count separately.
2. Redeem a starter Card Coupon for an ordinary future-era card. Confirm one coupon spent, level-1/LB0 ownership, locked
   equip state, reveal/detail, reload durability, exact ledger/outbox rows, and no second spend from back/refresh.
3. Reach or synthesize five shards, exchange them, then redeem an Uma Coupon. Confirm -5/+1/-1 resource movements, the
   level-1 Uma/profile/deck state, Stable completion, reveal/Profile route, and unchanged featured Uma.
4. Try owned targets, no-coupon states, Friend/Group card acquisition, missing references, rapid double taps, and direct
   reveal reloads. Confirm honest messages and no partial or duplicate movement.
5. Stop the API, perform an exchange and redemption, reload, then reconnect. Confirm the new entity and ledger remain local
   and sync exactly once without losing unrelated decks, levels, races, or balances.

## Acceptance

- Card and Uma albums show the full private catalog with correct owned/total completion and truthful unavailable states.
- Card coupons acquire any unowned SSR; five shards explicitly create an Uma coupon; Uma coupons acquire any unowned Uma
  outfit. New entities use the existing canonical constructors and immediately join every game view.
- Every exchange/redemption is atomic, local-first, offline-capable, strictly parsed, and exactly-once under retry, reload,
  double tap, sync conflict, and direct reveal navigation.
- Reveals are polished, safe-area/reduced-motion compatible, and use only authenticated managed private assets.
- Milestone 4 docs/status are complete; `pnpm lint && pnpm test && pnpm build` pass, the PWA builds, and startup stays
  ≤180 KB gzip.

## Explicitly out of scope

- Trainer achievements, badge collection, titles, showcase pins, aggregate records (Milestone 6).
- Scenario promotion, inheritance, parent snapshots, Initial Stats application, goals, awakening, Friend/Group gameplay,
  card events/bond, deck presets, sound, haptics, or new original-game assets.

## Implementation result

Implemented on `feat/select-coupons-collection`. Pure domain mutations now own exact five-shard exchange, target-keyed Card
and Uma Coupon spends, canonical constructors, strict ids, ledger descriptors, and honest known-content counts. The web
runtime executes them inside atomic Dexie transactions with separate locks, version-0 entity insertion, deterministic
append ids, outbox queueing, idempotent matching retries, corruption detection, and the same rules in memory-only mode.

Cards adds a lazy era/type redemption catalog and exact review; Stable joins the full private Uma outfit catalog with
completion, All/Owned/Unowned and aptitude filters, silhouettes, shard exchange, and Uma review. Both commit before a
safe-area Motion reveal whose safe kind/id route only reconstructs already-owned local state, so refresh cannot repay.
