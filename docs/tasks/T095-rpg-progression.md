# T095 — RPG EXP, trees, loadouts and promotion

**Goal:** make battles grow each participating outfit and let the player shape the next encounter. Read
[M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md), D217–D221 and T089/T092 contracts. Depends on
T089, T090, T092 and T094.

## Scope and contract

- On a committed encounter result, grant tier-local RPG EXP to its **frozen participating outfits** exactly once,
  with level-relative catch-up/taper and an explicit KO participation rule settled by a small synthetic sim. The
  result names every crossed level, five stat deltas, new points/slots and how much EXP is banked at Lv50.
- At a safe checkpoint, spend earned even-level tree points in eligible weapon×element cells; offer target, rhythm
  and role branches, skill levels to five and the A-only depth-five capstone. Validate choices on domain and save
  boundaries. Save bounded active loadouts per preset; new skills do not silently equip or replace legacy techniques.
- Let Lv50 outfits manually promote to the next class tier, preserving permanent stats, EXP bank, prior mastery and
  usable bounded legacy loadout. Tier renewal cannot switch running style or selected weapon. Freeze stats/kit on
  battle entry so changes elsewhere affect only the next encounter.
- Settle reward scaling, KO rule, slot cap and legacy use policy in design/decision/pinning tests before deploying
  them; keep no random level-up rolls and never modify race/Training/Farm levels.

## Acceptance

Tests prove duplicate result grants nothing, five actors can level independently, catch-up/replay remains bounded,
multi-level reveal is ordered, invalid tree points/slots are refused, and two promotions cannot lose EXP, stats or
combat capability. A synthetic two-tier progression sim stays in its documented envelope. Browser result/profile
screens at 390×844 show level gains and a safe-checkpoint setup CTA. `pnpm lint`, `pnpm test`, `pnpm build` and RPG
sims pass; report startup gzip ≤180 KB. Remove this spec in its PR (D104).

**Out of scope:** chapter clear tokens, PriConne content and Home entry.
