# Farm kitchen real-host verification

T121 / D308 · 2026-10-09. All records are small invented fixtures in isolated IndexedDB databases and a synthetic
semantic repository. No owner account, original-game rows, private assets, cloud credentials or reset were accessed.
Both Farm release capabilities remain false; this is not a playable kitchen release.

## Tested boundary

`PersistentFarmKitchenHost` invokes the real T119 coordinator/resolver and Dexie transactions, not a success mock.
The 23 new host cases plus existing coordinator/cutover/snapshot suites cover:

- Write-free reads, lazy Lv 1/0 worker defaults, readiness-scoped real installation/uninstallation and normal flag-off
  runtime boot with no kitchen/preferences initialization. Disabled active/preparing views cannot use a v2 writer.
- Assign→Start→refresh→wait→Claim, retained worker, exact original job/input/deadline, six outputs/12 EXP once.
  Double taps reuse durable identity; different payload/stale second screens cannot spend again.
- An 11-command offline raw→processing→raw→cooking chain survives storage reopen unchanged. Pending stock is not
  canonical stock; quantity 2 yields two meals and one 12 EXP job award. A middle Start rejection retains its intent,
  blocks all seven descendants and credits no processed/meal output.
- Lost Start/Claim/Energy/Buy replies replay identical bytes/IDs after reload. One-job Energy confirms waste and
  debits once; the deliberate owner debug grant is not automatic. Pending bought/active nodes are previews only.
- Two devices competing for one meal/different nodes and one six-item processing batch cannot both spend it.
  Ownership revision metadata advances without replacing newer local builds. Existing rollback/late-response tests
  preserve unrelated Uma/Puzzle/RPG fields and newer Farm canonical versions.
- Every enqueue and acknowledgement write boundary has rollback coverage, including evidence/outbox/pending/map
  effects. No partial canonical progress or store publication survives a failed transaction.
- All 30 legal ready stations Collect all freeze named job/claim identities. Batches respect 16 operations, 256 KiB
  complete request and 200 exact combined refs. Partial acceptance saves 20 jobs, retains 10 named failures, and Retry
  never pays an accepted job again or starts a new one. Targeted queueing avoids 30 whole-roster publications.
- Lv 5→6/Lv 8→9 receipts identify real shared milestones. A new Lv 1 specialist cooks quantity 3 with later same-block
  inputs; a wrong-block input is refused. First-preparation and level celebrations come from accepted receipts only.
- Backward clock/ready waiting do not persist or restart jobs. Focus/minute/visibility reads, stopped subscriptions
  and equal narrow Zustand slices preserve state. Future/corrupt storage remains visible/exportable, not zeroed.
- Canonical nonacceptance is required for Discard, accepted jobs cannot be discarded, descendants must recover first,
  and immutable rejected payload/proof remains available for export. Opaque private recovery export writes no progress.
- The production factory itself returns the real disabled-generation read-only adapter without writes, schedule,
  prepare calls or a test double. Existing T120 offline/quota/export/reinstall/second-device cutover rehearsals remain.
- A rejected Farm intent remains visibly recoverable after ordinary acknowledgements and an empty sync flush.

## Commands and limits

Lint/test/build and `sim:farm:kitchen`, `sim:farm:stats`, legacy `sim:farm`, `sim:puzzles` and `sim:rpg:campaign`
pass (1,685 tests across 210 files). The two Farm regression hashes remain
`99fc49c3909c9ccb504789c17c0f3979e0b413a95d128c9473098c7f3b7fb144` and
`965ab0db062d575ffcc864a3e2d90887691f7cb5d3fd249a4831610276f62c13`.
No rule/cap/cost/timer/stat number changed. Local build startup JavaScript is 154,491 bytes gzip (154.49 KB),
with no static module preloads. Lazy kitchen host/factory/cutover entry chunks are 5,982/742/5,188 bytes gzip
respectively; their shared lazy dependencies remain separate. The catalogue and production adapter are not
startup imports.

The initial fully concurrent local test run hit the existing local-only race precompute 250 ms wall-clock check
(about 530 ms while building/testing together). Running all six workspace suites serially passes without changing
that assertion or unrelated Puzzle/race code. The final exact `pnpm lint && pnpm test && pnpm build` also passes.
Normal CI is still the unchanged lint/test/build workflow.

The previously documented tier1 stamina-ladder failure in the unrelated constellation sim is not retuned here.
No new Farm screen/Home entry or stat join ships. T122 owns both phone viewport/layout proofs; T123 owns the
acknowledged-map race boundary; T124 alone activates the whole release and records owner-device checks.
Physical iPhone storage/export/foreground behaviour and the real-account upgrade remain pending, not inferred
from fake IndexedDB or a synthetic repository.
