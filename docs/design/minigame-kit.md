# Minigame kit

How a minigame is built in Uma Racer: the contract every one keeps, where its parts live, the look they share and the
pieces to reuse (D185). Read it before designing or building a new minigame, or changing an existing one. Each game's own
rules stay in [Minigames](minigames.md); this page is what they have in common.

| Minigame | Raises | Rules | Code |
|---|---|---|---|
| **Uma Puzzles** (M030) | independent Puzzle EXP and scenario/style CL materials | [Uma Puzzles](uma-puzzles.md) | engine `packages/domain/src/minigames/uma-puzzles/` · host `game/puzzles/` · screens `screens/puzzles/` |
| **Spark Match — Rival Circuit** (retired M022) | historical Training EXP only (D190, D287) | [Minigames](minigames.md#spark-match--rival-circuit) | engine `packages/domain/src/minigames/spark-rival/` · screen `screens/minigames/SparkMatchScreen.tsx` · Pixi `scenes/spark-rival/` |
| **Friendship Training** (M020) | one card by one global star (D255); scenario is the frozen play context | [Minigames](minigames.md#friendship-training--card-stars) | engine `packages/domain/src/minigames/friendship/` · screen `screens/minigames/friendship/` |

## 1. What a minigame is here

- Minigames are the **third pillar** beside Collection and Racing, and the way to earn materials for CL or a
  card's stars (D120). A new minigame raises something the others do not, or replaces one; it never adds a second path
  to the same progress.
- **A ticketed run costs tickets** (one for Friendship, D148), spent when reserved. Free global Puzzle battles use
  their own host below, not this ticket port. Historical Spark prices live in the domain's economy
  module (`SPARK_MATCH_TICKET_COST`, `FRIENDSHIP_TRAINING_TICKET_COST`).
- **A run pays only its own progress.** It never pays Uma EXP, completes a career goal, writes a race record or moves race
  badges (D170). A loss is real, but may bank bounded partial progress when the game says so.
- **No per-turn luck the player cannot see.** Every roll comes from the run's seed; anything that will happen next is
  shown before the player commits (a rival's intent, a facility's target).

[Stable Farm](farm.md) is deliberately outside this kit. It is an asynchronous synced account activity with a persistent
outfit crew, a field that grows plot by plot in Sections of six and persisted deadlines, not a ticketed run with a seed, action
journal, terminal result or win/loss. It may reuse visual primitives and `PagedGuide`, but it must not be forced through
`MinigameHost` (D203, D206).

The [Global Uma RPG](uma-rpg.md) is likewise **outside this ticketed-run contract**: its chapters contain multiple
battles and synced checkpoints. T089–T098 now implement its own rules, grouped save, battle journal, internal setup,
mobile stage, branching maps, acknowledged EXP/skills/promotion and the private content/portrait pipeline.
The real URA chapter is privately published and T099 supplies verified Home entry (D257)
([publication record](../research/rpg-private-ura-handoff.md)). It reuses the kit's pure-engine, deterministic-replay,
private-content and mobile standards, `MinigameShell`/`MinigameHeader` and `PagedGuide`, not `MinigameHost` or tickets.
Its isolated DEV battle/chapter proofs grant no real-account rewards ([battle checks](../research/rpg-battle-phone-proof.md),
[chapter checks](../research/rpg-chapter-phone-proof.md), [progression checks](../research/rpg-progression-phone-proof.md)).
The chapter proof awards isolated synthetic EXP and scenario tokens; never real-account progress. T098 uses the existing
global Items/ledger and conditional map/spend commands, outside the ticketed-run port. Inspiration's independent
slot/gold rules and original SVG token marks are in D250 ([reward/unlock phone proof](../research/rpg-inspiration-phone-proof.md)).
It preserves D249's compact planets, semantic Unique/gold moons and complete six-slot bank; each rail action carries
its own slot identity. Neither mode uses the ticketed MinigameHost.

T099 adds manifest-only Home discovery followed by lazy real-chapter/portrait verification,
acknowledged per-party resume cards, and one nine-page `RpgGuide` shared by hub, map and battle. It reuses
`createGuideMemory`, `PagedGuide` and `RpgModalFocus`; `PagedGuide` starts on the contextual page on its first paint.
Its read-only DEV hub proof never opens account storage. D257 moves physical-iPhone and real-account gameplay checks
after the owner-authorized production release. They stay explicitly open in the
[release acceptance record](../research/rpg-release-acceptance.md), not claims made by a synthetic proof.
The outfit profile allows free class/weapon correction only at Tier 1, RPG Lv1 (D259), using the same acknowledged
safe-checkpoint `edit-outfit` transaction as tree setup; it preserves partial EXP and never re-enrolls an outfit.

T105's one-time Inspiration advance (D256) is account-wide, outside all run ports. Existing scenario units receive
shared slot/gold access and matching negative token debt; accepted RPG grants repay that scenario/family before
depositing into Items. Gross rewards, seeds, journals and combat remain unchanged. See
[advance rules](skills-and-inheritance.md#temporary-inspiration-advance-d256) and
[phone/retry proof](../research/inspiration-advance-phone-proof.md).

## 2. The run lifecycle

**Current global Puzzle contract (D287–D290):** [Uma Puzzles](uma-puzzles.md) is a free five-outfit campaign,
outside `MinigameHost`, like RPG/Farm. It reuses pure engines, seeded replay, the shared shell and guide standards;
its [own host/protocol](../technical/uma-puzzles-implementation.md) supplies local journals, exact-once economic
operations and explicit same-seed takeover. Home is its entry. Owner-export PAD-derived cutouts (D292) satisfy the same
private pack/atlas readiness gates as retained original placeholders (D289); missing content is never a gameplay fallback.

Protected save16 preservation keeps levels/builds, freezes old material debt, converts unapplied EXP once and
retires Spark after active receipts. Settings/Hub download the preparing device's private whole-account backup.
CL spending is shared by Profile/Training/Constellation; Inspiration/Extra stats remain independent. Friendship still
uses `MinigameHost` for global stars. Historical Spark reducers/journals/refund dispatch remain, not new-run entry.
See [release evidence and owner checks](../research/uma-puzzles-release-acceptance.md).

The lifecycle below applies to **Friendship and historical Spark**, not Puzzle's independent protocol.

Every minigame follows the same six steps, through `MinigameHost` (`apps/web/src/game/minigame-host.ts`) and the
device-local `minigameRuns` table (`apps/web/src/game/db.ts`):

| Step | What happens | Where |
|---|---|---|
| **Reserve** | `beginRun(kind, target)` re-reads the save, refuses a target that cannot play, spends the tickets, writes the ledger row and creates the run row with its stable seed, all in one transaction. An open run for the same target is returned instead, never charged twice. | `minigame-runs.ts` |
| **Freeze** | The run's inputs are frozen on the row at reservation: Friendship Training's setup (D168), Spark's encounter snapshot (D171). Later edits to the save or a content update never change an open run. | run row |
| **Play** | Each player choice is an **action** appended to the row's journal under the expected prior action count, in one transaction, so two stale screens cannot both advance a run. The engine validates an action before it is stored. | journal port |
| **Resume** | Reopening the route finds the open run (`findOpenRun`) and replays its frozen inputs and actions to the exact same state. Leaving never discards, commits, refunds or rerolls. | screen |
| **Finish** | At a terminal state the screen calls `commitRun(runId, claim)`. The host **replays the stored journal** and computes the reward itself; the screen's claim only names what it expects (an action count, a state hash). Commit is idempotent by `runId`. | host |
| **Result** | The screen shows what was earned, by real names (nodes opened, stars gained), and offers Done (back to the caller) and Again (a fresh reservation, only once the first reward is saved). | screen |

Also part of the contract:

- **Give up** (where a game allows it) is an action that ends the run as a loss; it keeps the ticket spent.
- **Retiring a minigame** closes its open runs at startup with the ticket refunded under the `minigame-refund` ledger
  reason (D177). Completed rows stay as history and never replay or pay again.
- **The journal never syncs.** Runs are device-local; only the committed result (Training EXP, stars, ledger) enters the
  synced save. A run in progress stays on its device, and removing the app loses it with its spent ticket. A reinstalled
  or second device numbers its next attempt after every attempt the synced ledger remembers, since a run's id is its
  target and attempt number.
- **Bounds everywhere:** a journal holds at most 64 actions; every array and string in an action or snapshot has an
  explicit limit; a malformed row is a visible, recoverable error, never deleted or refunded silently.

Every row carries the same engine-tagged snapshot union and `ReplayJournalV1`. The journal port exposes only
`load(runId)` and compare-and-`append(runId, expectedActionCount, action)`; it dispatches parsing, replay, terminal checks
and state hashing through the registered engine adapter. Dexie v12 migrated open Friendship Training and Spark rows to
that shape without changing run identity or replay state. Completed rows remain verbatim history, and malformed or
future-engine rows stay on the device with a visible recovery error.

## 3. Determinism

A run's state is a pure function: `state = replay(frozenInputs, seed, actions)`.

- No `Math.random`, no wall clock, no DOM, PixiJS or React in rules code. Randomness comes from named streams derived
  from the run seed (Spark's `sparkSeed(seed, stream)`, Friendship Training's setup streams), so adding a stream never
  shifts another.
- Timers that matter (Spark's movement clock) are recorded in the action and clamped by the engine; presentation timing
  never changes a result.
- Art, names and other display joins are presentation only. A cast drawn from the catalogue for looks (Spark's orb faces)
  never feeds the engine.
- Every action and snapshot has a parser that returns `null` on anything malformed; the engine throws a typed error on an
  illegal action. Replaying the same inputs twice gives the same state and hash, byte for byte after a JSON round trip.

## 4. Engine module shape

Minigame rules live in **`packages/domain/src/minigames/<id>/`** (D185), like every other pure rule; the web app keeps
presentation, the journal and the screen. Imports from React, PixiJS, Dexie and browser globals are regression-tested out
of this tree.

- `types.ts` — actions, frozen inputs, state and outcome, with their parsers and bounds.
- `rules.ts` — tuning constants, named and exported, pinned in `packages/domain/src/domain.test.ts` beside their design
  doc numbers (AGENTS.md: change doc and test together).
- The reducer (`apply(state, action)`) and `replay(...)`, plus a canonical `stateHash` for claims and diagnostics.
- A **bot** for simulations, which plays through the public API only.
- Tests: rules, replay equality, bounds and parser rejection, and a fixture that pins a seed and actions to a final state.
- A **sim script** `scripts/sim/<id>-balance.ts` and `pnpm sim:<id>` with a regression envelope that fails when a change
  moves clear rates or rewards outside it. Balance targets live in the design doc and the decision that set them.

## 5. Content

- Anything from the original game (names, art, rosters) is **private content**: authored under the gitignored
  `content/overrides/`, turned into a hashed pack by `pnpm data:import`, published by `pnpm content:publish`
  ([Infrastructure](../technical/infrastructure.md#release-runbook)). Checked-in fixtures are small and synthetic.
- A pack is validated at import (ids exist, no impossible encounters); a production publish refuses an incomplete pack.
- Missing packs fail visibly. Historical Spark has an explicitly permitted deterministic roster fallback and
  diagnostic; Puzzles and RPG require verified retained packs and never invent a rewarded fallback.

## 6. The screen

- **Route and entry:** a lazy route under `/minigames/<id>/…`. It takes a validated `return` path (`safeReturnPath` in
  `game/bond-links.ts`) and every way out returns there. It never adds a tab.
- **Budget:** the main bundle stays at or under 180 KB gzip; the minigame is its own chunk, and PixiJS is loaded only by
  the route that draws with it.
- **DOM or PixiJS:** DOM and CSS for cards, lists and choices (Friendship Training); PixiJS 8 for a board with many moving
  sprites and continuous drag (Spark). With PixiJS, React owns the HUD, navigation and text, and the canvas owns only the
  board, one pointer and its effects; React state never updates on every pointer move.
- **Layout at 390 × 844,** top to bottom:
  1. **Header:** back (returns to the caller), the game's eyebrow and the subject's name, a How to play control, and the
     run's one headline number (fans, wave `2/3`).
  2. **Progress:** where the run is, in words and in a track (Friendship Training's season track, Spark's wave, Drive and
     Resolve gauges). The player can always tell what comes next.
  3. **Stage:** the board or scene. It fills the space while the player is acting and shrinks to a strip between choices.
  4. **Thumb zone:** the primary action and its siblings, at least 44 pt, above the home indicator.
- **During play the page never scrolls.** Safe areas are padded by the shell, once; a view never pads them again.
  A phase taller than the phone (Friendship Training's shop) scrolls inside the stage region under the progress track,
  with its primary action pinned to the region's bottom, so it is always in reach.
- **Reduced motion** keeps every state change visible and removes travel and particles. Every animation uses elapsed
  time; results never depend on the refresh rate. A hidden page pauses its ticker.
- **Input is locked** while an action is being saved or a commit is pending. A save conflict or error reloads the run from
  its journal and says the run was restored; if restore itself fails, the screen keeps explicit Retry and Return actions.
- **Background and resume:** leaving mid-gesture cancels the gesture with no action; returning reloads the row before
  input is enabled.
- **Pointer and orientation safety:** a pointer-driven game names that limitation honestly, announces resolved actions
  through one DOM live region, cancels an in-flight gesture on viewport changes, and uses a continue-safe portrait prompt
  rather than attempting unsupported landscape play.

## 7. Visual identity

Minigames are full-screen **stage** scenes: the dark end of the Paddock palette
([Visual system](visual-system.md)), so they read as a place apart from the light album screens.

| Element | Use |
|---|---|
| Surfaces | `bg-stage`, raised panels `bg-stage-soft` with `border-hairline-dark`, text `text-ink-on-dark` / `-soft` |
| Primary action | the accent gold (`Button` primary, or `bg-accent text-ink`), one per zone |
| Numbers | `font-display`, `numeral-on-dark`, `tabular-nums`; `CountUp` for a score landing |
| Stats and card types | `ui/TypeIcon`, the one set in the original's style and colours (D183); the `--stat-*` tokens for their meters |
| Strategies | `Strategy{Front,Pace,Late,End}Icon` with their strategy colour, always with a glyph or text, never colour alone. Spark uses cool silver-gray for End so Recovery is the only green board kind. |
| Skills | `ui/SkillIcon` (the original's skill icons, private) and `SkillKindBadge` |
| Tickets | `formatTickets` and the ticket icon: **Begin · 1 ticket**, **Train again · 1 ticket** |
| Stars | `Stars`, and `GainedStars` for a result |
| Friendship | `HeartIcon` |
| Characters | an Uma's standing chibi, else her race face, else her icon; a card's character that is not an Uma shows the card's icon (D183); a labelled silhouette last. Art loads through `useArt`/`useArtSet`/`useCardArt`, which hold what they show so the art cache never revokes an image on screen (D183) |

Copy is short and plain, leads with the number, and names things by their real names: the card, the facility, the node
that opened. Buttons say what they do and what they cost.

## 8. The guide

Every minigame has an illustrated **How to play** built on `ui/PagedGuide` (D184): full screen, one page at a time, swipe
or Back/Next, safe-area controls, reduced motion.

- It opens by itself **once per device, before any ticket can be spent**, and is always reachable from the start screen
  and from the run (header or menu), opening **at the page that fits the moment** (`startAt`).
- Pages are illustrated with the game's real components or synthetic stand-ins, never a live run, and never call
  `beginRun`.
- **Numbers come from the rules module**, not copy, so tuning never leaves the guide stale; a test checks it.
- Each game marks what is special about this run (Friendship Training marks the scenario's twist).
- The "seen" flag is device-local `localStorage` behind try/catch; the page works when storage is unavailable.

## 9. Shared pieces

| Piece | Where | For |
|---|---|---|
| `MinigameHost`, `MinigameHostTestDouble` | `game/minigame-host.ts` | reserve, commit, resume; screens test against the double |
| Journal port | `game/minigame-journal.ts` | engine-agnostic load and compare-and-append actions |
| `PagedGuide` | `ui/PagedGuide.tsx` | the guide shell |
| `MinigameShell`, `MinigameHeader` | `ui/minigames/` | the full-screen stage, safe-area frame and common header |
| `MinigameStart`, `MinigameResult` | `ui/minigames/` | free preview, ticket reservation, saved outcome and retry actions |
| `MinigameGauge` | `ui/minigames/` | labelled, accessible token-colour meter |
| `createGuideMemory` | `ui/minigames/guide-memory.ts` | resilient once-per-device guide memory |
| `TypeIcon`, `SkillIcon`, `SkillKindBadge` | `ui/` | stats, card types, skills |
| `Button`, `BottomSheet`, `Meter`, `Stars`, `CountUp` | `ui/` | controls, sheets (menu, give up, card details), gauges, stars, scores |
| `GainedStars`, `CardArt`, `useCardArt` | `screens/minigames/` | results and card faces |
| `useArt`, `useArtSet` | `ui/album/useArt.ts` | private art that stays while shown |
| `formatTickets` | `ui/tickets.ts` | every ticket price |
| `safeReturnPath`, `friendshipTrainingHref` | `game/bond-links.ts` | entry links and the way back |
| Spark presentation | `ui/minigames/spark-rival-presentation.ts` | orb faces, glyphs and presentation constants |
| Grid cell geometry | `scenes/puzzle-input/geometry.ts` | finite bounds/coordinate mapping shared by Spark and Puzzles; each keeps its own traversal/controller |
| Puzzle battle stage | `screens/puzzles/PuzzleBattleStage.tsx`, `scenes/puzzles/` | real fights and isolated practice share the DOM HUD and lazy Pixi input/effects, never the account reward path |

## 10. Adding a minigame

1. **Design first.** Add its rules to [Minigames](minigames.md): what it raises, cost, the board or loop, win and loss,
   reward formula with draft numbers, what the player sees before committing, and what it never does. Log the decision.
   Resolve open questions or record them in [Open questions](../open-questions.md).
2. **Tasks.** Split it the M022 way: engine (and sim), content, runtime and screen, polish. One spec per task in
   `docs/tasks/`, each with acceptance criteria.
3. **Engine** in `packages/domain/src/minigames/<id>/` (section 4), with its sim and regression gate.
4. **Content** through the private pipeline, with synthetic fixtures and visible unavailability (section 5).
5. **Host and journal:** add its `RunTarget`/`RunOutcome` kinds, reservation checks, frozen inputs and an authoritative
   commit that replays the journal (section 2). Test reserve, resume, conflict, commit, retry and rollback against Dexie.
6. **Screen and guide** with the kit's shell, layout and identity (sections 6–8). Verify at 390 × 844 and 375 × 667 in the
   preview, then on the owner's iPhone for touch, gestures and frame pacing.
7. **Entry points** from wherever the player decides to play, each passing its `return` path.
8. **Docs:** this page's table, the design doc, the decision, and `docs/tasks/README.md`.
