# T101 — RPG chapters for scenario tiers 6–9

**Outcome:** Project L'Arc, U.A.F. Ready GO!, Great Food Festival and Run! Mecha Umamusume each have a published
private RPG chapter and matching Inspiration token. Depends on T100 and latest `main`. Read
[M029](M029-rpg-chapter-rollout.md) and [the implementation contract](../technical/uma-rpg-implementation.md).

## Delivery contract

- Author four independent private graphs with distinct playable PriConne team/element/role pressure, meaningful
  fork previews and telegraphed bosses. Freeze content versions for existing checkpoints; a new publication must
  leave an open tier-2–5 battle replayable. Validate official art variants and all action/graph references privately.
- Publish through the existing private process and report pack hashes plus aggregate node/actor/art/phase coverage
  only. Code changes needed by a new chapter archetype must be general, tested on invented fixtures and reviewed for
  effects on the first five chapters; do not introduce a hidden one-off engine branch tied to a private enemy id.
- Exercise each new chapter's normal route, alternate fork, loss/retry, boss clear, replay and matching token grant.
  Run a mixed-level party through tiers 5–9 and compare per-member EXP, HP/MP pressure, healing and promotion pace
  against T096's documented envelope. If the envelope fails, amend the design, append a decision and pin changed
  numbers before applying a global coefficient.

`pnpm lint`, `pnpm test`, `pnpm build`, RPG sims and the private pack validator pass. Report startup gzip/RPG chunks,
aggregate validation and browser/device screenshots for changed screens. Update coverage table and delete this spec
in its PR (D104). Missing private publication leaves the task open.

**Out of scope:** tiers 10–14, source combat formula copying and unreviewed global rebalance.
