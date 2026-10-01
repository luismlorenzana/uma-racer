# Milestone 28 — Global Uma RPG

**Outcome:** a self-contained, account-wide, five-outfit turn-based campaign reachable from Home. The player saves
five party presets, enrolls eligible outfits into one locked class/weapon, navigates an authored branching chapter,
fights deterministic character teams, earns outfit-specific RPG levels/skills, promotes through repeatable class tiers,
and receives scenario Inspiration Unlock Tokens in global Items. Tokens open Inspiration parent branches. Racing,
Training, cards and Farm retain their own progression.

Source of truth: [Global Uma RPG](../design/uma-rpg.md), [RPG research](../research/uma-rpg.md),
[Minigame kit](../design/minigame-kit.md), [Architecture](../technical/architecture.md), D215–D222. This is a
**planned milestone, not a shipped feature**. Do not use this plan to expose a Home entry or publish placeholder
enemies. PRs for this milestone must start from the latest `main`, use a branch and never push to `main`.

## Delivery sequence

| Task | PR-sized outcome | Depends on |
|---|---|---|
| [T089 — RPG rules and tuning](T089-rpg-rules.md) | Pure aptitude, profile, EXP, class-tier and skill-tree rules; bounded synthetic progression sim; settled numeric pins | Current `main`; rebase after concurrent save/item work |
| [T090 — RPG save contract](T090-rpg-save.md) | Versioned outfit/preset/checkpoint state, API validation, Dexie migration and sync conflict contract | T089; latest save version |
| [T091 — Deterministic combat engine](T091-rpg-combat.md) | Pure five-member battle, six weapon paths, five elements, enemy intent, statuses and replay; combat sim | T089 |
| [T092 — Battle journal and host](T092-rpg-battle-host.md) | Device-local action journal, frozen entry, second-device takeover and idempotent battle result boundary | T090, T091 |
| [T093 — RPG roster and party hub](T093-rpg-hub.md) | Lazy internal route, enrollment/profiles, five saved presets and overlays; no Home entry | T089, T090 |
| [T094 — Phone battle screen](T094-rpg-battle-screen.md) | Five-actor touch battle and result view against synthetic encounters, with same-device resume | T091–T093 |
| [T095 — RPG progression integration](T095-rpg-progression.md) | EXP grants, level reveals, tree spending/loadouts and lossless class promotion | T089, T090, T092, T094 |
| [T096 — Chapter maps and checkpoints](T096-rpg-chapters.md) | Branching chapter contract, previews, pause/retry, boss and map UI using synthetic content | T090, T092, T094, T095 |
| [T097 — Private PriConne content pipeline](T097-rpg-content.md) | Validated pack/import/art references and first authored private chapter; owner-run private publish | T096's chapter schema |
| [T098 — Inspiration reward bridge](T098-rpg-inspiration.md) | Transactional scenario token grants and consumption, grandfathered lineage migration | T090, T096; latest Inspiration and Items implementation |
| [T099 — Playable release and device pass](T099-rpg-release.md) | End-to-end real-content gate, Home entry, guide, regression/device protocol and handoff | T093–T098 and private publish |

```text
T089 ─► T090 ────────────────┬─► T092 ─► T094 ─► T095 ─► T096 ─► T097 ─┐
  └────► T091 ───────────────┘       ▲          │          └─► T098 ──────┤
          T090 ─► T093 ───────────────┘          └───────────────────────────► T099
```

The diagram is a dependency guide, not permission to merge against stale `main`. T093 can proceed while T091 is
built; T097's private authoring can begin after T096 defines the schema while T098 implements the token bridge. T099
waits for both. One task = one PR; remove that task's spec in its implementation PR (D104), update the design and
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
  successful identity. Free retry never rerolls a frozen entry.
- **Private content.** Playable PriConne characters are the actual opponent cast. Importer/validator code and tiny
  invented fixtures may be checked in; extracted rows, art, generated packs and caches may not. Missing or outdated
  private content is shown as unavailable, never silently substituted with a synthetic production duel.
- **Token destination and sink ship together.** Each successful clear, including replay, grants one scenario-typed
  `Inspiration Unlock Token [Scenario]` into the existing global Item inventory. One token opens one full parent
  branch; two open both. Already-open TL-gated branches remain open and are not charged.
- **No premature Home entry.** Development routes may use synthetic fixtures for browser validation, but the public
  navigation points to the mode only after T099 proves a real published chapter, complete reward/sink and resume.

## Balance and architecture gates

T089 and T091 must settle **only the rules they implement**. The current curve, 10% specialization, skill point
scaffold and elemental direction are documented candidates or approved scaffold, not permission to bake untested
coefficients into save migrations. Check a five-scenario promotion pace and two tiers with a modest synthetic sim;
compare six paths, heal/guard/weakness, overleveled replay and catch-up. Write the chosen formulas in the design,
append decisions, pin changed numbers in `packages/domain/src/domain.test.ts`, and save replay fixtures/hashes so later
screen/content work cannot alter results accidentally. If tuning materially changes the approved identity, stop and
ask the owner before implementation.

T090 defines the save and conflict boundary *before* a UI writes it. It must follow the latest actual save version and
Dexie tables when started; do not reserve a version number in this plan. Its API parser rejects malformed or oversized
untrusted RPG state. The active battle action journal stays device-local, while the frozen entry and chapter checkpoint
sync. Every new global Item uses the existing stack and ledger rather than a second wallet. The RPG is **not** a
ticketed `MinigameHost` run, and its multi-fight chapter must not inherit that port's action cap or terminal run model.

## Release and verification

Each implementation PR runs `pnpm lint`, `pnpm test`, `pnpm build`, the relevant RPG sim/replay suite, and any existing
sim its changed rules touch. Report startup gzip (≤180 KB) and RPG chunk size; screen PRs include 390×844 and small-
iPhone screenshots, 44 pt/safe-area/reduced-motion checks. T099 requires a browser end-to-end path through a **real
published first chapter**, an offline/background/reload/reconnect conflict pass, accessibility pass and owner physical-
iPhone sign-off. An unavailable content pack is a release blocker, not an invitation to ship synthetic enemies.

Completion does **not** imply all fourteen scenarios have authored chapters. T097 authors/validates one complete
private chapter to establish the production pipeline; later chapter rollout is explicitly separate work after the
first playable release. The Item catalog can represent all scenario token ids from day one, but a token is earned
only from an authored, published chapter. If the owner wants all fourteen before Home release, change this gate in
the design and decision log first.

## Explicitly out of scope

RPG combat consumables (`Item` remains disabled until defined), voice/story dialogue, actual race-engine events,
within-style weapon respec, extra running-style tracks, PvP, gacha, new infra/workflows/env files, and checked-in
third-party character data or art. A later milestone can add more chapters, richer class variants and live balance
after real device play.
