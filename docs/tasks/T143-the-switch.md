# T143 — The switch

**M034 · the switch: needs T134–T142 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md), whose "Fixed choices" bind this task. It closes
  the milestone's cross-task acceptance #2, #5 and #6.
- [rework/13](../rework/13-removals-and-plan-changes.md) in full: §1 what leaves, §3, §6 the save, §7 the docs, §9 done
  when. [rearchitecture/06](../rearchitecture/06-rpg-decommission.md) §2–§4 and §6; [01](../rearchitecture/01-target-architecture.md)
  §2–§4 (the final layout, subpath exports, the web shape); [07](../rearchitecture/07-data-reset.md) §2 and §7;
  [rework/11](../rework/11-hub-and-places.md) §7.2 (the redirects ship here) and §14.
- T137's route table and router test, T136's boot, and every place task's folder under `apps/web/src/g2/`.

## Goal and fixed scope

One change on `cutover/g2` that makes generation 2 the app and leaves nothing of today's game:
1. Tag `pre-split`.
2. The new app becomes the web entry, the API mounts the generation-2 save module, and the redirects go live.
3. Every retired system's code, routes, endpoints, tables, scripts, packs and docs is deleted (13 §1, §7; 06 §3).
4. `g2/`, `save-g2` and the rework modules move to their final homes (01 §2–§4).
5. The docs are rewritten as built.

