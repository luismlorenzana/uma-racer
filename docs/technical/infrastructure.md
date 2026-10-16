# Infrastructure & Deployment

Goal: **the same keyless GitHub Actions → GCP pipeline as uma-planner, at a cost of about $0 a month.**

## GCP project

**A new project, `uma-racer`** (Firebase-enabled, on the same billing account as uma-planner):

- Firestore free quota applies to each project's `(default)` database, so a separate project gets its own free tier.
- Its own Firebase Auth allowlist, Hosting site (`uma-racer.web.app`), and deploy identity.
- uma-planner can't be broken by uma-racer changes, and the other way around.

## Services and expected cost (single player)

| Service | Used for | Free tier (verify on the pricing pages when bootstrapping) | Expected |
|---|---|---|---|
| Firebase Hosting | SPA, service worker, PWA manifest | 10 GB stored, 360 MB/day transfer | $0 |
| Cloud Run | NestJS API: **min instances 0**, max instances 1, 512 MiB, CPU only during requests | 2M requests, 180k vCPU-seconds, 360k GiB-seconds per month | $0 |
| Firestore `(default)` | Saves | 1 GiB stored, 50k reads, 20k writes, 20k deletes per day | $0 |
| Cloud Storage (private bucket, `us-central1`) | Content packs and sprite atlases | 5 GB-month regional storage | $0 |
| Firebase Auth | Google sign-in | Free for this use | $0 |
| Artifact Registry | API images | 0.5 GB stored, with a **cleanup policy that keeps the last 3 images** | $0 |
| GitHub Actions | CI/CD (private repo) | 2,000 minutes per month | $0 |
| Cloud Billing budget | **Alerts at $1 and $5** | — | — |

Sizing check: a sync that runs operations reads the whole operation set, about 200 reads at 25 Umas, so even 100 syncs
a day stay under the 50k free reads; a heavy day of check-ins and 40 races is a few hundred Firestore writes
([rework/13](../rework/13-removals-and-plan-changes.md) §8).
Content packs plus atlases are an estimated 15–30 MB, downloaded once per content version.

## CI/CD (adapted from uma-planner)

