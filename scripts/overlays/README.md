# Racer overlays (SE1)

Master data and Uma/card art come from uma-platform's schema-major-1 release, not a Racer importer.
`@racer/domain/master` is the single pure interpretation on the browser and API. All fixtures here are synthetic.

Keep private authored `content/overrides/flair.json` and `card-focus.json`. From a worktree, link only that folder
from the primary checkout; do not stage the link. Local master defaults to sibling `uma-platform/content/release`
(`MASTER_DIR` overrides it). No original rows, art or reports go in git.

```sh
pnpm overlays:import
pnpm overlays:publish -- --dry-run
pnpm overlays:publish
pnpm master:parity
pnpm sim:careers -- --coverage-only
```

`CONTENT_DIR` selects an overlay authoring/output folder. Publication verifies size/SHA and references, writes the
immutable file before `overlay.json`, and uses generation preconditions. Cloud commands always use config `default`,
project `uma-racer`; the active account/configuration never changes. Required overlay paths are API-allowlisted.

`master:parity` reads the last private Racer release only as a one-off migration oracle (`PARITY_CONTENT_DIR`);
game/sims never consume it. It writes details under gitignored `content/review/` and prints aggregates only. Retained
ids, mechanics and active Race Bonus must not change. The acceptance note classifies deliberate newer facts.

The one-time `tsx src/retire-cli.ts` is inventory-only by default. `--delete` additionally requires
`VERIFIED_DEPLOY_SHA`, `VERIFIED_MASTER_VERSION`, `RETIRED_MASTER_VERSION`, and the release runbook's completed
production checks. It deletes only exact old master namespaces, with generation preconditions; it never matches
saves, source overrides, new overlays or arbitrary objects. Do not use it before deployment verification.
