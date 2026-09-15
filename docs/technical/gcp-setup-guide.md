# Google Cloud & Firebase Setup — click by click

This takes about **30 minutes**, once. After it, every push to `main` deploys Uma Racer automatically.
The GitHub side is already done (repo, CI, workflow). **Claude does everything after Part 6.**

> Expected cost: **$0/month** (everything fits free tiers). A $5 budget alert emails you if that ever changes.
> Menu names in Google's consoles move around occasionally. If a menu item isn't where this guide says, use the
> **search box at the top of the console** and type the page name (for example "Authentication").

**Before you start**

- Use your Mac, in Chrome or Safari, signed in to the **same Google account that owns uma-planner** (its billing account is reused).
- The repo is on your Mac at `~/workspace/uma-racer` (you'll upload one file from it in Part 5).
- Keep a note open. You'll copy a few values and send them to Claude at the end.

---

## Part 1 — Create the Firebase project (5 min)

1. Open **https://console.firebase.google.com/**
2. Check the avatar in the top-right corner is the uma-planner Google account. If not, click it and switch.
3. Click **Create a new Firebase project** (a large card or button; it may read "Create a project" or "Get started by setting up a Firebase project").
4. In **Project name**, type: `uma-racer`
5. Under the name, Firebase shows the **project ID** it will use.
   - If it's exactly `uma-racer`, continue.
   - If it shows something else (like `uma-racer-1a2b3`), click the **Edit** (pencil) icon next to it and type `uma-racer`.
     If Firebase says the ID is unavailable, **accept its suggestion and write it down**. The ID can't be changed later.
6. Tick the terms checkbox if there is one, then click **Continue**.
7. **Gemini in Firebase**: turn it **off** (not needed). Click **Continue**.
8. **Google Analytics**: turn it **off**. Click **Create project**.
9. Wait for "Your Firebase project is ready", then click **Continue**.

✅ **Checkpoint:** the browser address looks like `https://console.firebase.google.com/project/uma-racer/overview`.
The part after `/project/` is your **PROJECT_ID**. Write it down.

---

## Part 2 — Upgrade to the Blaze plan (3 min)

Blaze is needed for Cloud Run and Artifact Registry. It's pay-as-you-go, but the free tiers cover Uma Racer.

1. Open this link, replacing `PROJECT_ID` with yours:
   **https://console.firebase.google.com/project/PROJECT_ID/overview?purchaseBillingPlan=metered**
   (Alternative: at the bottom of the left sidebar, click the plan label **Spark** → **Upgrade**.)
2. Choose **Blaze** (pay as you go) and click **Select plan** / **Continue**.
3. **Cloud Billing account**: open the dropdown and pick the **same billing account uma-planner uses**. Click **Link** / **Continue**.
4. If it offers a **budget alert**, type `5` and click **Continue** (the bootstrap also creates one; having two is harmless).
5. Click **Purchase** / **Confirm plan**. Nothing is charged now.

✅ **Checkpoint:** the plan label at the bottom of the left sidebar now says **Blaze**.

---

## Part 3 — Register the web app and turn on Hosting (3 min)

Uma Racer uses **Firebase Hosting** (the classic static-site product), **not App Hosting**. App Hosting is for server-rendered
Next.js and Angular apps that build from GitHub on Cloud Run. Uma Racer is a static Vite app deployed by GitHub Actions.
Direct links are used below because the console's left menu gets regrouped from time to time. Replace `PROJECT_ID` in each link.

### 3a — Register the web app

1. If the "Plan change completed successfully" dialog from Part 2 is still open, click **Done**. You can skip the spend caps
   ("Go to budgets"); Part 5 sets up a budget alert.
2. Open **https://console.firebase.google.com/project/PROJECT_ID/settings/general**
   (or click the **gear icon** next to **Project Overview** → **Project settings** → **General** tab).
3. Scroll to **Your apps**. Click the **Web** platform icon `</>` (if the project already has apps, click **Add app** first).
4. On **Add Firebase to your web app**:
   - **App nickname**: `uma-racer-web`
   - **Tick "Also set up Firebase Hosting for this app"** and leave the site as the default (your PROJECT_ID).
5. Click **Register app**.
6. The **Add Firebase SDK** step shows a `firebaseConfig` block. Copy the **apiKey** value into your note. (It's a public
   client value, not a secret.) Click **Next**.
7. On **Install Firebase CLI**, click **Next** without running anything. On **Deploy to Firebase Hosting**, click **Continue to console**.

**Need the apiKey again later?** Same Project settings → General page → **Your apps** → `uma-racer-web` → **SDK setup and configuration** → **Config**.

### 3b — Confirm classic Hosting is on

1. Open **https://console.firebase.google.com/project/PROJECT_ID/hosting**. This is classic Hosting. Don't use `/apphosting`.
2. If you see **Get started**, click it, click **Next** through the steps without running any commands, then **Continue to console**.
3. You should now see the Hosting dashboard with your site's domains. It may say it's waiting for a first release, which is expected.

✅ **Checkpoint:** Project settings lists the `uma-racer-web` app, and the Hosting page shows `PROJECT_ID.web.app` and `PROJECT_ID.firebaseapp.com`.

---

## Part 4 — Turn on Google sign-in (2 min)

1. Open **https://console.firebase.google.com/project/PROJECT_ID/authentication/providers** (in the left menu it sits under **Security** on
   newer consoles, or **Build** on older ones).
