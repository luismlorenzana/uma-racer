# GitHub Actions production deployment

Same keyless, commit-driven pipeline as uma-planner. A push to `main` runs the full verification suite, builds the API
image, pushes it to Artifact Registry, deploys it to Cloud Run, builds the web app against that API, and publishes it
to Firebase Hosting. Pull requests run verification only.

The workflow is bound to:

- GitHub repository: `luismlorenzana/uma-racer` (**private**)
- Git branch: `main`
- GCP project: `uma-racer`, region `us-central1`
- Cloud Run service: `racer-api` (min instances 0, max 1, runtime SA `racer-api-runtime`)
- Artifact Registry: `us-central1-docker.pkg.dev/uma-racer/racer/api:<commit-sha>` (cleanup policy keeps the last 3)
- Private content bucket: `gs://uma-racer-content`
- Firebase Hosting site: `uma-racer` → https://uma-racer.web.app

## One-time setup (owner)

1. **GitHub:** create the private repo `luismlorenzana/uma-racer` and push `main`. CI verification runs right away,
   and deploys stay off until step 6.
2. **Firebase console:** create the project `uma-racer`, upgrade it to **Blaze** (same billing account as uma-planner),
   add a **Web app**, and enable **Authentication → Google**. Add `uma-racer.web.app` under Authentication → Settings →
   Authorized domains.
3. **Cloud Shell** (not a local terminal, as with uma-planner):

   ```bash
   git clone git@github.com:luismlorenzana/uma-racer.git
   cd uma-racer
   ALLOWED_EMAIL=you@example.com BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX bash infra/github-actions/bootstrap.sh
   ```

   It enables the APIs and creates Firestore, the Artifact Registry repo with a cleanup policy, the private content bucket,
   the runtime and deployer service accounts, the WIF provider restricted to `main`, and (optionally) a $5 budget with alerts.
4. **GitHub repository variables** (Settings → Secrets and variables → Actions → Variables): `WIF_PROVIDER` and
   `ALLOWED_EMAIL`, both printed at the end of the bootstrap.
5. **`apps/web/.env.production`:** fill in the public Firebase web config. Set `VITE_FIREBASE_AUTH_DOMAIN=uma-racer.web.app`
   so sign-in works inside the iOS Home Screen app. Commit it.
6. Set **`DEPLOY_ENABLED=true`** and push to `main`, or run the workflow manually.

Identity changes can take up to five minutes to propagate.

## Deployment behavior

1. Install from the frozen pnpm lockfile, then lint/type-check, test, and build everything.
2. Authenticate with GitHub OIDC and short-lived Google credentials.
3. Build an immutable API image tagged with the commit SHA, push it, and deploy it to Cloud Run with the production env vars.
4. Smoke check: `GET /api/save` without a token must return `401`, which proves the auth guard is on.
5. Build the web app with `VITE_API_BASE_URL` set to the deployed API URL, deploy it to Firebase Hosting, and smoke check it.

Production deployments are serialized and never cancelled midway. A failed verification job blocks all production changes.
