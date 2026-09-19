# T022 — Release, content publish, and update readiness (Milestone 7, part 4)

**Outcome:** shipping is one understandable sequence — deploy code, publish content, restart the installed app — and the
app says which build and which content it is running. Today the content publish is a hand-typed set of `gcloud` commands
in [CLAUDE.md](../../CLAUDE.md), and an installed PWA can sit on an old shell with no signal at all.

This task condenses the release-readiness half of the earlier Milestone 7 polish draft. The presentation half moved to
[Milestone 9](M009-presentation-polish.md).

## Fixed choices

- Code deploy, content publish, and device update are three distinct states and must be visible as such.
- The publish step **never** changes the active gcloud configuration. It shells out with the documented environment
  scoping (`CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer`), because the machine's active account
  belongs to the owner's employer.
- Content-addressed files are uploaded **before** `manifest.json`, so a client never sees a manifest whose files are
  missing. Old hashed objects are left alone.
- Recovery never clears or replaces the local save.
- Workflow and infrastructure files stay off-limits to delegated agents ([AGENTS.md](../../AGENTS.md)); this task lives
  in `scripts/`, `apps/web/`, and docs.

## Deliverables

### 1. `pnpm content:publish`

- Re-verifies every manifest entry against the local file (byte length and SHA-256) and refuses to publish on mismatch.
- Uploads new content-addressed objects, then the manifest, and reports: local version, remote version before and after,
  objects uploaded versus already present, total bytes, and elapsed time.
- `--dry-run` reports the same plan without mutating the bucket.
- Fails clearly when the bucket is unreachable, credentials are missing, or the local `content/` output is absent.

### 2. Versions and update lifecycle in the app

- Settings shows the **app build id** (injected at build time) next to the existing content version and origin.
- When a new service worker is waiting or has taken control, the app offers **Update ready — Restart** rather than
  reloading silently.
- A reload never happens while a Training turn, race completion, redemption, promotion, or Scenario Start is in flight.
- Diagnostics distinguish: signed out · not allow-listed · empty bucket · missing object · corrupt bytes · network
  failure · valid offline fallback. Each has its own message and, where one exists, its own action.
- An old shell with new content and a new shell with old cached content both recover to a working state.

### 3. Runbook

One section in `docs/technical/infrastructure.md` and a shortened pointer in `CLAUDE.md`: deploy, publish when content
changed, signed-in hosted smoke, restart the installed app, confirm both versions.

## Tests

- Publish planning is unit-tested against a fake storage client: mismatch detection, upload ordering, dry run, and the
  "already present" path.
- Update-lifecycle state machine: waiting worker, in-flight action blocks restart, restart after the action commits.
- Content diagnostics map each failure shape to its message; the offline fallback stays a success state.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass.
- A real publish from this machine prints both versions and passes an authenticated production fetch of the manifest.
- Installing the app, deploying a change, and reopening shows the Restart action and afterwards the new build id.

## Out of scope

Icons, audio, celebration work, device acceptance (all Milestone 9), any gameplay change, infrastructure or workflow
edits, and destructive cache or save resets.
