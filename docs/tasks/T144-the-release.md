# T144 — The release

**M034 · last task: needs T143 · steps 1–9 done 2026-10-15; step 10 waits on the owner.**

> **As run (2026-10-15).** The owner said go. `cutover/g2` merged into `main` as `ec5b1bd` and deployed as
> racer-api-00188, and the content without the retired kinds published as `9ba4cdd37cca`. The owner's first boot
> purged `players/{uid}` (30 collections, 3,676 documents; the marker is at `saves/{uid}/meta/purge`, and `players/` is
> empty), and the retired bucket objects and local sources were deleted (none of step 1.6's `RETIRED` remain).
> **Step 10 is next:** it runs once the owner confirms in chat that the new account is theirs, and its release decision
> takes D362, reserved for it. Until then `POST /api/legacy/purge` and the boot's purge call stay.

Read:
- [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md) (production operations: gcloud scoping, deploy watching,
  smoke checks) and [M034](M034-generation-2-cutover.md), whose "Fixed choices" bind this task. It closes cross-task
  acceptance #1, #3 and #4 in production and confirms the rest there.
- [rearchitecture/07](../rearchitecture/07-data-reset.md) §3–§7, [06](../rearchitecture/06-rpg-decommission.md) §3
  "Data" and §6, [rework/13](../rework/13-removals-and-plan-changes.md) §5, §6 and §9, [11](../game/11-hub-and-places.md) §2.4.
- [Infrastructure](../technical/infrastructure.md) "CI/CD" and "Release runbook"; `.github/workflows/deploy.yml`.

This task is Claude's (CLAUDE.md: Claude deploys). Every gcloud command is prefixed with
`CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer`, and nothing runs `gcloud config set`. Every
read of production data is read-only and keeps no copy. The shell variables of one step carry into the later ones.

## Goal and fixed scope

Ship `cutover/g2` once: rehearse it all locally; get the owner's explicit "go" in chat; merge, deploy and verify; let
the owner's first boot wipe and purge; verify the purge; delete the retired content from the private bucket and the
owner's machine; and, in a follow-up release, remove the purge endpoint.

- **The wipe is irreversible, so nothing from step 3 on runs without the owner's "go"** (M034, D323). A rehearsal that
  finds a bug sends it back to its task on `cutover/g2`, and the rehearsal runs again.
- **`pre-split` keeps the code; nothing keeps the old save** (D323).
- **The owner restarts only when Claude says the deploy is verified.** Until a signed-in generation-2 app boots, no
  player data has been touched.

## Runbook

### 1. Rehearse (before asking)

A scratch worktree (`git worktree add --detach .claude/worktrees/g2-rehearsal pre-split`), its `apps/api/.data/` empty
and `apps/api/.env` from `.env.example` (auth off, local saves). `content/` is the owner's private folder: link it in
and never `git add` the link. No copy of any real save is used.

1. **Seed the old generation** on the origin the new app will boot on: `NODE_AUTH_TOKEN=$(gh auth token) pnpm install
   --frozen-lockfile && pnpm dev`; confirm port 5173 is this worktree's (`lsof -iTCP:5173 -sTCP:LISTEN`, then that PID's
   cwd); at `http://localhost:5173` run a race and a Farm job. That writes `uma-racer` (IndexedDB), `uma-racer:` keys,
   the `racer-content` cache and `local-dev`'s rows in `apps/api/.data/save.json`. Stop the server.