`.github/workflows/deploy.yml` ([architecture](../game/architecture.md#ci-and-deploy) has the whole pipeline):

1. **verify** ("Test and build", every pull request and every push to `main`): pnpm install (frozen lockfile),
   `pnpm lint`, `pnpm test:ci` (one package at a time, so the CPU-heavy domain sims don't starve the web suite's timed
   tests on a 4-core runner), `pnpm build` (with the 180 KB startup check).
2. **deploy** ("Deploy API and web", only on `main`, and only while the repository variable `DEPLOY_ENABLED` is `true`):
   - Authenticate with **GitHub OIDC → Workload Identity Federation**. No keys, no secrets.
   - Build the API image and push it to Artifact Registry tagged with the commit SHA, then deploy to Cloud Run.
   - Smoke checks on the new Cloud Run URL: `GET /api/health` answers, and `GET /api/save` returns `401` without a
     token, which proves the auth guard is on. (Not `/healthz`: Cloud Run's front end reserves some paths ending in "z".)
   - Build the web app against that URL and deploy it to Firebase Hosting, then smoke check the hosted URL and that the
     app shell is `no-cache`.
3. Deployments are serialized (`concurrency`) and never cancelled midway.
4. **Docs-only pushes run nothing.** `paths-ignore` skips `docs/**` and every Markdown file, so a push that changes only
   those neither verifies nor deploys. Any other push to `main` deploys.

The `DEPLOY_ENABLED` gate kept CI green before the GCP bootstrap existed; it has been `true` since 2026-09-15.

## One-time bootstrap (run by the owner)

The GitHub repo `luismlorenzana/uma-racer` (private) is live, and CI verifies every push. The Google side needs the owner's
account: follow the **click-by-click [GCP Setup Guide](gcp-setup-guide.md)** (Firebase project → Blaze → web app + Hosting →
Google sign-in → Cloud Shell bootstrap), then send Claude the values from its Part 6. Claude sets the repository variables
(`GCP_PROJECT_ID`, `WIF_PROVIDER`, `CONTENT_BUCKET`, `ALLOWED_EMAIL`, `DEPLOY_ENABLED`), fills in `apps/web/.env.production`, and
runs the first deploy.

## Privacy of game content

- **Private GitHub repo.** `content/`, image caches, and `.env` files are gitignored.
- **Private bucket** with public access prevention enforced. Objects are only readable by the Cloud Run runtime service account.
- **Every content and save endpoint is behind the `AuthGuard`** and its owner allowlist.
- The Firebase Hosting bundle contains **no original-game assets**. It has only code, fonts, and original UI art.
- Data and image pipeline scripts run locally with Application Default Credentials, like uma-planner's importers.

## Environments

| | Local dev | Production |
|---|---|---|
| Web | `vite` on 5173 (on the LAN too: `host: true`), `/api` proxied to 8080 (`API_PROXY_TARGET` to point elsewhere) | Firebase Hosting, `https://uma-racer.web.app` |
| API | `nest start --watch` on 8080 | Cloud Run `racer-api`, us-central1: `https://racer-api-tmzkhylhfq-uc.a.run.app` (read it with the scoped `gcloud run services describe`) |
| Auth | `AUTH_MODE=disabled` (a fixed local user) | Firebase ID token + `ALLOWED_EMAIL` |
| Saves | `PERSISTENCE=local` → `apps/api/.data/save-g2.json` (`LOCAL_SAVE_FILE`) | `PERSISTENCE=firestore` → `saves/{uid}` |
| Dev operations | `DEV_OPERATIONS=true`, set by `pnpm dev` and `pnpm api` (the API's own `dev` and `start:dev` scripts), so `dev-grant` runs | Never set: no deploy, Dockerfile or Cloud Run setting sets it, so production refuses `dev-grant` |
| Content | `CONTENT_SOURCE=local` → `content/` | `CONTENT_SOURCE=gcs` → private bucket `uma-racer-content` |
| Synthetic accounts | `/dev/seeds/*?seed=…` in dev builds ([architecture](../game/architecture.md#dev-seeds)) | None: production answers `/dev/seeds` as an unknown path |
| iPhone testing | The dev server over the LAN, Safari Web Inspector over USB, iOS Simulator | Home Screen web app |

`apps/api/.env` comes from `apps/api/.env.example` (auth off, local saves and content). A fresh git worktree has
neither `.env` nor `content/`: copy the first, and link `content/` from the primary checkout (CLAUDE.md).

## Release runbook

Code, private content, and the installed Home Screen app update independently. Account (Town Hall, or the trainer
button) shows the current **App build**, the active **Content** version and whether it came from the network or the
offline cache, and the app shows **Update ready — Restart** when a restart is waiting. A release is complete only after
all three states have been checked. This is the runbook as run for generation 2's release on 2026-10-15 (T144) and the
Hub's two follow-ups the same day.

Every gcloud command is scoped by environment variables, never `gcloud config set`, because the active local account
is the owner's work account:

```bash
export CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer   # or prefix each command
```

### 1. Deploy code

Run `pnpm lint && pnpm test:ci && pnpm build` first. A multi-part request lands as one commit per part and one push at
the end. Claude pushes to `main` (a delegated agent's pull request is merged once it is green); a push that changes only
docs deploys nothing. Then find the run and watch it **without piping the watch**, since a pipe reports its own exit code and once
hid a failed test step:

```bash
SHA=$(git rev-parse HEAD)
RUN=$(gh run list -R luismlorenzana/uma-racer --workflow deploy.yml --commit "$SHA" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" -R luismlorenzana/uma-racer --exit-status > /dev/null 2>&1; echo "exit=$?"
gh run view "$RUN" -R luismlorenzana/uma-racer --json conclusion,headSha,jobs --jq '{conclusion, headSha, jobs: [.jobs[] | {name, conclusion}]}'
```

Done means exit 0, `conclusion` success, `headSha` the pushed commit, and both jobs ("Test and build", "Deploy API and
web") success. The race engine test's known timeout on a slow runner gets one
`gh run rerun "$RUN" -R luismlorenzana/uma-racer --failed`; any other failure stops the release (rollback below).

### 2. Verify production

```bash
gcloud run services describe racer-api --region=us-central1 \
  --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image,status.url)'
API=…   # the URL just printed
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/health"   # 200
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/save"     # 401
curl -sI https://uma-racer.web.app/ | grep -i '^cache-control: no-cache'
```

- **Smoke checks go to the Cloud Run URL.** Hosting has no `/api` rewrite, so `https://uma-racer.web.app/api/save`
  answers 200 with the app shell, which looks like a missing guard and isn't.
- **The smoke checks pass on the previous release too,** so they don't prove this one. What does: a new revision
  whose image ends in `:$SHA`, and a live chunk holding a string only the new code has:
  ```bash
  for f in $(curl -s https://uma-racer.web.app/sw.js | grep -oE 'assets/[A-Za-z0-9._-]+\.js' | sort -u); do
    curl -s "https://uma-racer.web.app/$f" | grep -q '<a string from the change>' && echo "new code in $f"
  done
  ```
- Only then is it deployed. The 2026-10-15 releases: `ec5b1bd` (generation 2) as racer-api-00188, `b2cb668` (the Hub)
  as racer-api-00189, `1db8065` (uma-art 2.7.0) as racer-api-00190.

### 3. Build and publish private content when it changed

Generate the private, gitignored output first. Keep `content/overrides/flair.json` in place when rebuilding the data
pack. From a worktree, link the primary checkout's `content/` and `scripts/data/.cache` in first, and never commit the
links.

```bash
pnpm data:import
pnpm assets:import
pnpm content:publish -- --dry-run
pnpm content:publish
```

`content:publish` re-hashes every local manifest file and refuses missing, altered, or malformed output. It lists the private
bucket once (D182; one lookup per file took over half an hour for ~2,000 files, a listing takes seconds), uploads only missing
or size-mismatched content-addressed objects, and uploads `manifest.json` last. Old hashed objects
are deliberately retained. Both modes print the local version, remote version before and after, uploaded/already-present
counts, total bytes, and elapsed time. Publish after the code that reads a new pack shape has deployed; content the
old code ignores may go first. The live manifest is `9ba4cdd37cca` (2026-10-15, T144: no retired kinds).

The command always invokes gcloud with `CLOUDSDK_ACTIVE_CONFIG_NAME=default` and `CLOUDSDK_CORE_PROJECT=uma-racer` in its child
environment. It never runs `gcloud config set` and never changes the owner's active work account. `--bucket`, `--project`, and
`--content-dir` are available for recovery/testing; production defaults to `uma-racer-content`, `uma-racer`, and root
`content/`.

After a real publish, open the hosted app while signed in. Confirm Account reports the published Content version from the
network, then fetch `/api/content/manifest` through that same authenticated session. A null version means the bucket is empty;
403 means the signed-in account is not allow-listed; a missing object, integrity failure, or network-only failure each receives
a distinct diagnostic. A complete verified offline fallback remains a success state. None of these recovery paths clear,
replace, or reseed the local save.

### 4. Restart the installed app

Tell the owner the deploy is verified; only then do they restart. Reopen the Home Screen app. A waiting service
worker—or a worker that took control in another tab—shows **Update ready** with a **Restart** action instead of
reloading silently. If a tap or a device write is committing (`criticalGameplayAction` around the game port's `run`
and `writeDevice`), the restart waits for it to settle before activation/reload. Tap Restart and confirm Account shows
both the new App build (the commit's first 12 characters) and the intended Content version. The content runtime keeps
the last complete version active until a replacement fully verifies, so both an old shell seeing new content and a new
shell falling back to old cached content remain usable.

If publishing fails, leave the existing manifest in place, fix credentials/network/local output, rerun `--dry-run`, and retry.
Never delete IndexedDB, the service-worker content cache, old bucket objects, or the owner's save as release recovery.

### Generation 2's one-time steps (T144, done 2026-10-15)

The cutover release added three steps that no later release repeats ([T144](../tasks/T144-the-release.md) has the
commands):
- **The purge, verified read-only.** The owner's first generation-2 boot called `POST /api/legacy/purge`. Checked with
  the scoped token against Firestore's REST API: `players/` holds no documents, `saves/{uid}/meta/purge` records 30
  collections and 3,676 documents, and the request log shows one purge doing the work.
- **The retired bucket objects deleted,** only after the purge and the new manifest verified: nothing under
  `data/rpg-*`, `data/puzzles-*`, `data/spark-rivals.*`, `atlases/puzzles-*` or `art/priconne/` remains, and a dry run
  uploads nothing. The retired private sources left the owner's machine too.
- **Still to come, T144's step 10:** once the owner confirms the new account is theirs, a release removes the purge
  endpoint and the boot's call; it then checks that `git grep -n "legacy/purge" -- apps packages` prints nothing and a
  `POST /api/legacy/purge` on the Cloud Run URL answers 404.

### Rollback

Code goes back by reverting, never by resetting or force-pushing `main`. From a fresh worktree on `origin/main`:

```bash
git revert --no-edit <sha>           # a single commit
git revert -m 1 --no-edit <merge>    # a merge commit, such as the cutover's ec5b1bd
git push origin HEAD:main
```

Then steps 1, 2 and 4 for the revert. Content rolls back by publishing the older checkout's content again; the old
hashed objects are still in the bucket, and the manifest goes up last.

**The `pre-split` tag** marks the old game on `main` before the generation-2 switch, and never moves. It is the
porting reference for anything of the old app, and its docs are read with `git show pre-split:docs/<path>`. Reverting
generation 2 itself restores code only: the old app would find `players/` empty and start a fresh old-format account,
because the old save is gone for good (D323), and the content would have to be published again from a `pre-split`
checkout. `saves/{uid}` and the phone's `uma-racer-g2` would survive, so rolling forward again reuses them.