2. Click **Get started**.
3. Open the **Sign-in method** tab. Under **Additional providers**, click **Google**.
4. Switch **Enable** on.
5. **Project support email**: pick your email from the dropdown.
6. Click **Save**.
7. Open the **Settings** tab → **Authorized domains**. Confirm the list includes:
   - `localhost`
   - `PROJECT_ID.firebaseapp.com`
   - `PROJECT_ID.web.app`

   If `PROJECT_ID.web.app` is missing: click **Add domain**, type it, click **Add**.

✅ **Checkpoint:** in **Sign-in method**, Google shows **Enabled**.

### Part 4b — Allow sign-in inside the Home Screen app (2 min)

Safari's privacy rules break Google sign-in inside a Home Screen app unless the sign-in page is served from the app's own
domain. That needs one extra redirect address on Google's side.

1. Open **https://console.cloud.google.com/auth/clients?project=PROJECT_ID** (Google Auth Platform → **Clients**). The older
   **https://console.cloud.google.com/apis/credentials?project=PROJECT_ID** page lists the same clients under **OAuth 2.0 Client IDs**.
2. Click **Web client (auto created by Google Service)**. It only exists after Part 4, when Google sign-in is enabled.
3. Scroll to **Authorized redirect URIs** → click **+ Add URI** → type (replace `PROJECT_ID`):

   ```text
   https://PROJECT_ID.web.app/__/auth/handler
   ```

   Keep the existing `https://PROJECT_ID.firebaseapp.com/__/auth/handler` entry. Don't remove anything.
4. Click **Save** at the bottom. Changes can take a few minutes to apply.

✅ **Checkpoint:** the client's **Authorized redirect URIs** list shows both the `firebaseapp.com` and the `web.app` handler addresses.

---

## Part 5 — Run the bootstrap script in Cloud Shell (10 min)

This one script creates the database, the image registry, the private content bucket, the service accounts, the
keyless GitHub login, and the budget alert. It is safe to run again if anything fails halfway.

1. Open **https://console.cloud.google.com/**
2. In the top bar, click the **project picker** (it shows a project name next to the Google Cloud logo).
   Choose the **All** tab, type `uma-racer`, click your project → **Open**.
   ✅ The top bar now shows your project.
3. Click the **Activate Cloud Shell** icon in the top-right toolbar (a small square with `>_`).
   A terminal opens at the bottom of the page. If a dialog appears, click **Continue** / **Authorize**.
4. Upload the script:
   - In the Cloud Shell toolbar, click the **⋮** (More) menu → **Upload**.
   - Click **Choose files**. In the Mac file dialog press **⌘ + Shift + G**, paste
     `~/workspace/uma-racer/infra/github-actions/bootstrap.sh`, press **Enter**, then click **Open** / **Upload**.
   - In the terminal, check it arrived:

     ```bash
     ls -l ~/bootstrap.sh
     ```

5. Run it. **If your PROJECT_ID is exactly `uma-racer`:**

   ```bash
   bash ~/bootstrap.sh
   ```

   **If Firebase gave you a different ID** (replace the value):

   ```bash
   PROJECT_ID=uma-racer-1a2b3 bash ~/bootstrap.sh
   ```