2. **Boot generation 2 on the same origin:**
   ```bash
   git switch --detach origin/cutover/g2 && NODE_AUTH_TOKEN=$(gh auth token) pnpm install --frozen-lockfile
   cp apps/api/.env.example apps/api/.env   # again: T143 points LOCAL_SAVE_FILE at .data/save-g2.json
   pnpm lint && pnpm test:ci && pnpm build && pnpm dev
   ```
   In the page (`indexedDB.databases()`, `Object.keys(localStorage)`, `caches.keys()`) and on disk: only `uma-racer-g2`,
   only `uma-racer:g2:` keys, no `racer-content`; `local-dev` gone from `.data/save.json`; its purge marker, with time
   and counts, in `.data/save-g2.json` (T135's local repository); the app on the Stable's Locked tab with 20 Uma Tickets
   (11 §2.4). A reload doesn't purge again, and a second `POST /api/legacy/purge` with `{"protocol":2,"generation":2}`
   returns the same marker at once.
3. **A stale device is refused** (07 §4). Both print 426, then `unchanged`:
   ```bash
   before=$(shasum apps/api/.data/save-g2.json)
   for body in '{"upserts":[],"appends":[]}' '{"protocol":1,"generation":1,"upserts":[],"appends":[]}'; do
     curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/api/sync -H 'content-type: application/json' -d "$body"
   done
   [ "$before" = "$(shasum apps/api/.data/save-g2.json)" ] && echo unchanged
   ```
4. **A fresh account through every place** (M034 #1): unlock Umas and watch the reveal; gather at a Farm site, craft at
   the Pantry, cook at the Kitchen; start an Observatory session with the dish and open the other facilities' sheets;
   race (purse bar, featured, a result with Racing EXP and Prize Money); buy a Speed Ticket and use it on a running job;
   sell from the Warehouse; open the Card Library; Collect all and Repeat from the pill; read the planner's Needs;
   advance one Uma through Account's `dev-grant` (dev builds and `DEV_OPERATIONS=true` only, T134, T138: a gate takes days for real), so the second device sees it too; every Trophy Hall scope,
   the Expedition placeholder and Account; every place from the ☰ menu. Everything survives a reload; with the API
   stopped, actions say "Saved on this phone" and sync once it restarts; the fresh origin `http://127.0.0.1:5173`, a
   second device, pulls the same save.
5. **Phone checks at 390×844** in the browser pane: every place's Page, the run and result, the Advance sheet, the
   check-in summary. No horizontal scroll, every target 44 pt or more, safe areas and both bars in place. With the
   owner at hand, the same on the iPhone over the LAN (infrastructure.md "Environments").
6. **Production before**, read-only, for the go message:
   ```bash
   TOKEN=$(CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud auth print-access-token)
   FS='https://firestore.googleapis.com/v1/projects/uma-racer/databases/(default)/documents'
   curl -s -H "Authorization: Bearer $TOKEN" "$FS/players?showMissing=true&pageSize=10" | grep '"name"'
   OWNER_UID=…   # the id after players/ in that name
   curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"pageSize":100}' \
     "$FS/players/$OWNER_UID:listCollectionIds"                     # the old kinds, about 31
   curl -s -H "Authorization: Bearer $TOKEN" "$FS/saves?showMissing=true&pageSize=10"   # empty
   RETIRED=('gs://uma-racer-content/data/rpg-*' 'gs://uma-racer-content/data/puzzles-*' 'gs://uma-racer-content/data/spark-rivals.*'
     'gs://uma-racer-content/atlases/puzzles-*' 'gs://uma-racer-content/art/priconne/**')
   CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud storage ls "${RETIRED[@]}" | wc -l
   ```

### 2. Ask for the go, and wait

Claude writes to the owner in chat what steps 1.1–1.5 showed, then each irreversible step in plain words: the merge
deploys the new game; at the app's next restart this phone's save and the server's old save (step 1.6's counts) are
wiped for good; afterwards the retired files are deleted from the bucket (the count) and from this machine (step 10's
list); `pre-split` keeps the code, not the data. It ends: "Reply go to start. Please don't restart the app until I say
the deploy is verified."

Only the owner's explicit "go" in chat starts step 3, and only on the day it is given; a "go" with exceptions skips
those steps. If the release can't finish that day, Claude asks again.

### 3. Merge and push

```bash
git fetch origin
git merge-base --is-ancestor origin/main origin/cutover/g2 && echo "cutover/g2 contains main"
gh run list -R luismlorenzana/uma-racer --branch cutover/g2 --limit 1 --json conclusion,headSha   # success, the head
git worktree add --detach .claude/worktrees/g2-release origin/main && cd .claude/worktrees/g2-release
git merge --no-ff origin/cutover/g2 -m "feat: generation 2, the new game (M034)"
NODE_AUTH_TOKEN=$(gh auth token) pnpm install --frozen-lockfile && pnpm lint && pnpm test:ci && pnpm build
git push origin HEAD:main
SHA=$(git rev-parse HEAD)
```
If the branch doesn't contain `main` or its CI isn't green, merge `main` into `cutover/g2`, let CI pass and repeat 1.2.

### 4. Watch the deploy

```bash
RUN=$(gh run list -R luismlorenzana/uma-racer --workflow deploy.yml --commit "$SHA" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" -R luismlorenzana/uma-racer --exit-status > /dev/null 2>&1; echo "exit=$?"
gh run view "$RUN" -R luismlorenzana/uma-racer --json conclusion,headSha,jobs --jq '{conclusion, headSha, jobs: [.jobs[] | {name, conclusion}]}'
```
Never pipe the watch. Done means exit 0, `conclusion` success, `headSha` = `$SHA`, and both jobs ("Test and build",
"Deploy API and web") success. The race engine test's known timeout on a slow runner gets one
`gh run rerun "$RUN" -R luismlorenzana/uma-racer --failed`; any other failure stops here (Rollback).

### 5. Verify production

```bash
CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud run services describe racer-api --region=us-central1 \
  --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image,status.url)'
API=…   # the URL just printed
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/health"   # 200
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/save"     # 401
curl -sI https://uma-racer.web.app/ | grep -i '^cache-control: no-cache'
for f in $(curl -s https://uma-racer.web.app/sw.js | grep -oE 'assets/[A-Za-z0-9._-]+\.js' | sort -u); do
  curl -s "https://uma-racer.web.app/$f" | grep -q 'uma-racer-g2' && echo "generation 2 in $f"
done
```
A new revision whose image ends in `:$SHA`; health and save on the Cloud Run URL (Hosting answers `/api/*` with the app
shell); the shell `no-cache`; at least one live chunk holding `uma-racer-g2`. Smoke checks pass on the previous release
too, so the revision and the chunk are what prove this one.

### 6. Publish the content without the retired kinds

From the release worktree with `content/` linked in and `content/overrides/flair.json` kept in place:
```bash
pnpm data:import && pnpm assets:import
pnpm content:publish -- --dry-run && pnpm content:publish
CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud storage cat gs://uma-racer-content/manifest.json \
  | grep -c -E '"(data/(rpg-|puzzles-|spark-rivals\.)|atlases/puzzles-|art/priconne/)'   # 0
```

### 7. The owner's first session

Claude tells the owner the deploy is verified. On the iPhone, the owner:
1. opens the Home Screen app, sees **Update ready — Restart** and taps Restart (it waits for anything committing);
2. lands on the Stable's Locked tab: "Uma Tickets 20 · 0/5", Prize Money 0, Speed Tickets 0, no Umas, and no screen
   asking to prepare, archive, recover or migrate anything (13 §5, 07 §7);
3. finds in Account the App build (`$SHA`'s first 12 characters) and the Content of step 6;
4. unlocks one Uma: the reveal plays, the tickets read 19, and she is the featured Uma;
5. sees every SSR open in the Card Library, with no stars or coupons, and every building at Lv 1 with its first slots;
6. races once: the result shows Racing EXP and a Prize Money line, and the account bar moves by that amount;
7. sees the Sync chip clear. Any second device, opened and restarted, lands on the same save.

### 8. Verify the purge (read-only)

With `TOKEN` read again as in 1.6 if it has expired:
```bash
curl -s -H "Authorization: Bearer $TOKEN" "$FS/players?showMissing=true&pageSize=10"     # no documents
for doc in "players/$OWNER_UID" "saves/$OWNER_UID"; do
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"pageSize":100}' "$FS/$doc:listCollectionIds"
done                                                                                     # none; then 13 §6's kinds and meta only
curl -s -H "Authorization: Bearer $TOKEN" "$FS/saves/$OWNER_UID/meta/purge"            # time and counts
CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="racer-api" AND httpRequest.requestUrl:"/api/"' \
  --freshness=3h --limit=200 --format='value(timestamp,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)'
```
The marker's counts match step 1.6. The log shows one purge doing the work, any later purge (a second device)
answering at once, the old app's syncs before the restart answered 426, and generation 2's 200s after.

### 9. Delete the retired content

Only after steps 6–8 pass, and with step 1.6's `RETIRED`:
```bash
LIST=$(mktemp)
CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud storage ls "${RETIRED[@]}" > "$LIST"
wc -l < "$LIST"   # the count the go message named
CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud storage rm --read-paths-from-stdin < "$LIST"
pnpm content:publish -- --dry-run   # 0 uploads: every file the live manifest names is still there
```
Then, from the owner's checkout (06 §3 "Owner's machine", 07 §2):
```bash
rm -f content/overrides/{rpg-chapters,rpg-source-evidence,puzzles-cast,puzzles-source-evidence,spark-rivals}.json apps/api/.data/save.json
rm -rf content/art/priconne scripts/assets/.cache/priconne scripts/assets/.cache/puzzles
```

### 10. The follow-up release

Once the owner confirms in chat that the new account is theirs, remove `POST /api/legacy/purge` and the boot's purge
call with their tests (07 §3, §6). The marker stays as a record; T136's local wipe stays until the redirects leave
(T143). Commit to `main`, run steps 4 and 5, and check that `git grep -n "legacy/purge" -- apps packages` prints
nothing and `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/api/legacy/purge"` prints 404.

The same commit closes the milestone: `docs/tasks/README.md` marks phase 3 done, with its row in "Completed and
removed"; one decision records the release (date, build id, content version, purge counts, objects deleted); this spec
and M034 are deleted (D104).

## Checks and acceptance

- Steps 1–10 are done in order, each with its evidence in the release decision, and the owner plays the new game.
- M034 #1 (step 1.4, then 7 on the iPhone), #2 and #5 (CI on the merge), #3 (1.3 and 8), #4 (8), #6 (T143's docs, live).
- 07 §7 by steps 7 and 8, and its device-storage item by 1.2 on the same code (Claude can't read the phone's storage);
  13 §9's second and third items; 06 §6's bucket item, stronger: no retired object remains.

## Rollback

`pre-split` is the porting reference (06 §2). Code goes back by reverting the merge, never by resetting or force-pushing
`main`:
```bash
git fetch origin && git worktree add --detach .claude/worktrees/g2-rollback origin/main && cd .claude/worktrees/g2-rollback
git revert -m 1 <merge-sha> --no-edit && git push origin HEAD:main
```
Then steps 4 and 5 for the revert, and the owner restarts when prompted. After step 6, also publish today's content
again from a `pre-split` checkout (`pnpm data:import && pnpm assets:import && pnpm content:publish`).

| When | The revert restores | Lost for good |
|---|---|---|
| Before step 3 | Nothing to undo | Nothing |
| After the deploy, before the owner's restart | Code and data: `players/{uid}` and the phone's database are untouched | Nothing |
| After the restart (wipe and purge ran) | Code only. The old app finds `players/` empty and starts a fresh old-format account | Today's progress (D323) |
| After step 9 | Code only; the RPG, Puzzles and Spark have no content left | Their private content too |

`saves/{uid}` and the phone's `uma-racer-g2` survive a rollback. Rolling forward again reuses them: the marker makes
the purge return at once, so an old-format account the rolled-back app wrote under `players/` stays until the owner
says to delete it.

## Out of scope

Any code change other than step 10's (a bug goes back to its task); removing the redirects and the local wipe (the
next phase that ships); push notifications (phase 4); master data (phase 5); World Expeditions (phase 9).

## Decided here

| Choice | Why |
|---|---|
| One "go" covers steps 3–9, given on the day; a slip asks again | M034's "go in chat on the day"; the message names every irreversible step |
| The owner restarts only after step 5 | Nothing is wiped until a signed-in generation-2 boot, so a rollback until then loses nothing |
| `--no-ff` merge from a detached worktree, pushed as `HEAD:main`; rollback is `git revert -m 1` | One commit to revert; `main`'s history and the owner's checkout stay untouched |
| Production's 426 is read from the logs, not probed | Every route but health needs the owner's token, so an unauthenticated probe gets 401, not 07 §6's 426; step 1.3 and T135's tests prove the rule |
| The new manifest is published after the deploy and before the restart | The new app boots on known kinds; `manifest.json` is the only manifest object, so afterwards none references the retired files (06 §3) |
| The bucket and local deletions come last | The last irreversible step; a rollback before it keeps today's modes whole |
| Puzzle and Spark local sources go with the RPG's | 06 §3 lists the RPG's; D326 and D287 retire the other two whole |
| The rehearsal seeds the old generation with `pre-split` on the same origin | The wipe meets real old data with nothing private copied; a second origin stands in for a second device |
| The follow-up removes the purge call only; the local wipe stays with the redirects | A device first opened after the follow-up still holds an old database (07 §4) |
| The follow-up's check is a 404 | An unknown route is 404 before any guard; a 401 would mean it is still there |
