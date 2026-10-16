# Tasks

This folder holds **only work that is planned or in progress**. A task spec is a delivery instruction, not a record.

- The **docs are the source of truth**: [the manual](../game/README.md) describes the game as it runs, with the design
  notes and plans in the rest of the [documentation map](../../README.md#documentation-map). They are updated as each
  task lands.
- [decisions.md](../decisions.md) is the append-only record of *why*.
- A task spec is **deleted when its work is merged and the design docs carry the result** (D104). The full spec stays in
  git history; the table at the bottom names the last commit that holds each one.

## Current plan

**The game rework (D326–D336, D338) on the re-architecture's revised phases** ([08](../rearchitecture/08-phases.md),
[rework/13](../rework/13-removals-and-plan-changes.md) §4). [The rework](../rework/README.md) turned Uma Racer into
Race, Farm, Train: three tiers of five scenarios, one Training Hub unlock model paid with cooked dishes, every card open
and bonded per Uma, uma-rpg's farming catalogue, Prize Money and the Exchange, and World Expeditions (phase 9).
[The re-architecture](../rearchitecture/README.md) rebuilds the code underneath it on uma-platform's shared foundation.

| Phase | Milestone | State |
|---|---|---|
| 1 | M032 — a sound base: the API on the workspace domain, the startup budget, GitHub Packages, the live manual | **Done, 2026-10-14** (D337) |
| 2 | M033 — the rework's rules and `sim:loop` (T125–T133) | **Done, 2026-10-14** (D340–D351) |
| 3 | [M034 — the generation-2 cutover and the new game](M034-generation-2-cutover.md) | **Shipped 2026-10-15** (T134–T144, D352–D361): `ec5b1bd`, racer-api-00188, content `9ba4cdd37cca`. The owner's old save is purged (30 collections, 3,676 documents; `players/` is empty) and the retired bucket objects are deleted. **Left: [T144](T144-the-release.md)'s step 10** (below) |
| 6 | The Hub: uma-rpg's Phaser town on the four pages | **Shipped 2026-10-15, ahead of phase 5** (T145, D363): `b2cb668`, racer-api-00189. Its own art (four buildings, the Racing ground, currency marks, tier crests) landed as uma-art 2.7.0 from ChatGPT's packets A01 and A02 (D364): `1db8065`, racer-api-00190 |
| 4 | Push notifications, a port of uma-rpg's | **Archived 2026-10-16** (D370). Parked as sibling SE5 until the owner asks for push (uma-platform P51, P11) |
| 5 | Platform master data and the first shared packages | **Now sibling packet SE1** ([handoff](../handoff/README.md), uma-platform P51), Claude's: the GameTora pipeline goes |
| 7 | The Farm and Training places as pixel-art scenes | **Archived 2026-10-16** (D370) |
| 8 | The race on Phaser; PixiJS leaves the repo | **Archived 2026-10-16** (D370). PixiJS stays for the race scene |
| 9 | World Expeditions | **Kept through the 2026-10-16 cleanup** (D370): without it the first Uma to finish tier 1's last career has nowhere to go. Not specified yet. It must land within about 16–20 weeks of 2026-10-15 (by about 2027-02-04 to 2027-03-04), before the first Uma finishes tier 1's last career |

**Still open, as of 2026-10-16:**
1. **T144's step 10, the follow-up release.** Once the owner confirms in chat that the new account is theirs, it
   removes `POST /api/legacy/purge` and the boot's purge call with their tests, deletes this folder's M034 and T144
   specs (D104), moves phase 3 to "Completed and removed", and writes the release decision. **D362 is reserved for that
   record.**
2. **The sibling packets** (uma-platform P51): SA7, the plaza crowd, and SE1, phase 5, are ready. SB6, SC5, SD4 and
   SE4 wait on their uma-platform packets. The queue and its states are in [handoff](../handoff/README.md). The
   redirects and the first-boot wipe leave with SE1, phase 5 (D365, D370).
3. **Phase 9, World Expeditions,** due by about 2027-02-04 to 2027-03-04 and specified when it starts.

**Archived 2026-10-16 (D370), the owner's cleanup of open items unrelated to the sibling work:**

