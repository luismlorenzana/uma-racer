# Milestone 28 — Global Uma RPG

**Outcome:** the first **real, playable URA Finale chapter** of a self-contained, account-wide, five-outfit turn-based campaign
reachable from Home. The player saves
five party presets, enrolls eligible outfits into one locked class/weapon, navigates an authored branching chapter,
fights deterministic character teams, earns outfit-specific RPG levels/skills, promotes through repeatable class tiers,
and receives scenario Inspiration Unlock Tokens in global Items. Tokens open Inspiration parent branches. Racing,
Training, cards and Farm retain their own progression.

Source of truth: [Global Uma RPG](../design/uma-rpg.md), [implementation contract](../technical/uma-rpg-implementation.md),
[RPG research](../research/uma-rpg.md), [Minigame kit](../design/minigame-kit.md),
[Architecture](../technical/architecture.md), D215–D224. This is a
**planned milestone, not a shipped feature**. Do not use this plan to expose a Home entry or publish placeholder
enemies. PRs for this milestone must start from the latest `main`, use a branch and never push to `main`.

## Delivery sequence

| Task | PR-sized outcome | Depends on |
|---|---|---|
| T089 — RPG rules and tuning ✅ | Pure aptitude, profile, EXP, class-tier and skill-tree rules; bounded synthetic progression sim; settled numeric pins | Landed; see D227 and [RPG design](../design/uma-rpg.md#outfit-rpg-profile-and-progression) |
| T090 — RPG save contract ✅ | Versioned outfit/preset/checkpoint state, API validation, Dexie v18 and **atomic grouped mutation** protocol; D228 | T089; landed |
| T091 — Deterministic combat engine ✅ | Pure five-member battle, six weapon paths, five elements, enemy intent, statuses and replay; combat sim (D229) | Landed |
| T092 — Battle journal and host ✅ | Device-local action journal, frozen entry, second-device takeover and idempotent battle result boundary (D230) | Landed |
| T093 — RPG roster and party hub ✅ | Lazy internal route, enrollment/profiles, five saved presets and overlays; no Home entry (D232) | Landed |
| T094 — Phone battle screen ✅ | Five-actor touch battle, replay-only preview/cues, explicit recovery/results and isolated DEV proof (D243) | Landed; [phone checks](../research/rpg-battle-phone-proof.md) |
| T095 — Chapter maps and checkpoints ✅ | Pure graph/private schema, receipt-gated branching map, pause/retry/clear/replay and isolated synthetic chapter (D245) | Landed; [handoff](../technical/rpg-chapter-content.md), [phone checks](../research/rpg-chapter-phone-proof.md) |
| T096 — RPG progression integration ✅ | Atomic five-outfit EXP, pending/accepted level reveals, safe skill/loadout edits and bank-preserving promotion (D246) | Landed; [progression rules](../design/uma-rpg.md#settled-t096-encounter-exp-and-checkpoint-choices-d246), [phone checks](../research/rpg-progression-phone-proof.md) |
| T097 — Private PriConne content pipeline ✅ | Offline compiler/validator, curated portraits, retained-version runtime and private URA draft (D248) | Code complete; [owner publication handoff](../research/rpg-private-ura-handoff.md) pending |
| T098 — Inspiration reward bridge ✅ | Two scenario token families, independent six-slot/twelve-gold unlocks, mirrored-grandparent SP, v14 migration and original icons (D250) | Implemented; private publication/device release remain T099 |
| [T099 — Playable release and device pass](T099-rpg-release.md) | End-to-end real-content gate, Home entry, guide, regression/device protocol and handoff | T093–T098 and private publish |

```text
T089 ─► T090 ────────────────┬─► T092 ─► T094 ─► T095 ─► T096 ─► T097 ─┐
  └────► T091 ───────────────┘       ▲          │          └─► T098 ──────┤
          T090 ─► T093 ───────────────┘          └───────────────────────────► T099
```

The diagram is a dependency guide, not permission to merge against stale `main`. T097's compiler/runtime and
private URA draft are complete; **owner/Claude private publication remains pending**. T098's expanded token bridge is implemented. T099 waits for it and published-content verification. One task = one PR; remove that task's spec in its implementation PR (D104), update the design and
milestone table, and record any newly settled rule in `docs/decisions.md`.

## Non-negotiable contracts

- **Five filled slots, no role quota.** Outfit enrollment needs an A running style; one chosen running style and one
  weapon path remain fixed for the first delivery. A/B distance aptitudes control eligible elements. Turf/Dirt is
  chapter context, not a second element gate under the current draft (D219–D221).
- **No cross-mode stat writes.** Speed drives ATK and MATK from the outfit's base stats/growths. RPG tier, level,
  trees, EXP and party presets are global/account state. Racing and constellation progress are not RPG rewards.
- **Determinism at every boundary.** A battle freezes chapter/content version, party/kit, enemy team, identity and
  seed. Pure rules replay actions; same-device journal restores exactly. Another device explicitly restarts that same
  frozen entry after a versioned takeover. Grant evidence makes battle EXP and chapter tokens exactly once per
  successful identity. Free retry never rerolls a frozen entry. A result, EXP and token movement use the
  [grouped mutation protocol](../technical/uma-rpg-implementation.md#existing-seams-and-the-sync-hazard), not the
  ordinary sync batch whose logs can append even on entity conflict. Offline rewards remain visibly pending.
- **Private content.** Playable PriConne characters are the actual opponent cast. Importer/validator code and tiny
  invented fixtures may be checked in; extracted rows, art, generated packs and caches may not. Missing or outdated
  private content is shown as unavailable, never silently substituted with a synthetic production duel.
- **Token destination and sink ship together.** Regular/elite wins grant scenario Skill Tokens; accepted boss clears grant 30 Slot Tokens. At least 60 Skill Tokens on the shortest route fund five outfits' twelve golds; 30 slots fund their six lineage positions each. Tokens use global Items and acknowledged groups. Mirrored grandparents use normal SP; single-side unique/gold full chains cost 2×. Old TL-open sides retain slots and golds without charges (D250).
- **No premature Home entry.** Development routes may use synthetic fixtures for browser validation, but the public
  navigation points to the mode only after T099 proves a real published chapter, complete reward/sink and resume.

## Balance and architecture gates

T089 settled the level curve, 10% specialization, skill points, depth gates and slot bounds in D227. T091 settled
the combat rules, elemental triangle and bounded weakness follow-up in D229 with the synthetic six-weapon matrix and
fixed replay fixture. These coefficients live only in the pure engine, not save migrations. T096 settles encounter
EXP against both T095 routes over five chapters/two tiers (D246); production chapters must remeasure their authored
fight counts before release. If later tuning materially changes the approved identity,
stop and ask the owner before implementation.

T090 defined the save and conflict boundary *before* a UI writes it: RPG wire schema v1, Dexie v18, independent API
validation and conditional grouped acknowledgements (D228). A rejected checkpoint leaves no result or Item ledger
entry behind. T092's active battle action journal is device-local, while the frozen entry and chapter
checkpoint sync. Every new global Item uses the existing stack and ledger rather than a second wallet. The RPG is **not** a
ticketed `MinigameHost` run, and its multi-fight chapter must not inherit that port's action cap or terminal run model.

## Release and verification

Each implementation PR runs `pnpm lint`, `pnpm test`, `pnpm build`, the relevant RPG sim/replay suite, and any existing
sim its changed rules touch. Report startup gzip (≤180 KB) and RPG chunk size; screen PRs include 390×844 and small-
iPhone screenshots, 44 pt/safe-area/reduced-motion checks. T099 requires a browser end-to-end path through the **real
published URA Finale chapter**, an offline/background/reload/reconnect conflict pass, accessibility pass and owner physical-
iPhone sign-off. An unavailable content pack is a release blocker, not an invitation to ship synthetic enemies.

Completion does **not** imply all fourteen scenarios have authored chapters. T097 authors/validates URA Finale's
private chapter to establish the production pipeline; [M029](M029-rpg-chapter-rollout.md) separately tracks the
remaining thirteen after the first playable release. The Item catalog can represent all scenario token ids from day
one, but a token is earned only from an authored, published chapter. If the owner wants all fourteen before Home
release, change this gate in the design and decision log first.

## Explicitly out of scope

RPG combat consumables (`Item` remains disabled until defined), voice/story dialogue, actual race-engine events,
within-style weapon respec, extra running-style tracks, PvP, gacha, new infra/workflows/env files, and checked-in
third-party character data or art. A later milestone can add more chapters, richer class variants and live balance
after real device play.
