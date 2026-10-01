# T092 — Battle journal, resume and commit boundary

**Goal:** connect the pure battle to persistent frozen entries without granting duplicate rewards. Read
[M028](M028-uma-rpg.md), [Architecture](../technical/architecture.md), D219 and the T090/T091 implementations.
Depends on T090 and T091.

## Scope and contract

- Define an RPG battle host separate from ticketed `MinigameHost`: enter from a validated preset/chapter node,
  atomically freeze encounter identity/content version/party and seed, append player actions to a device-local Dexie
  journal, restore by replay, and close with a revision-checked terminal result. Do not cap it at 64 actions.
- Save journal schema/version and replay hash. A reload on the same device presents the exact current turn. Missing or
  corrupt local journal requires an **explicit** restart from the same frozen entry, never a new encounter. A second-
  device takeover invalidates the former lease; the stale device must display a conflict and cannot commit.
- Make result evidence idempotent on attempt/encounter id. A loss returns to the frozen entry/checkpoint for a free
  retry; already-cleared node rewards remain. The host exposes a typed result for later T095 EXP and T098 token
  integration, but does not yet mint either. No network round-trip is needed for each action.

## Acceptance

Tests cover interrupted turn replay, corrupt journal, reconnect, concurrent takeover, stale commit rejection,
duplicate terminal call and free retry with unchanged seed/content. A repeated action cannot be journaled twice.
`pnpm lint`, `pnpm test`, `pnpm build` and replay tests pass. Update architecture and remove this spec in its PR (D104).

**Out of scope:** battle UI, map authoring, level grants and token grants.