| Item | Where it lives |
|---|---|
| Phase 4, push notifications | Sibling SE5, parked until the owner asks (uma-platform P51) |
| Phase 7, the Farm and Training as pixel-art scenes | [rearchitecture/08](../rearchitecture/08-phases.md) "Phase 5: the Farm" and `git show 3236188:docs/tasks/README.md` |
| Phase 8, the race on Phaser | [rearchitecture/08](../rearchitecture/08-phases.md) and `git show 3236188:docs/tasks/README.md` |
| The whole interface in pixel art (the owner's open direction) | `git show 3236188:docs/open-questions.md`; if wanted, it's a "Both apps:" request ([change protocol](../change-protocol.md)) |

A revived item starts as a new spec or packet with a new number.

The `pre-split` tag marks the old game.

**Retired unbuilt (D339):** M024 (T081), M010 (T035) and M011 (T036–T039). The rework removes what they built on.
Game feel and device acceptance for the new game are planned after phase 3.

**Next free numbers: M035, T148 and D371** (D362 is reserved for T144's release record). Numbers are never reused, so
a decision that mentions T014 always means the same work. T057 was consumed by the per-scenario limit-break branch and
is not reused.

## Completed and removed

Each row's specs are readable with `git show <commit>:docs/tasks/<file>`. Pages T143 deleted with the retired systems
are named by their old path (`design/uma-rpg.md` …); read them with `git show pre-split:docs/<path>`.

| Work | Landed | Carried by | Last commit with the specs |
|---|---|---|---|
| A03 (ChatGPT handoff) — the four remaining Uma pickers open on level, with context sorts optional and Open goals as a Racing filter; the default Farm Uma follows the first row unless explicitly linked | 2026-10-16 | [game/07](../game/07-farm.md) §10, [game/05](../game/05-training-hub.md) §8, [game/11](../game/11-hub-and-places.md) §9.2, D368, [phone proof](../research/a03-level-rule/README.md) | `652cc58` (`docs/handoff/tasks/`) |
| T147 — uma-racer on the shared uma-kit 0.1.2 (uma-platform P48, sibling step A6.2): the kit's theme, shell, Hub map and primitives with the racer's chips, tabs, sheets, ground and words passed in; the iPhone band fixed; dark mode and Appearance in Account | 2026-10-16 | [architecture](../game/architecture.md#uma-kit), [game/11](../game/11-hub-and-places.md) §1–§2, §12, [visual system](../design/visual-system.md#dark-mode), D367 | none (briefed in chat from uma-platform's sibling plan) |
| T146 — the compact Farm: durations instead of clock end times, Free Umas only in a one-screen job sheet with everything preselected, icon-first 48–56 pt rows with Collect, Repeat, Speed Tickets and ⋯, and a side panel that acts (2 taps to collect or restart, 3 to start a job); Training shares the rows | 2026-10-16 | [game/07](../game/07-farm.md) §10, [game/02](../game/02-check-ins-and-notifications.md) §3, [game/11](../game/11-hub-and-places.md) §2.6, D366 | none (built from the owner's feedback in chat) |
| A01–A02 (ChatGPT handoff packets) — the racer's four buildings, the Racing page's tiles, the currency marks, tier crests and Speed Ticket icon, published as uma-art 2.6.0 and 2.7.0 | 2026-10-15 | [game/11](../game/11-hub-and-places.md) §10.3, D364 | `d25d4e9` (`docs/handoff/tasks/`) |
| T145 — uma-rpg's Hub on the Home screen: the Phaser town, the side-panel quick look, stand-ins for the four buildings awaiting art | 2026-10-15 | [game/11](../game/11-hub-and-places.md), D363 | none (built from the owner's scope call in chat) |
| T143 — The switch (M034): generation 2 becomes the app, the retired systems are deleted, the docs are rewritten as built | 2026-10-15 | [The manual](../game/README.md), [its architecture's "Decided at the switch"](../game/architecture.md#decided-at-the-switch-t143), [rework/13](../rework/13-removals-and-plan-changes.md) §8, D361 | `1a39f95` |
| M033 / T125–T133 — The rework's rules, `sim:loop` and the builds against the field | 2026-10-14 | [The manual](../game/README.md) (live blocks), `packages/domain/src/<area>/` (moved there by T143), D340–D350 | M033: `adb10ed`; each T spec: the commit before its merge |
| M032 — Re-architecture phase 1: a sound base | 2026-10-14 | [rearchitecture/08](../rearchitecture/08-phases.md) phase 1, D337, [the manual](../game/README.md) | No spec file: the phase table was the spec |
| M024 / T081, M010 / T035, M011 / T036–T039 — **retired unbuilt** (D339) | 2026-10-14 | — | `afe4696` |
| M031 / T124 — Complete Farm release and guarded preparation | 2026-10-10 | Release contract (`technical/farm-kitchen-implementation.md`), D315 and acceptance evidence (`research/farm-kitchen-release-acceptance.md`); owner iPhone/account/PWA checks pending | `f6c4dcf` |
| T123 — Shared meal map, four builds and canonical race stats | 2026-10-09 | Joined contract (`technical/farm-kitchen-implementation.md`), D314 and synthetic phone proof (`research/farm-kitchen-phone-proof/README.md`); capability off, no owner execution | `064b7e1` |
| T122 — Five Farm districts, crew, cookbook, Items and Energy | 2026-10-09 | Presentation contract (`technical/farm-kitchen-implementation.md`), D313 and synthetic phone proof (`research/farm-kitchen-phone-proof/README.md`); capability off, no owner execution | `6734e58` |
| T121 — Real Farm host, local-first runtime and recovery | 2026-10-09 | Host contract (`technical/farm-kitchen-implementation.md`), D308 and real-storage verification (`research/farm-kitchen-host.md`); capability off, no owner execution | `05ce684` |
| T120 — Protected Farm/Extra reset and recovery | 2026-10-09 | Cutover contract (`technical/farm-kitchen-implementation.md`), D307 and synthetic rehearsal (`research/farm-kitchen-cutover-rehearsal.md`); disabled, no owner execution | `998d8b0` |
| T119 — Additive Farm records and atomic semantic sync | 2026-10-09 | Persistence contract (`technical/farm-kitchen-implementation.md`), D306 and synthetic verification (`research/farm-kitchen-sync.md`); both capabilities off, no reset | `3ea02b2` |
| T118 — Pure Farm catalogue, production/map rules and balance | 2026-10-09 | Pure contract (`technical/farm-kitchen-implementation.md`), D304 and balance witnesses (`research/farm-kitchen-balance.md`); no live Farm change | `adaca2b` |
| T117 — Puzzle setup parity with the RPG | 2026-10-08 | Setup contract (`technical/uma-puzzles-implementation.md`), D293 and synthetic phone proof (`research/puzzle-setup-parity/README.md`); ten parties, unchanged sync limits | `8665513` |
| T109 — Private owner-export Puzzle art upgrade | 2026-10-08 | Content contract (`technical/puzzle-content.md`), D292 and aggregate art acceptance (`research/puzzle-art-release-acceptance.md`); old placeholder packs retained | `4951830` |
| M030 / T116 — Verified-placeholder Puzzle release, tuning, Home and preservation backup | 2026-10-08 | Uma Puzzles (`design/uma-puzzles.md`), D289–D290 and release/owner checks (`research/uma-puzzles-release-acceptance.md`); later T109 art upgrade retained | `0879ce5` |
| T115 — Rehearsed preservation migration and safe Spark retirement | 2026-10-08 | Preservation v2 contract (`technical/uma-puzzles-implementation.md`), D287 and synthetic phone/restore proof (`research/puzzle-preservation-phone-proof.md`); release remains off | `ed99e2d` |
| T114 — Global materials, original vectors, debt/exchange and shared CL spend | 2026-10-08 | Material surface contract (`technical/uma-puzzles-implementation.md`), D283 and synthetic phone proof (`research/puzzle-material-phone-proof.md`); release remains off | `bf5585b` |
| T113 — Mobile Pixi battle, receipts and contextual guide | 2026-10-08 | Battle presentation contract (`technical/uma-puzzles-implementation.md`), D276 and synthetic phone proof (`research/puzzle-battle-phone-proof.md`); release remains off | `9bc12a4` |
| T112 — Global Puzzle Hub, roster, five parties and chapter maps | 2026-10-08 | Setup navigation contract (`technical/uma-puzzles-implementation.md`), D275, isolated real-host phone proof; release remains off | `fabfa27` |
| T111 — Real Puzzle host, local journal and recovery | 2026-10-07 | Real host/journal contract (`technical/uma-puzzles-implementation.md`), D274, isolated IndexedDB replay/rollback and lazy runtime adapter | `bb8c80b` |
| T110 — Additive Puzzle saves and atomic background sync | 2026-10-07 | Persistence/protocol v1 (`technical/uma-puzzles-implementation.md`), D273, pure resolver/API adapters/Dexie coordinator | `0c8b5e7` |
| T108 — Generated Puzzle campaign and reward economy | 2026-10-07 | Campaign v1 contract (`technical/uma-puzzles-implementation.md`), D271, domain campaign and `sim:puzzles` | `a68da98` |
| T107 — Deterministic five-Uma puzzle battle | 2026-10-07 | Battle v1 contract (`technical/uma-puzzles-implementation.md`), D270, domain engine and `sim:puzzles` | `58de801` |
| T106 — Puzzle progression and Constellation materials | 2026-10-07 | Pure contract (`technical/uma-puzzles-implementation.md`), D269 and `packages/domain/src/minigames/uma-puzzles/` | `e5b17fe` |
| M029 / T100–T103 — RPG chapter rollout (superseded unbuilt by D262) | 2026-10-05 | RPG design (`design/uma-rpg.md`), D262 | `9acfb84` |
| M028 / T099 — First playable RPG | 2026-10-04 | RPG design (`design/uma-rpg.md`), D257 and release/owner checks (`research/rpg-release-acceptance.md`) | `8e1b881` |
| T105 — Inspiration advance | 2026-10-04 | Advance (`design/skills-and-inheritance.md`, its section deleted with the cutover), D256 and phone proof (`research/inspiration-advance-phone-proof.md`) | `1ac3b19` |
| T104 — Global card stars | 2026-10-03 | Support Cards (`design/support-cards.md`), D255 and phone proof (`research/global-card-stars-phone-proof.md`) | `cea441c` |
| M027 — Training Rebalance (T087 linear levels and EXP bank, T088 spending Level-Up Tickets) | 2026-10-02 | Training (`design/training.md`), D211–D214 | git history |
| T089 — RPG pure progression rules | 2026-10-01 | Global Uma RPG (`design/uma-rpg.md`), D227 and `packages/domain/src/rpg/` | `ce2aa37` |
| T090 — RPG save and grouped commands | 2026-10-01 | Global Uma RPG (`design/uma-rpg.md`), Architecture (`technical/architecture.md`), D228 | git history |
| T091 — RPG deterministic combat | 2026-10-01 | Global Uma RPG (`design/uma-rpg.md`), D229 and `packages/domain/src/rpg/combat/` | git history |
| T092 — RPG battle journal and host | 2026-10-01 | Global Uma RPG (`design/uma-rpg.md`), Architecture (`technical/architecture.md`), D230 and `apps/web/src/game/rpg-battle-host.ts` | git history |
| T093 — RPG roster and party hub | 2026-10-01 | Global Uma RPG (`design/uma-rpg.md`), D232 and `apps/web/src/screens/rpg/` | git history |
| T094 — Phone battle screen | 2026-10-02 | Global Uma RPG (`design/uma-rpg.md`), D243 and phone proof (`research/rpg-battle-phone-proof.md`) | git history |
| T095 — Chapter maps and checkpoints | 2026-10-02 | Global Uma RPG (`design/uma-rpg.md`), D245, content handoff (`technical/rpg-chapter-content.md`) and phone proof (`research/rpg-chapter-phone-proof.md`) | git history |
| T096 — Battle EXP, skills and class promotion | 2026-10-03 | Global Uma RPG (`design/uma-rpg.md`), D246 and phone proof (`research/rpg-progression-phone-proof.md`) | git history |
| T097 — Private PriConne pipeline / URA draft | 2026-10-03 | Content contract (`technical/rpg-chapter-content.md`), D248 and private publication handoff (`research/rpg-private-ura-handoff.md`) | git history |
| T098 — Inspiration rewards / independent unlocks | 2026-10-03 | RPG rewards (`design/uma-rpg.md`), [Lineage](../design/skills-and-inheritance.md#lineage), D250 | git history |
| M026 — Produce nodes (T086) | 2026-09-30 | Stable Farm (`design/farm.md`), Constellations (`design/constellations.md`) and Architecture (`technical/architecture.md`) | `f6dd79a` |
| M025 — Stable Farm (T082–T085) | 2026-09-30 | Stable Farm (`design/farm.md`) and Architecture (`technical/architecture.md`) | `4ac41d7` |
| T001–T018 and the Milestone 6 plan | 2026-09-19 | design docs | `463edb8` |
| T024–T027 and M008, **superseded** by the training rework (D119–D125) rather than completed | 2026-09-20 | — | `0a57f4c` |
| M012 (constellation engine, save v5), M013 (constellation screen), M014 (Spark Match, Bond Recall), then T058 | 2026-09-21 | Constellations (`design/constellations.md`), Minigames (`design/minigames.md`) | `ac1c157` |
| M016 — cards by scenario | 2026-09-22 | D129–D131, Support Cards (`design/support-cards.md`) | git history |
| M017 — career goals | 2026-09-24 | D137–D138, [Scenario Careers](../design/scenario-goals.md) | git history |
| M018 — race engine v5, and T060 (the early stamina wall) | 2026-09-24 | D139–D141, [Racing](../design/racing.md#engine-v5-m018), [Race Engine v5 Findings](../research/race-engine-v5-findings.md) | git history |
| T052 — constellation silhouettes | 2026-09-25 | D143, Constellations (`design/constellations.md`) | git history |
| M019 — stars and tickets | 2026-09-25 | D147–D148, D150, Support Cards (`design/support-cards.md`), Economy (`design/economy.md`) | git history |
| T059 — chibi and outfit-stand art | 2026-09-26 | D160, Collection (`design/collection.md`) | git history |
| M015 — scenario identity | 2026-09-26 | D163–D165, Scenarios (`design/scenarios.md`), [Badges](../design/badges.md), Collection (`design/collection.md`) | git history |
| M009 — look and feel | 2026-09-26 | D166–D167, [Visual System](../design/visual-system.md) | git history |
| M020 — Friendship Training | 2026-09-26 | D146, D168, D173, D177, Minigames (`design/minigames.md`) | git history |
| M007 — align and stabilize (T019–T022; T023 retired, D189) | 2026-09-28 | D105–D108, D114, [Infrastructure](../technical/infrastructure.md#release-runbook) | `7129d77` |
| M021 — turn-based races (T066–T070) | 2026-09-28 | D153–D155, D158–D159, D163, [Racing](../design/racing.md#engine-v7-the-originals-physics-and-field) | `7129d77` |
| M022 — Spark Rival Circuit (T071–T074) | 2026-09-28 | D169–D172, D187, Minigames (`design/minigames.md`) | `7129d77` |
| M023 — minigame kit (T075–T077) | 2026-09-28 | D185, Minigame kit (`design/minigame-kit.md`) | `04b395a` (M023, T075) · `19a8dc0` (T076) · `ef1ac35` (T077) |

"git history": `git log --diff-filter=D -1 --format=%h -- docs/tasks/<file>` finds the commit that removed a spec; its
parent (`<hash>^`) still holds it.

## Writing a task spec

Follow the shape the earlier specs used: scope and fixed choices, an implementation contract, deliverables, tests,
acceptance, and what is explicitly out of scope. Every rule in a spec must be traceable to a design doc or a decision
entry; if a task needs a new rule, it updates the manual page (or design doc) and appends a decision in the same PR.

Agents: read [AGENTS.md](../../AGENTS.md) first. Work on a branch and open a pull request. Never push to `main`.
