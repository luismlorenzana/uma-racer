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
