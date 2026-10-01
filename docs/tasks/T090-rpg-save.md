# T090 — RPG save and synchronization contract

**Goal:** persist the RPG without making an open fight rerollable or letting concurrent devices overwrite progress.
Read [M028](M028-uma-rpg.md), [Architecture](../technical/architecture.md), the current save/API/Dexie modules and
D219. Depends on T089 and the **latest merged save schema** at start; do not preselect a version number here.

## Scope and contract

- Define validated account state for per-owned-outfit RPG profile (locked class/weapon, tier/level/EXP, skill trees and
  loadouts), exactly five named party presets, and per-preset/per-chapter checkpoints. A partial preset may save but
  cannot enter. Every entered encounter records stable attempt identity, chapter/content version, frozen members/kits,
  enemy identity and seed, last cleared node, revision/lease and result evidence references.
- Add migration/defaults, API body parser/size validation, local Dexie storage and sync merge/rejection behavior.
  Existing profiles and Items survive unchanged; no cloud credentials or infrastructure edits. A stale writer cannot
  replace a newer checkpoint or double-grant. An old client treats unknown RPG state safely rather than erasing it.
- Specify the takeover state machine: same-device action journal lives locally (T092); a second device sees an active
  fight and may explicitly restart its **same frozen entry**, incrementing revision and invalidating the first
  device's commit. A reinstall follows the same visible restart path. No action-by-action network dependency.
- Implement persistence primitives and conflict tests without a visible RPG route or token item grant.

## Acceptance

Migration is one-time and lossless; malformed/oversized bodies fail; round-trip/sync preserves five presets and two
paused chapters; stale writes and repeated takeover cannot silently change content, seed or checkpoint. Memory-only
development saves follow equivalent rules. `pnpm lint`, `pnpm test`, `pnpm build` pass. Update architecture/design
and remove this spec in its PR (D104).

**Out of scope:** battle actions, map screen, Home entry, RPG EXP and Inspiration token writes.
