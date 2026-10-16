# A03 · Level-first picker acceptance

2026-10-16 · P48 Phase 0.2 · D368. Based on main `652cc58`, including the shipped uma-kit 0.1.2 (T147).
The revised A03 packet excludes the iPhone band: the shared kit already carries that fix (D367). No local shell,
theme or kit component was changed. The owner explicitly authorized merge and deployment in chat.

## Phone preview

All images are **390 × 844**, from a separate worktree's Vite on **127.0.0.1:5185**, using only `/dev/seeds/`'s
invented accounts and placeholder Uma art. No owner save, private content, account export or original-game art was
read or included. Item icons are uma-platform's existing art. Appearance was changed through Account, not injected.

| Picker | Light | Dark | Observed |
|---|---|---|---|
| Farm job sheet | [Light](farm-picker-light.jpg) | [Dark](farm-picker-dark.jpg) | Farm levels 13, 13, 8, 8; Ember preselected even though the planner suggests Juniper, and Juniper's higher EXP multiplier no longer wins |
| Training session | [Light](training-picker-light.jpg) | [Dark](training-picker-dark.jpg) | The two Lv10 Umas precede Lv1; sort opens on Level; Left here is selectable and does not replace Level on next opening |
| Lineage slot | [Light](lineage-picker-light.jpg) | [Dark](lineage-picker-dark.jpg) | The two Lv10 Umas precede Lv1; What she adds stays in the sort menu |
| Racing | [Light](racing-picker-light.jpg) | [Dark](racing-picker-dark.jpg) | The two completed Lv10 careers precede open Lv1 careers |
| Racing filter | [Open goals](racing-open-goals-light.jpg) | — | Opting in hides completed careers, preserves order, chooses an eligible Uma and retains a reversible chip |

### Reproduce

Run `pnpm --filter @racer/web exec vite --host 127.0.0.1 --port 5185 --strictPort` from the branch's worktree.
Use Account → Appearance for the desired theme. The routes:

- Farm: `/dev/seeds/farm/vegetable-garden?seed=busy&job=&slot=3`.
- Training: `/dev/seeds/training/observatory?seed=gate&session=`.
- Racing: `/dev/seeds/racing/racecourse?seed=gate`; tap Open goals.
- Lineage: `/dev/seeds/training/lineage-hall/sim-uma-01?seed=gate`. In this synthetic account only:
  Account → Dev → +10 of every grade-1 raw, crafted and dish; Back; Parent A → Unlock → Start; Account →
  Finish her work (Amber Sprint); Back → 1 unlock finished → Fill slot A. This exercises the real session and Collect
  operations in the in-memory port; it does not grant or unlock anything in production.

## Automated checks

- `pnpm lint`: pass.
- `pnpm test:ci`: pass, including the new route integration tests and existing Farm, Training, Racing, save and kit suites.
- `pnpm build`: pass; **149.76 KB gzip initial JS / 180 KB**, with Phaser and PixiJS still lazy.
- `pnpm docs:update`: the live blocks are unchanged.
- Pure comparator tests pin Farm Level ahead of aptitude, suited/release/name ties, multiplier independence, Free-only
  eligibility, default and named-link preselection; Racing tests pin cross-tier lifetime ordering and release/name ties.
- Real-route tests pin both optional context sorts, disabled Umas last with their reasons, completed careers in level
  order, Open goals toggle/reload/empty state, old pre-race query removal, explicit lower-level links and no operation
  receipts created by browsing.

## Still the owner's check

The physical iPhone Home Screen status-bar and home-indicator insets cannot be reproduced by a desktop viewport.
Confirm the shared kit's already-shipped band fix on the phone, plus comfortable scrolling/tapping in these four
pickers. No owner account acceptance is claimed. Production merge/deploy verification is recorded on the PR.
