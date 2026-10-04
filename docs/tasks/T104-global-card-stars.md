# T104 — Global card stars

Owner-requested detour before T099. Source of truth: Support Cards and D255. Preserve D252–D254's four distance
presets per scenario; neither their sets nor their assignments are rewritten. Do not implement T081 or RPG release.

## Contract

- Each owned card has one account-wide 0–3★ count. All sets reference its existing template id. Era eligibility,
  era decay, node shares, Race Bonus, skill grants, ticket price, star curve and Friendship Training rules stay unchanged.
- Persist independently versioned card schema 1: `schemaVersion`, `templateId`, scalar `stars`, `maxCouponGranted`.
  Do not bump Uma/profile save v15. Dexie v25 walks all supported legacy cards to the maximum earned stars anywhere,
  not their sum. Apply the existing five-star/limit-break conversions before taking the maximum; preserve coupon flags,
  entity versions and coalesced outbox writes. Never drop unsupported/corrupt rows silently.
- Initial cloud adoption and conflicts migrate too. Global stars and an already-paid coupon flag never decrease on
  sync; concurrent counts merge by maximum, not addition. The API rejects old-schema and decreasing writes.
- Friendship Training selects a scenario only for era eligibility, races and twist. New reservations have one open
  run per card on this device, regardless of entry scenario. Keep every paid legacy run's id, seed, setup and journal;
  resume oldest first across scenarios. A legacy clear after the card is globally maxed still finishes idempotently,
  without a fourth star or second coupon. Never alter replay contents or retire valid three-star runs.
- Card page, both album lenses, set picker, constellation and minigame start/result/guide show global stars. Collection
  can bond directly; scenario lenses still quote their own per-node value. Frozen runs show their original scenario.

## Verification and completion

Synthetic tests cover maximum-not-sum migration through each historical shape, strict parsing, once-only coupons,
all fourteen contexts and four distance presets, unchanged set ids/assignments, local v24 upgrades and cloud adoption,
stale-device conflicts, cross-context reservations and maxed legacy-run completion. Run lint, test, build, training
and Spark sims; report any pre-existing sim failures separately. Verify screens at 390×844, report startup/Spark gzip,
open one PR, delete this spec in that PR under D104, then merge green CI and check deployment. No private data, new
dependencies or infrastructure changes.
