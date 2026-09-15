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
   - Smoke check: `GET /api/save` must return `401` without a token, which proves the auth guard is on.
   - Build the web app and deploy it to Firebase Hosting, then smoke check the hosted URL.
3. Deployments are serialized (`concurrency`) and never cancelled midway.

The `DEPLOY_ENABLED` gate keeps CI green before the GCP bootstrap exists.

## One-time bootstrap (run by the owner)

These steps need the owner's Google and GitHub accounts, so they are **not automated from this repo**. The full commands
are in [`infra/github-actions/README.md`](../../infra/github-actions/README.md):

1. Create the private GitHub repo `luismlorenzana/uma-racer` and push `main`. CI verification starts, and deploys stay off.
2. Firebase console: create the project `uma-racer`, upgrade it to Blaze, add a Web app, and enable Google sign-in.
3. Cloud Shell: run `infra/github-actions/bootstrap.sh`. It creates Firestore, Artifact Registry with a cleanup policy,
   the private bucket, service accounts, WIF, and a budget.
4. Set the repository variables `WIF_PROVIDER` and `ALLOWED_EMAIL`, and fill in `apps/web/.env.production`.
5. Set `DEPLOY_ENABLED=true` and push. The workflow deploys Cloud Run with its env vars and Hosting with the API URL.

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
