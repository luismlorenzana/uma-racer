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

Sizing check: a heavy day of about 100 trainings and 30 races, with sync batches every few actions, is a few hundred Firestore writes.
Content packs plus atlases are an estimated 15–30 MB, downloaded once per content version.

## CI/CD (adapted from uma-planner)

`.github/workflows/deploy.yml`:

1. **verify** (every push and pull request): pnpm install (frozen lockfile), lint/type-check, tests, build.
2. **deploy** (only on `main`, and only once the repository variable `DEPLOY_ENABLED` is `true`):
   - Authenticate with **GitHub OIDC → Workload Identity Federation**. No keys, no secrets.
   - Build the API image and push it to Artifact Registry tagged with the commit SHA, then deploy to Cloud Run.
   - Smoke checks: `GET /api/health` answers, and `GET /api/save` returns `401` without a token, which proves the auth guard is on.
     (Not `/healthz`: Cloud Run's front end reserves some paths ending in "z".)
   - Build the web app and deploy it to Firebase Hosting, then smoke check the hosted URL and that the app shell is `no-cache`.
3. Deployments are serialized (`concurrency`) and never cancelled midway.

The `DEPLOY_ENABLED` gate keeps CI green before the GCP bootstrap exists.

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
| Web | `vite` on 5173, `/api` proxied to 8080 | Firebase Hosting |
| API | `nest start --watch` on 8080 | Cloud Run |
| Auth | `AUTH_MODE=disabled` | Firebase ID token + `ALLOWED_EMAIL` |
| Saves | `PERSISTENCE=local` → `apps/api/.data/save.json` | `PERSISTENCE=firestore` |
| Content | `CONTENT_SOURCE=local` → `content/` | `CONTENT_SOURCE=gcs` → private bucket |
| iPhone testing | `vite --host` over LAN, Safari Web Inspector over USB, iOS Simulator | Home Screen web app |

## Release runbook

Code, private content, and the installed Home Screen app update independently. Settings shows the current **app build id**,
the active **content version and origin**, and whether an app restart is ready. A release is complete only after all three
states have been checked.

### 1. Deploy code

Merge the green feature PR to `main`. The deploy workflow verifies the monorepo, deploys Cloud Run and Hosting, and performs
the unauthenticated health/auth-guard smoke checks. Watch it to completion without changing local gcloud configuration:

```bash
gh run watch <run-id> -R luismlorenzana/uma-racer --exit-status
```

If the release contains only code, skip the publish step. Open the hosted app while signed in and confirm Settings shows the
new 12-character build id.

### 2. Build and publish private content when it changed

Generate the private, gitignored output first. Keep `content/overrides/flair.json` in place when rebuilding the data pack.

```bash
pnpm data:import
pnpm assets:import
pnpm content:publish -- --dry-run
pnpm content:publish
```

`content:publish` re-hashes every local manifest file and refuses missing, altered, or malformed output. It checks the private
bucket, uploads only missing or size-mismatched content-addressed objects, and uploads `manifest.json` last. Old hashed objects
are deliberately retained. Both modes print the local version, remote version before and after, uploaded/already-present
counts, total bytes, and elapsed time.

The command always invokes gcloud with `CLOUDSDK_ACTIVE_CONFIG_NAME=default` and `CLOUDSDK_CORE_PROJECT=uma-racer` in its child
environment. It never runs `gcloud config set` and never changes the owner's active work account. `--bucket`, `--project`, and
`--content-dir` are available for recovery/testing; production defaults to `uma-racer-content`, `uma-racer`, and root
`content/`.

After a real publish, open the hosted app while signed in. Confirm Settings reports the published content version with network
origin, then fetch `/api/content/manifest` through that same authenticated session. A null version means the bucket is empty;
403 means the signed-in account is not allow-listed; a missing object, integrity failure, or network-only failure each receives
a distinct diagnostic. A complete verified offline fallback remains a success state. None of these recovery paths clear,
replace, or reseed the local save.

### 3. Restart the installed app

Reopen the Home Screen app. A waiting service worker—or a worker that took control in another tab—shows **Update ready** with a
**Restart** action instead of reloading silently. If Training, race completion, redemption, promotion, or Scenario Start is
committing, the restart waits for that promise to settle before activation/reload. Tap Restart and confirm Settings shows both
the new build id and intended content version. The content runtime keeps the last complete version active until a replacement
fully verifies, so both an old shell seeing new content and a new shell falling back to old cached content remain usable.

If publishing fails, leave the existing manifest in place, fix credentials/network/local output, rerun `--dry-run`, and retry.
Never delete IndexedDB, the service-worker content cache, old bucket objects, or the owner's save as release recovery.
