# T093 — RPG roster, enrollment and party hub

**Goal:** let the player set up and inspect their RPG roster before a chapter exists, without exposing an unfinished
Home entry. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[implementation contract](../technical/uma-rpg-implementation.md), [Visual System](../design/visual-system.md)
and D219–D223. Depends on T089 and T090.

## Scope and contract

- Add a lazy internal RPG route with Hub, Roster and Parties views. It opens on saved account RPG state, never an Uma
  picker interstitial. Five named presets persist member order and per-slot signature/loadout selection; enforce five
  **distinct owned outfits** at launch and show empty/partial presets as editable, not launchable. No class quota.
- Enroll an outfit once from its A running styles, choose one corresponding weapon path and eligible **default**
  signature element; each preset slot may select another eligible active signature. Make the locked style and
  first-delivery fixed weapon path unmistakable before confirmation. Never infer
  eligibility from a mutable racing preference. Show per-outfit tier/level/EXP, growth-derived attributes, elemental
  affinities and skill slots, with a clear ineligible state if no A style exists.
- Use existing outfit art if present, and place readable weapon and element glyph+text overlays on every RPG portrait
  component for later map/battle/result reuse. Include a toggleable element legend; color cannot be the sole cue.
  Mobile touch targets ≥44 pt, safe-area padding, reduced-motion support and lazy route/chunk.

## Screen/state handoff

- Internal route structure: Hub (five preset cards, continue/change party), Roster (owned outfit list and RPG
  profile), Parties (five ordered slots, signature/loadout), Enrollment confirmation. All use the same saved state
  selectors; no second roster copy in component state. Before T095 exists, chapter CTA says unavailable in this
  internal route rather than linking to an empty map; **do not add Home navigation**.
- Roster shows Locked choice, eligible A-style options and A/B-distance elemental legend before enrollment. An
  ineligible outfit remains visible with a reason. An enrolled outfit's style/weapon is displayed read-only; no
  accidental re-enrollment/reset. The profile distinguishes RPG tier/local level from race Uma Level, Training Level
  and Farming Level. Preset edit warns if a selected outfit changes elsewhere and reloads on stale revision.
- Build one reusable `RpgPortrait`/overlay projection for party, map, battle and result: outfit art, weapon glyph+text,
  active signature glyph+text, optional affinity legend. Portrait face remains unobscured; missing private art gets
  the app's honest content-unavailable treatment, not a new copyrighted placeholder in git.
- UI states to screenshot/test: empty account, five owned eligible outfits, partial preset, duplicate outfit
  refusal, no-A outfit, dual-A enrollment choice, active-signature switch and stale/cloud-updated preset.

## Acceptance

Enrollment and all five presets survive reload and cloud sync; invalid/duplicate/locked outfit choices are refused;
the setup makes Front/Pace/Late/End options accurate. Browser screenshots at 390×844 and 375×667 show the hub,
five-slot editor and overlays. `pnpm lint`, `pnpm test`, `pnpm build` pass; report startup gzip ≤180 KB and RPG chunk.
Remove this spec in its PR (D104).

**Out of scope:** Home navigation, map, combat, RPG rewards and PriConne content.
