# T120 — dormant Farm cutover rehearsal

2026-10-09. **Invented accounts only; no owner save, account JSON, private content, authenticated production
preparation, grant or reset.** Both Farm gates remain false. The shipped Farm/Extra loop is unchanged.
The [standing contract](../technical/farm-kitchen-implementation.md#t120-implemented-protocol-d307) carries D307.

## Aggregate evidence

| Witness | Result |
|---|---|
| Absent/v1/v2 legacy Farm;20 owned outfits,14 scenarios,4 distinct presets each | PASS:280 units/1,120 builds per case; exact whitelist equality,20 zero workers,60 empty maps,3 empty recipe rows |
| Sparse old workers, idle/ready/running jobs, all18 old slots, never-farmed/unassigned outfits | PASS: original assignments/attempts/cycles/deadlines retained; no crop suggestions or free stock |
| Every supported legacy growth duration | PASS:20 distinct timers; before-deadline rejection, one old output, zero new EXP, future worker EXP unchanged |
| Accepted pre-freeze harvest / distinct-ID later claims | PASS: claimed cycle not restored, original evidence retained, duplicate output blocked by cycle/station guards |
| Empty account / repeated prepare, outfit and final calls | PASS: frozen cohort/receipts stable, no extra reset/output/milestone |
|4,096-outfit freeze / final verification envelope | PASS:130 entities+1 receipt at freeze;32/page,128 pages, ≤128 KiB/page; final refs ≤200 unchanged ceiling |
| Source/version/account mismatch, future saves, oversized cohort, changed page/missing evidence | PASS: no destructive step; original state retained for forward recovery |
| Local-file and strict fake Firestore,35 outfits/2 pages | PASS: same state digest `b062280d167fffe1`; no read after write, one roster query, largest later read set38 refs |
| Failure at every one of35 outfit commits, both page verifications and finalization, both adapters | PASS: atomic rollback, then same-target Retry; exact35 step receipts, no resnapshot |
| Missing acknowledgement after prepare/step / failed local write at every adoption point | PASS: original durable target retained, exact receipt recovered; no half cursor/worker/Uma |
| New acquisition/scenario after freeze, newer ordinary Uma edit | PASS: cohort unchanged; acquisition uses zero default; every current scenario cleared; racing/preset edits retained |
| Active/preparing Puzzle and Inspiration debt, card stars/sets, Puzzle parties/enrollments | PASS: existing state byte-equal; incomplete protected preparation defers without invoking it |
| Archive quota/write/readback/digest/account/export/future/64 MiB failures | PASS: no prepare call, retained evidence, separate Puzzle archive untouched |
| Whole-account archive JSON round trip; every local table including RPG/Puzzle journals/intents | PASS: account/build/Dexie metadata and SHA-256 verify; no upload or partial restore |
| Offline/nonpersistent/in-flight commit/undrained outbox | PASS: needs-sync; pending spend retained; proceeds only after safe drainage |
| New-device active adoption / stale full pull / old v2 ordinary writer / historical reconciliation | PASS: status only, no repeated archive/reset, no restored Extra or new EXP from old evidence |
| Malformed recovery and normal capability-off path | PASS: malformed evidence retained; disabled path performs zero storage/network reads |

The three20-outfit reset state checksums are `063710616488c15d` (no old Farm), `13a7b9fdead1511d` (v1),
and `ac01e3a3d50c0283` (v2). These are regression identities, not cryptographic archive proofs.
Checked-in fixtures are small generators/invented values; no large account fixture is stored.

## Commands and bundle

- `pnpm lint`: PASS (all6 packages).
- `pnpm test`: PASS;1,660 tests,209 files, all6 packages (49 new cutover tests). The uncached run also passed
  serialized with `pnpm test --concurrency=1` to avoid the known unchanged race wall-clock threshold under
  concurrent local package load. No threshold relaxed.
- The first PR CI run hit Vitest's default five-second timeout in the new local-file all-35-step rollback
  case (no failed state assertion). The four full-account adapter rehearsal cases now have explicit30-second
  timeouts for shared-runner I/O; no production or existing race-performance limit changed.
- `pnpm build`: PASS, including API standalone compilation and PWA service worker.
- Startup154,402 bytes gzip (154.40 KB, below180 KB); lazy cutover/recovery module5,135 bytes gzip (5.14 KB).
- API mirror checks:18 Farm modules;84 Puzzle dependency modules. The latter adds only the shared cutover-log
  parser dependency; no Puzzle mechanics/preservation content changes.
- `pnpm sim:farm:kitchen`: PASS, unchanged SHA-256 `99fc49c3909c9ccb504789c17c0f3979e0b413a95d128c9473098c7f3b7fb144`.
- `pnpm sim:farm:stats`: PASS,672 exact card-only checks/2,016 builds; unchanged SHA-256
  `965ab0db062d575ffcc864a3e2d90887691f7cb5d3fd249a4831610276f62c13`.
- `pnpm sim:puzzles:preservation`, `pnpm sim:puzzles`, `pnpm sim:rpg:campaign`: PASS. Puzzle's640 battles and
  RPG's careful23-fight chapter clears remain unchanged. The previously documented legacy constellation sim
  tier1 stamina failure is not retuned or relabelled as a Farm regression.

## Limitations and next gate

This is a protected migration/recovery port, not a new visible Farm screen or real-host installation. T121
wires idle/runtime/recovery guards, T122 displays Retry/Export and the districts, T123 connects Extra stats,
and T124 enables the complete loop. No new screen screenshot or physical-device claim is appropriate here.
Actual iPhone storage quota/JSON download/account reset visibility, live cloud transaction/second-device
acceptance and check-in pacing remain pending owner checks at release. Archives stay on their capturing device;
another device resumes server evidence but cannot invent or download that device's local archive.