- **Whole deletion** (D322's standard): no flag, dormant code, compatibility reader or migration stays.
- **What stays:** `packages/race`, `scenes/race/` and PixiJS for the race scene only (M034), auth, Hosting, Cloud Run,
  and the content pipeline and private packs minus the retired kinds, until phase 5.
- **`POST /api/legacy/purge` ships in this release.** T144's follow-up release removes it.
- **Nothing deploys:** `main` gets only the tag until T144 merges.

## Implementation contract

### 1. The tag

Claude tags `main` before the change starts. From then on `main` takes nothing but a fix that blocks play, which is
merged into `cutover/g2` as well. The tag never moves; T144's rollback reverts the merge and doesn't depend on it.

```bash
git fetch origin
git tag -a pre-split origin/main -m "Today's game before the generation-2 cutover (M034, D322)"
git push origin pre-split
```

### 2. Final homes

Today's `app/`, `screens/` and `game/` and the unused `ui/` files are deleted first (§3), then each piece moves with
`git mv`, so history follows:

| From | To |
|---|---|
| `apps/web/src/g2/app/` | `apps/web/src/app/`, beside today's kept `UpdateNotice.tsx`, `register-updates.ts`, `update-lifecycle.ts` and `build.ts` |
| `apps/web/src/g2/hub/`, `g2/places/`, `g2/save/`, `g2/ui/` | `hub/`, `places/`, `save/`, `ui/` (beside today's kept components) |
| Today's modules a place still imports (`screens/race/RaceFeed.tsx`, `labels.ts`, `game/race-fit.ts`, `game/race-facts.ts` …) | That place's folder, or `ui/` when two places share one |
| `apps/api/src/save-g2/` | `apps/api/src/save/`, after today's is deleted |
| `packages/domain/src/save-g2/` | `src/save/` → `@racer/domain/save` |
| `packages/domain/src/rework/types.ts`, `time.ts` | `src/state/` → `@racer/domain/state` |
| `src/rework/exchange/` | `src/economy/` → `@racer/domain/economy` (09 §10–§11) |
| `src/rework/constellation/` | `src/training/trees/`, exported through `@racer/domain/training` |
| Every other `src/rework/<area>/`: `tiers`, `items`, `work`, `farm`, `training`, `check-in`, `planner`, `sim`, `builds` | `src/<area>/` → `@racer/domain/<area>` |
| `src/__fixtures__/rework-*.ts`; `src/docs/rework.ts` | `src/__fixtures__/<area>.ts`; joined into `src/docs/render.ts`'s pages |

- `scenes/race/`, `auth/`, `content/` and `api/` stay where they are (01 §4.1).
- **Collisions go first:** today's `farm/`, `economy.ts` and `training.ts` are deleted before their names are reused.
  Today's `save.ts` keeps only the shapes kept rules import (`ScenarioJourney`, `ScenarioGoal`, `RacePreferences`,
  `SkillUnlock`, the `UmaSave` view `careerView` returns, `bestBaseDistance` …) and is renamed `career-shapes.ts`.
  `UMA_SHARDS_PER_COUPON` becomes `tiers/roster.ts`'s own `UMA_SHARDS_PER_TICKET = 5`: the same number, moved, with its
  pinning test.
- **`packages/domain/package.json` exports:** remove `./farm/kitchen`, `./puzzles/*`, `./puzzles-content-fixtures`,
  `./puzzles-preservation-fixtures`, `./rework/*` and `./save-g2`; add one entry per export above, each with the CJS
  `require` condition the API reads; keep `./hub`, while `./farm` now resolves to the moved rework Farm. Today's kept
  modules stay in the core `@racer/domain`.

### 3. Delete

Each path goes with its tests and fixtures. Where a kept module still imports a listed file, the piece it uses moves to
the module that owns that rule now, or the use goes with the retired system; `pnpm lint` names every such import.

| Where | What |
|---|---|
| `packages/domain/src` | `rpg/`; `minigames/`; today's `farm/`; `spark-rival.ts`, `spark-rival-content.test.ts`; `training.ts`, `training-level-up.ts`; `card-progression.ts`; `inspiration-bank.ts`, `inspiration-exchange.ts` (Convert goes with the tokens, 13 §3); `extra-stats.ts`; `economy.ts`; `inventory-ledger.ts`, `item-ids.ts`; `preset-carry.ts` (D288); `scenario-promotion.ts`; `collection.ts` once `nextUmaShardExchangeSequence` moves to `tiers/roster.ts`; the `generation` option T141 added and today's badge catalogue behind it |
| Kept domain modules, trimmed | `index.ts` re-exports nothing deleted; `cards.ts` loses stars; `derived.ts` keeps only what the rework imports (`ownSkillIds`); `inspiration.ts` keeps D250's pick rules (slots, gold keys, parents) and loses tokens, grants and the RPG budgets; `content.ts` loses the RPG, Puzzle and Spark pack parsers |
| `apps/web/src` | `game/` and `screens/` whole, after §2's moves; today's `app/AppShell.tsx`, `TabBar.tsx`, `TopBar.tsx`, `router.tsx`, `farm-proof-routes.ts`, `puzzle-proof-routes.ts`; `scenes/puzzles/`, `scenes/puzzle-input/`, `scenes/spark-rival/`; `content/puzzles/`, `content/rpg.ts`, `rpg-release.ts`, `rpg-manifest.ts`; `ui/rpg/`, `ui/puzzles/`, `ui/minigames/`, today's `ui/farm/`, `InspirationBankPanel`, `InspirationTokenIcon`, `ConstellationTicketIcon`, `ConstellationMaterials`, `PresetLoadButton`, `ScenarioSwitch`, `Stars`, `tickets.ts`; then every file check 5's reach check lists |
| `apps/web/src/api/client.ts`, `content/runtime.ts` | `rpgCommand` and the Puzzle, Farm-prepare and Inspiration-advance calls; the `priconne` art kind and the Spark rival and Puzzle packs |
| `apps/api/src/save/` (today's, whole) | `save.types.ts`, `rpg-*`, `puzzle*`, `farm*`, `inspiration-advance.ts`, the old repositories and controller: `/api/rpg/command`, `/api/inspiration/advance`, `/api/puzzles/{prepare,takeover,legacy-spark}`, `/api/farm/prepare`, protocol 1 and `players/{uid}` |
| `scripts/data` | `src/rpg.ts`, `rpg-cli.ts`, `__fixtures__/rpg.ts`, `src/puzzles.ts`, `puzzles-cli.ts`, `normalize/spark-rivals.ts`; `pack.ts`'s rule that keeps `data/rpg-*` and `data/puzzles-*`; `publish.ts`'s RPG and Puzzle validation and its "exactly one Spark rival pack"; `import.ts`'s Spark step; the `rpg:*` and `puzzles:*` scripts; README sections |
| `scripts/assets` | `src/priconne*.ts`, `puzzles*.ts`, `puzzle-placeholder*.ts`; the `rpg:import` and `puzzles:*` scripts; README sections |
| `scripts/sim` | `rpg-campaign.ts`, `puzzles*.ts`, `puzzle-preservation.ts`, `spark-balance.ts`, `training-balance.ts` (Friendship), `farm-progression.ts`, `farm-kitchen.ts`, `farm-kitchen-stats.ts`, and today's `constellation-balance.ts` and `career-balance.ts` |
| Root `package.json` | `data:rpg:*`, `assets:rpg:import`, `assets:puzzles:*`, `data:puzzles:*`, `sim:constellation`, `sim:careers` (today's), `sim:training`, `sim:spark`, `sim:farm`, `sim:farm:*`, `sim:rpg:campaign`, `sim:puzzles`, `sim:puzzles:preservation`. `sim:rework-builds` and `sim:rework-careers` become `sim:builds` and `sim:careers` (scripts `builds.ts`, `careers.ts`) |
| `docs/design` | `uma-puzzles`, `minigames`, `minigame-kit`, `farm`, `farm-kitchen-rework`, `uma-rpg`, `uma-rpg-classes`; and `training`, `constellations`, `uma-progression`, `support-cards`, `collection`, `economy`, `scenarios`, whose as-built pages are the moved rework pages (below) |
| `docs/technical` | `uma-puzzles-implementation`, `puzzle-content`, `uma-rpg-implementation`, `rpg-chapter-content`, `farm-kitchen-implementation`, and `architecture` (folded into `docs/game/architecture.md`) |
| `docs/research`, `docs/proofs`, `docs/qa` | `puzzle-*`, `uma-puzzles-*`, `rpg-*`, `uma-rpg.md`, `spark-rival-circuit.md`, `farm-kitchen-*`, `global-card-stars-phone-proof.md`, `inspiration-advance-phone-proof.md`, `roguelite-card-minigame.md`, their folders, `images/rpg-*`, `screenshots/{rpg-release,global-card-stars,inspiration-advance}/`; `proofs/T071-*`; `qa/t086-*`; the rows that list them |

### 4. Wiring

| File | Edit |
|---|---|
| `apps/web/src/main.tsx` | Mounts T137's root with T136's boot (the first-boot wipe and purge call); registers updates as today |
| `apps/web/src/app/router.tsx` (T137's) | The live router: 11 §7.1's routes and every 11 §7.2 redirect; deleted paths and unknown paths go to `/` |
| `apps/web/src/content/runtime.ts` | Reads the files whose kind it knows and ignores the rest, so the manifest published before T144 republishes stays readable |
| `apps/api/src/app.module.ts`; `apps/api/.env.example` | Imports the generation-2 `SaveModule`; `LOCAL_SAVE_FILE=.data/save-g2.json` (07 §2) |
| `packages/domain/src/index.ts`, `package.json` | §2's exports; no RPG, minigame or Spark re-export |
| `.github/workflows/deploy.yml`, `firebase.json`, `apps/api/Dockerfile` | Unchanged: health 200 and save 401 hold on generation 2 |

### 5. Docs, as built

- **Rework pages 01–09, 11 and 12 move into the manual** (`git mv docs/rework/NN-name.md docs/game/`), live blocks and
  all; their banners say "as built". A section about a later phase stays in its page under a "Not built yet (phase N)"
  heading: 02 §7 (push, phase 4), 04 §10's Hall of Fame place, 11 §10.3 and §11's phase-6 and phase-7 rows.
- **`docs/rework/` keeps** 10 (Expeditions, phase 9), 13 (the plan) and its README, which becomes an index into the manual.
- **The manual:** `docs/game/README.md` (topics, the "Not built yet" rule), `architecture.md` (generation 2: the save,
  sync v2's one lane, the routes, the purge endpoint for one release), `racing.md` and `scenarios.md` rewritten for
  generation 2 and cut to links where a moved page covers them.
- **`docs/design/`:** `00-overview.md` and `ux.md` rewritten (ux from 11's shell and 02 §9's plain words); `racing.md`,
  `badges.md`, `scenario-goals.md` and `skills-and-inheritance.md` edited (no Training Tickets, tokens, advance, stars
  or minigames). [rearchitecture/04](../rearchitecture/04-hub.md) and [05](../rearchitecture/05-farm.md) are marked
  superseded (13 §7).
- **`README.md`, `AGENTS.md`** (read list without the minigame kit, layout, commands), **`CLAUDE.md`** (layout,
  commands), `docs/technical/infrastructure.md` (the dev save), `docs/open-questions.md` and `docs/tasks/README.md`.
- Every link and code comment pointing at a moved or deleted page is updated, except in `docs/decisions.md`.

## Checks

1. `NODE_AUTH_TOKEN=$(gh auth token) pnpm install --frozen-lockfile && pnpm lint && pnpm test:ci && pnpm build`, the
   startup size check included (M034 #5).
2. **Nothing old remains** (M034 #2, 13 §9, 06 §6). This prints nothing:
   ```bash
   git grep -n -i -E "puzzle|friendship|constellation level|training ticket|card coupon|inspiration token|rpg|priconne|spark rival" \
     -- apps packages scripts | grep -v -E "racing RPG|uma-rpg|friendshipBonus"
   ```
3. **PixiJS for the race only.** `git grep -l "from 'pixi.js'" -- apps packages` lists only `apps/web/src/scenes/race/`.
4. **The moves are complete.** This prints nothing, and `apps/web/src/g2`, `apps/api/src/save-g2` and
   `packages/domain/src/rework` don't exist:
   ```bash
   git grep -n -E "@racer/domain/(rework|save-g2)|from '[^']*(/rework/|/g2/|save-g2)|docs/rework/(0[1-9]|11|12)-" -- apps packages scripts
   ```
5. **Nothing unreachable in the web app** (no new dependency). From `apps/web`, this prints nothing:
   ```bash
   REACH=$(mktemp)
   printf '{"extends":"./tsconfig.json","include":[],"files":["src/main.tsx","src/vite-env.d.ts"]}' > tsconfig.reach.json
   pnpm exec tsc -p tsconfig.reach.json --listFilesOnly | sed -n "s|^$PWD/||p" | sort > "$REACH"; rm tsconfig.reach.json
   git ls-files 'src/*.ts' 'src/*.tsx' | grep -v -E '\.test\.tsx?$|/__fixtures__/|\.d\.ts$' | sort | comm -23 - "$REACH"
   ```
   The same check runs on `packages/domain` with `files` set to every export entry of its `package.json`.
6. **Redirects.** T137's router test walks 11 §7.2's table against the live router (11 §14).
7. **Docs.** The docs check passes on the moved pages, and this prints nothing:
   ```bash
   git grep -n -E "\]\([^)]*(rework/(0[1-9]|11|12)-|design/(uma-puzzles|minigames|minigame-kit|farm|farm-kitchen-rework|uma-rpg|uma-rpg-classes|training|constellations|uma-progression|support-cards|collection|economy|scenarios)\.md|technical/(uma-puzzles-implementation|puzzle-content|uma-rpg-implementation|rpg-chapter-content|farm-kitchen-implementation|architecture)\.md)" \
     -- docs README.md AGENTS.md CLAUDE.md ':!docs/decisions.md'
   ```
8. **A boot.** `pnpm dev`, a fresh origin: the app opens on the Stable's Locked tab with 20 Uma Tickets, and every
   place opens from the ☰ menu. T144 rehearses the rest.

## Acceptance

- Checks 1–8 pass on `cutover/g2`'s head, in CI and locally.
- M034 #2, #5 and #6 hold; 13 §9's first two items hold (its `pixi.js` item is phase 8's, M034); 06 §6's code items
  hold; 07 §7's last item holds: no save migrations in the domain, one Dexie version in the web app.
- Today's routes redirect per 11 §7.2, and the API answers only `/api/health`, `/api/save`, `/api/sync`,
  `/api/legacy/purge` and `/api/content/*`.
- One decision records the choices below; this spec is deleted (D104).

## Build-beside scaffolding to remove

The dev mount and checks that only existed while `g2/` was built beside today's app (T137): `apps/web/g2.html`, the
serve-only `/dev/g2/*` Vite rewrite, the `--mode g2-size` measure-only build and its script, the `dist-g2` ignore entry,
and the import-allowlist test's "today's app" half. The `dev-grant` operation stays, refused unless `DEV_OPERATIONS=true`.

## Out of scope

The deploy, the wipe, the purge's verification and the bucket cleanup (T144); removing the purge endpoint (T144's
follow-up); removing the redirects and the first-boot wipe (the next phase that ships); 01 §3's `racing`, `cards` and
`badges` subpaths and the master-data adapter (phase 5); any rule change.

## Decided here

| Choice | Why |
|---|---|
| The rework areas drop the `rework/` segment; `exchange` becomes `economy`, `constellation` goes under `training/trees`, the shared state under `state` | One rule for every area; 09 §10–§11 names `economy`; root `constellation.ts` stays, so its name can't be a folder |
| Today's kept modules stay in the core export; 01 §3's `racing`, `cards` and `badges` subpaths wait for phase 5 | M034 asks for the rework's and the save's homes; phase 5 rewrites `content.ts` and its readers anyway |
| Today's `save.ts` is cut to the shapes kept rules read and renamed `career-shapes.ts` | `@racer/domain/save` is generation 2's (01 §3); careers and badges still read journey shapes |
| Reachability is checked with `tsc --listFilesOnly` from the entry | A whole deletion with no new dependency; lazy imports count |
| The gate allows "racing RPG", `uma-rpg` and `friendshipBonus` | The app's description (06 §3); the sibling game the rework ports from; the original's Friendship Bonus card effect in the private packs, which stay until phase 5 |
| Rework pages move into `docs/game/`; the design pages they replace are deleted, not rewritten | M034 #6 moves them; rewriting 13 §7's pages as well would describe each rule twice |
| Later-phase sections stay in their page under "Not built yet (phase N)"; 10 and 13 stay in `docs/rework/` | The manual describes what runs; splitting pages would break every link |
| The tag is pushed before the change and never moves; `main` freezes except for blocking fixes | 06 §2 and 07 §6: the tag marks today's game; T144's rollback reverts the merge, not the tag |
| Sims are renamed `sim:builds` and `sim:careers`; today's pair goes | The `rework` prefix leaves with `rework/`; game/architecture.md says the rework pair replaces today's in phase 3 |
| The content runtime ignores manifest files it has no kind for | The old manifest stays readable until T144 publishes the new one |
| The redirects and T136's first-boot wipe leave with the next phase that ships, phase 4 or the next one | 11 §7.2 ties them to phase 4, which only ships if the owner asks (D336) |
| The session boots the device save once the private content is ready (operations need its env). Before the save opens, a signed-out phone or content that can't load gets one full-screen panel in the content diagnostics' words and action; once it has opened, signing out keeps play going with sync paused | A cold boot without content can't run a rule; T136's chip already says "Sync paused: sign in", so an open save keeps the owner's taps rather than clearing them |
| Account's last row is Sign in while sync is paused and Sign out otherwise, both the auth provider's; with auth off (dev) neither is offered and the phone acts signed in | T138's row had only Sign out; a phone signed out mid-session needs its way back |
| One `idToken()` in `auth/firebase.ts` feeds the content client and `setSaveTokenProvider`; `signIn` and `signOut` move beside it. `api/client.ts` keeps only the content client | One token source, and the save's client stays in its lazy chunk (startup 143.24 KB gzip) |
| Every tap and device write holds the update prompt's restart until it commits (`criticalGameplayAction` around the port's `run` and `writeDevice`) | The installed app defers a restart across gameplay commits, as today's actions did (CLAUDE.md) |
| The seeds stay a dev tool at `/dev/seeds/*`: `main.tsx` loads `dev/main.tsx` behind `import.meta.env.DEV`, which serves the live routes under that basename over the in-memory port (`?seed=`, `?at=`, `?save=device`); the dev proofs stay `DEV_ROUTES` (`/dev/seeds/dev/check-in`). Production answers `/dev/seeds` as an unknown path, and `check-size.mjs` refuses a build holding any `src/dev/` module | Every place link is absolute, so the seeds need a basename rather than a nested route; 11 §7.2's rule keeps proofs under `/dev/` and dev-only; the size check proves the bundle on every build |
| The content runtime keeps its last manifest under `uma-racer:g2:content-manifest`, and the service worker caches content files as `uma-racer-g2-content` | The first-boot wipe runs after the content loads (the save needs it); under the old names it would delete the manifest and files the app had just fetched, and the next offline boot would fail. 01 §4.2 prefixes every key with `uma-racer:g2:` |
| The wipe finds the old dev proof databases by their shared shape, `<name>-proof-*` | The same databases, dev builds only, without naming a retired mode in code (check 2) |
| `g2/dev/` → `dev/`, `g2/g2.css` and its test → `app/`; test support moves under `__fixtures__/` (`src/__fixtures__/testing*.ts(x)`, `save/__fixtures__/server.ts`, `places/{farm,training}/__fixtures__/`). The `G2`/`g2` names stay in identifiers, CSS classes, `data-g2` attributes and storage keys | §2 names only `app`, `hub`, `places`, `save` and `ui`; check 5 reads `__fixtures__/` as test code; renaming every identifier changes no behaviour, and the keys and database must keep their names |
| Today's race plan, fit and facts, goals, flair, badge-collection and trainer views and badge frame move to `places/racing/`; the album query (with `AlbumPreset`) to `ui/album/`; the Root and Account read the build id through `app/build.ts` | §2: the place that uses a module, or `ui/` when two share it; Racing alone reads the views, the Stable, Card Library and Uma picker share the query; `build.ts` is one of §2's kept files |
| The boundaries test goes whole | Both halves guarded the line between `g2/` and today's app; with one app, check 5's reach and check 3 hold what remains |
| The icon set loses the five icons that drew only retired things (card coupons, coupons, Training Level, limit break, load from an earlier build); `g2/ui/icons`' four join the set's names and barrel. Generic icons no screen draws yet stay | Whole deletion for retired systems; the generic icons are the visual system's set |
| The API keeps today's Firestore codec (D151), moved into the save module with its tests; `app.module.test.ts` holds the API to its six routes | Generation 2's repository stores work rows through it; the acceptance names the only routes the API answers |
| `pnpm dev` and `pnpm api` start the API with `DEV_OPERATIONS=true` in its package scripts; `.env.example` documents it, commented out | The rehearsal's `dev-grant` works without a hand-edited `.env`; no deploy, Dockerfile or Cloud Run setting runs those scripts or sets the variable |
| A data import keeps only the atlases and art of the families `scripts/assets` builds; every other non-pack file leaves the manifest | T144 §6 needs a manifest with no priconne art or Puzzle atlases, and no importer would drop them any more; naming the kept families keeps retired names out of code |
| The sims' harness loses today's `buildStats` and the helpers only the deleted sims used | They read Training Levels, stars and today's Extra stats, which part B deletes |
| Check 2 also skips `apps/web/src/app/router.test.tsx` (`':!apps/web/src/app/router.test.tsx'` after `-- apps packages scripts`); it is the only allowance besides the three phrases | Check 6 walks 11 §7.2's deleted rows (`/rpg/*`, `/puzzles*`, `/minigames/friendship-training/*`) to `/`, so the test must name them; nothing reads or writes them |
| Beyond §3's list, part B deletes what only the retired systems read: today's owned-card deck (`support-deck.ts`), Training Levels and today's tree derivation in `constellation.ts`, the Training Ticket reward on race records (`ticketReward`, `UMA_LEVEL_TICKET_REWARD`), the pre-v13 level curve, `evaluateScenarioGoals` and `upgradeGoalPlan`, the badge facts of the minigame era (training turns, friendship counts, `trainingByTier`, a completion's Training Level), the Trainer's owned-card and coupon-ledger inputs, and the helpers only those read | Each served a retired system (13 §1) or the old save's migrations (07 §7); `settleGoalWin` is the goal rule, and generation 2 writes none of those facts |
| Today's rules the rework still reads or uses as its parity oracle stay in the core export until phase 5: the race EXP walk (`addUmaRaceExp`), the career planner, today's rivals (`sim:balance`, `sim:turns`) and the badge and race-record parsers | 01 §3's `racing`, `cards` and `badges` subpaths rewrite them; deleting an oracle would drop the parity it proves |
| `cardRaceBonus(template)` takes no stars and pays the full value, the old 3★ one; `starNodePct` stays only for the rivals' 84% card factor | D329 pays every card 100%, which the rework already passed as 3★, so no number moves; the rivals' factor is their build, not a star (D336) |
| The `UmaSave` view `careerView` returns loses Training Level, Extra stats and Inspiration from its units and presets; the Trainer's fingerprints hash that smaller view | Nothing kept reads them; generation 2 has no production rows yet, so no stored fingerprint changes meaning |
| `@racer/domain/state` is the only path to the shared shapes and the time factor: `tiers` stops re-exporting them, and the entry's pins move to `state/index.test.ts` | A second path to the same names is a compatibility re-export |
| The race catalogue fixture the Exchange tests read is `__fixtures__/economy.ts`; every other fixture takes its area's name | §2 names fixtures by area, and that catalogue serves `economy` |
| `src/docs/rework.ts` folds into `render.ts` as `AREA_BLOCKS` (its test becomes `render.test.ts`); the renderer still checks `docs/game` and `docs/rework` | Part C moves the pages and repoints the renderer; `pnpm docs:update` rewrites no page today |
| The domain's reach check (check 5) roots at every export entry plus `src/docs/render.ts` | The live-block renderer and each area's `docs.ts` run only under `pnpm docs:update` and the docs test, never from an export; rooting the renderer keeps them while still catching a dead file |
| Parity tests whose oracle was deleted (`settleGoalWin` against `evaluateScenarioGoals`, `handOverNodes` against `withCardSet`) state the expected values instead; `domain.test.ts` loses only the pins of deleted rules (Diligent's thresholds, the retired Trainer thresholds, stars, Training Levels, tickets, tokens, the Farm, Puzzles, RPG and Spark rival) | The rules keep their coverage without keeping the deleted code; no kept number's pin changed |