6. If a popup asks to **Authorize Cloud Shell**, click **Authorize**.
7. Wait 3–8 minutes. Lots of output scrolls by. It ends with a box like this:

   ```text
   ================================================================================
    Bootstrap complete. Copy everything between the lines and send it to Claude.
   --------------------------------------------------------------------------------
    GCP_PROJECT_ID = uma-racer
    PROJECT_NUMBER = 123456789012
    WIF_PROVIDER   = projects/123456789012/locations/global/workloadIdentityPools/github-actions/providers/uma-racer
    CONTENT_BUCKET = uma-racer-content
   ================================================================================
   ```

8. Select that block with the mouse and copy it into your note.

**If something goes wrong**

| Message contains | Do this |
|---|---|
| `billing` / `Billing account ... not found` / `requires billing` | Part 2 isn't finished. Do it, then re-run step 5. |
| `PERMISSION_DENIED` or `does not have permission` right after creating the project | Wait 2 minutes, then re-run step 5. |
| `bucket name ... not available` / `already exists` (for the content bucket) | Re-run with a unique bucket name: `CONTENT_BUCKET=uma-racer-content-luis bash ~/bootstrap.sh` (add `PROJECT_ID=...` too if yours differs). |
| `⚠️ Could not create the budget` | Fine to ignore if you set a budget in Part 2. Otherwise: console search "Budgets & alerts" → **Create budget** → amount $5. |
| Anything else | Copy the last ~20 lines and send them to Claude. |

---

## Part 6 — Send Claude these values

Paste this into the chat, filled in:

```text
GCP_PROJECT_ID = (from the bootstrap box)
PROJECT_NUMBER = (from the bootstrap box)
WIF_PROVIDER   = (from the bootstrap box)
CONTENT_BUCKET = (from the bootstrap box)
FIREBASE_API_KEY = (apiKey from Part 3)
ALLOWED_EMAIL  = (the Google account you'll sign in with on your iPhone)
```

Claude will then:

1. Fill in `apps/web/.env.production` (API key, project ID, and `authDomain = PROJECT_ID.web.app` so sign-in works in the Home Screen app).
2. Set the GitHub repository variables `GCP_PROJECT_ID`, `WIF_PROVIDER`, `CONTENT_BUCKET`, `ALLOWED_EMAIL`, and `DEPLOY_ENABLED=true`.
3. Push, watch the deploy, and verify that the API refuses requests without a login and that the site is up.

---

## Part 7 — Install on your iPhone (after Claude confirms the deploy)

1. Open **Safari** and go to **https://PROJECT_ID.web.app**
2. Tap the **Share** button (square with an up arrow) → scroll down → **Add to Home Screen** → keep the name **Uma Racer** → **Add**.
3. Open **Uma Racer** from the Home Screen. Tap **Uma Racer** (top-left) to open **Settings** → **Sign in with Google** → pick the account you sent as `ALLOWED_EMAIL`.
4. *(Optional, smoother animation)* iPhone **Settings** → **Apps** → **Safari** → **Advanced** → **Feature Flags** →
   turn **off** "Prefer Page Rendering Updates near 60fps". This lets Safari run the game at 120 Hz.

---

## Appendix

**What the setup creates**

| Resource | Name |
|---|---|
| Firebase project (Blaze) | `PROJECT_ID` |
| Web app + Hosting site | `uma-racer-web` → `https://PROJECT_ID.web.app` |
| Firestore database | `(default)`, `us-central1` |
| Artifact Registry repository | `racer` (keeps the last 3 images) |
| Private Cloud Storage bucket | `CONTENT_BUCKET` (public access blocked) |
| Service accounts | `github-deployer` (deploys), `racer-api-runtime` (runs the API) |
| Workload Identity pool/provider | `github-actions` / `uma-racer` — only `luismlorenzana/uma-racer` on `main` can use it |
| Cloud Run service | `racer-api` — created by the first deploy, scales to zero |
| Budget | `$5`, alerts at $1 and $5 |

**Check spending anytime:** Cloud console search "Billing" → **Reports**.

**Remove everything:** Firebase console → gear icon → **Project settings** → **General** → bottom → **Delete project**.
