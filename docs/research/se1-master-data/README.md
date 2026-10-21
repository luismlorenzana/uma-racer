# SE1 · shared master-data acceptance

Migration from final Racer release `9ba4cdd37cca` to published platform release `f8ab287029e8`, 2026-10-18.
Private rows, art and field-by-field reports remain under gitignored `content/review/`; no owner save is read or
changed for this proof. A separate local account is used for browser checks. P60: no Simulator.

## Private parity (aggregate-only)

| View | Before | After |
|---|---:|---:|
| Outfits | 268 | 270 |
| SSR cards | 312 | 316 |
| Skills | 1506 | 1513 |
| Regular race variants | 321 | 330 |
| Courses | 119 | 119 |

Zero removed ids, zero retained stat/aptitude/skill-mechanic/course differences, zero retained card Race Bonus
differences. `pnpm master:parity` fails on unexpected field differences or active unique-effect loss.

Deliberate newer/canonical facts, not balance changes:

- Four Global release dates are updated. Ten objective-family arrays gain existing Japanese local-venue races that
  the platform covers; the nine additional race variants are within the same existing venue allowlist, not new
  international venues. Existing frozen careers/save ids are untouched.
- 301 legacy card effect profiles change with the newer SSR population/medians; **none changes Race Bonus**, the
  only profile-derived gameplay effect retained since D125/D329. Twelve obtain classifications and ten starter flags
  reflect platform facts; generation 2 opens every SSR, so these are not eligibility gates.
- 44 source unique effects with level zero/conditional type codes canonicalize to null upstream. None maps to a
  Racer effect, so no active card effect is lost. The adapter does not invent invalid master records to restore them.
- Three inherited genes whose own source rarity is 6 must be kept by their non-evolved parents. An initial adapter
  filter dropped these; it was corrected before delivery and is pinned with an invented regression. Only actual
  top-level evolved skills remain excluded. Seven newly published skills are additions.

All 3,780 outfit/scenario careers freeze successfully through the unchanged planner (`sim:careers -- --coverage-only`).
Full win-rate sims are not rerun: race coefficients and combat rules did not change.

## Automated and local acceptance

Adapter interpretation, required overlay/hash envelopes, protected HTTP routes, per-version operation environment,
missing-content/no-write behavior, same-character/different-outfit faces, cache corruption repair, auth failures,
cold offline restart and cancellation use synthetic fixtures. Existing save sync and UI suites remain.

Browser and release results are appended after verification, including startup size. Original-game art screenshots
are not checked into git. Physical iPhone edge/VoiceOver feel remains the owner's check; no Simulator pass is claimed.

### Local browser, 390×844

The verified published release was mirrored privately (2,298 unchanged files reused, 271 downloaded; all hashes
checked) and served by an isolated API on 8093 and web on 5186, with a separate proof-only local save. Stable Icons
displayed per-outfit faces; a ticket unlock reached its reveal/profile, with the platform bust and unchanged career.
Town Hall showed the outfit chibi. A G3 race ran through playback, Skip and results with platform busts and course
geometry; its receipt synced to the local API. The Farm map and Vegetable Garden showed the unchanged item art.

Both dark and light were inspected. With only the local API stopped, a full page reload created a new runtime and
opened the Owned album with the same Uma, face, preferences and ticket balance; content used the last-good persistent
cache. API-offline sync correctly reported its unavailable connection rather than losing or reseeding the save.
This checks content/save offline behavior; full PWA shell availability is supplied by the existing service-worker
precache, not claimed from a dev-server test.

Full lint/test/test:ci/build passed locally. Startup: **153.23 KB gzip / 180 KB**. No production infrastructure files
changed; the only new IAM grant is runtime objectViewer on the shared bucket. A cleanup dry run also found two old
unreferenced type-icon atlas files; those are included in the narrow retired namespace, never new overlays.

## Production and final cleanup — 2026-10-21 (D379)

The source was already merged and deployed; this closes its remaining operational gate. The deployed-source proof
was refreshed against A04's descendant `be16a6d2a53ace5dc08082c97856c3a2936bca89`, ready API `racer-api-00202-fdz`:

- [Standard production workflow green](https://github.com/luismlorenzana/uma-racer/actions/runs/39633395549), both
  jobs successful. The ready revision's immutable digest matches the artifact tagged to that exact SHA.
- Health 200; unauthenticated save/master channel/overlay each 401. Hosting shell 200/no-cache, live build
  `be16a6d2a53a` and the service-worker-listed new ItemIcon chunk verified. Deployed startup **156.78 KB gzip / 180 KB**.
- The shared bucket's channel remains **`f8ab287029e8`**. API request logs independently show successful authenticated
  master-channel and outfit-face requests on `racer-api-00199-kqq` (2026-10-19); no new owner session was created or
  owner save/private image downloaded for this closeout. The existing local full-hash art/offline acceptance above
  remains the visual/integrity proof. SE4 retains its snapshot and cache keys, without clearing device data.

Exact retirement of old Racer release **`9ba4cdd37cca`**:

| Scope | Removed objects |
|---|---:|
| Bust / card / chibi / dress / face / Uma generated images | 2,041 |
| Old icon atlas JSON and pages | 12 |
| Old master-data pack versions | 22 |
| Retired manifest | 1 |
| **Total** | **2,076 · 65,767,727 bytes** |

The original reviewed inventory's exact object generations were used; the old pointer was deleted last. Transient
Storage 503s stopped the first passes safely. Bounded transport retries were added and tested against synthetic
network/HTTP responses (four attempts; auth and generation refusals never retry). Resuming the **same** inventory
completed at `2026-10-21T16:29:18Z`. Final inventory: **zero retired targets**; the **two retained overlay objects** have
identical names, generations and sizes to their pre-cleanup baseline. Private inventories stay under gitignored
`content/review/`; no object paths or original-game rows are in this record.

The bucket's seven-day soft-delete policy was checked before removal (604,800 seconds); recovery is possible within
that retention period. Platform replacement files, authored sources, unrelated objects and all saves are untouched.
No local art caches or owner documents were removed. The API's required overlay remains available.

Fresh worktree `pnpm lint`, `pnpm test:ci`, `pnpm build` pass (startup 156.34 KB gzip locally); the six new maintenance
tests bring overlay tests to eight. The SE1 packet is retired and both queues close through protected PRs. T144's
purge endpoint/call retirement remains a separate, owner-authorized follow-up, not part of this cleanup.
