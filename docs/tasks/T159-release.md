# T159 — The release: the docs as built, the new rules, and launch with the full wipe

> **M036, part 8 of 8.** Claude only: it deploys and wipes production. Starts when T152–T158 have merged into
> `restart/g3`. Decision **D388**.

## Why

The slice ships as one production release. The owner tests live, and there's no backup and no rollback (D380). Before
it ships:
- the manual must describe the game that runs;
- the agent guides must carry the restart's rules.

After it ships:
- generation 2 must be gone from the server;
- the owner restarts into the new game.

## Context

- [M036](M036-ura-finale-slice.md), "The release (T159)" and "Done when".
- [v3 §6](../research/drawing-board/README.md#6-engineering-rules-that-change): the engineering rules that change.
- `CLAUDE.md` (Production operations, the release runbook link), `AGENTS.md`, the root `README.md`, and
  [the release runbook](../technical/infrastructure.md#release-runbook).
- **The manual pages each part wrote:**
  - T153: 05 and 06;
  - T154: 01, 03, 04, 12 and racing;
  - T155: 07 and 08;
  - T156: 09;
  - T157: 02 and 11;
  - T158: 11's career screens.

## Do

1. **The docs pass:**
   - **`docs/game/README.md`:** the game in one page, linking every page.
   - **`architecture.md`:** the code as built:
     - the domain areas `account`, `build`, `career`, `stages`, `save`, `master`, `tiers` and `hub`, plus the kept race
       modules;
     - the web's `places`, `stages`, `race` and `hub`;
     - the API;
     - generation 3;
     - the sims (`sim:decks`, `sim:stages`, `sim:careers`, `sim:balance`) and the checks.
   - **The menu tree in 11** has every route, sheet and button.
   - **`docs/design/`:** rewrite `00-overview.md` for the new game. `ux.md`, `visual-system.md`, `racing.md` and
     `scenario-goals.md` stay current. `skills-and-inheritance.md` gets an archived banner.
   - **The links:** no live page links to a deleted one. Historical decision rows may.
2. **The rules:**
   - **`CLAUDE.md`:**
     - the opening paragraph (Race, Careers, Mini-games; generation 3);
     - Start here;
     - the layout table (areas, generation 3, no `uma-work`);
     - the commands (`pnpm dev` → `save-g3.json`; the new sims; no seeds);
     - "Working from a worktree": drop the dev-seed and screenshot-verification requirement, and say instead that
       **slices ship to production and the owner tests live; Claude still runs lint, tests, build, sims and the deploy
       smoke checks**;
     - the Phaser rule: **"Phaser only in `stages/*/scene`, lazy"**;
     - real card values in the private pack only;
     - no rollback path for the old game;
     - the live row updated at the end.
   - **`AGENTS.md`:**
     - the same commands and layout;
     - `restart/g3` is retired once merged;
     - packets for later releases go in `docs/tasks/`.
   - **The root `README.md`:** status and the documentation map.
3. **The gates on `restart/g3`:**
   - `pnpm lint`, `pnpm test:ci` and `pnpm build` (the budget);
   - `pnpm sim:stages`, `sim:decks` and `sim:careers`, run on the private pack locally too (aggregates only);
   - `pnpm docs:update` leaves no diff;
   - the docs link check passes;
   - a grep shows no clock in the game layer (`Date.now`, `setTimeout` and `setInterval` only in the sync lane, the UI
     and the scene, never in the rules).
4. **Ship:**
   1. Merge `restart/g3` into `main` (a merge commit) and push. Watch the deploy without piping the watch.
   2. Verify:
      - the new revision's image ends in the SHA;
      - `/api/health` 200 and `/api/save` 401 on the Cloud Run URL;
      - the shell is `no-cache`;
      - a live chunk listed in `sw.js` holds a generation-3 string (`uma-racer-g3`).
5. **The server wipe:**
   - With the scoped configuration (`CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer`), delete
     every document under Firestore's root `saves` collection: generation 2 and its markers, via a recursive delete.
   - Confirm it's empty.
   - No export is taken; the owner asked for none.
   - Leave the `g3` collection alone.
6. **Tell the owner:** "Update ready → Restart, then sign in". Their phone deletes its generation-2 database on that
   boot. Name what to try first: unlock Umas and cards, then start a URA Finale career.
7. **Close:**
   - D388: the release SHA, the revision, the wipe counts and the sims' aggregates.
   - Mark M036 completed in `docs/tasks/README.md`, and delete M036's spec and this file (D104).
   - Write the next free numbers.
   - Archive `restart/g3`, deleting the remote branch after merging.

## Done when

- [ ] Production runs the release (image SHA, a live generation-3 chunk), and the smoke checks pass.
- [ ] Firestore's `saves` is empty. `g3` holds only what the owner creates.
- [ ] The manual, CLAUDE.md, AGENTS.md and README describe the game and the rules as they are now.
- [ ] The owner has been told to restart, and what to try.

## Deliver

Claude merges and deploys directly; this part has no PR. The commit `docs: M036 released (D388)` closes it.
