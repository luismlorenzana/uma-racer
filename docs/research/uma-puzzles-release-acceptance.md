# Uma Puzzles — release acceptance

Follow-up: [T109 owner-export art acceptance](puzzle-art-release-acceptance.md) records the subsequent private cutout
upgrade (D292). The T116 placeholder-release evidence below remains a historical snapshot.

T116 / M030, 2026-10-08. D289 authorizes verified **original-placeholder enemy art** for production; D290 closes
release tuning, Home entry, backup and protected activation. Permitted PAD art remains the later T109 upgrade.
This record separates code/content/application evidence from owner gameplay and physical-device acceptance.

## Application witness

Latest upstream reviewed: `0879ce5a4a1f1cca84261f07659a7169b9c97dc5`, including D288's preset-loading feature.
[Release PR #102](https://github.com/luismlorenzana/uma-racer/pull/102)'s final verification and **post-deployment witness comment** identify the exact merge SHA, successful
API/web deployment run, public build stamp and shipped asset sizes. A merge alone is not deployment proof.
The source commit cannot contain its own future merge SHA; the linked PR witness supplies it after release.
No workflow, infrastructure, production env, dependency or credential configuration is changed.

Both checked-in API/web capabilities are enabled. Verified compatible retained content and an active bank remain
mandatory. The real host is installed lazily by GameRuntime, never a double. Home discovers the pack cheaply and
verifies account/content on entry. Missing/corrupt content or failed preparation exposes Retry without granting
progress or clearing storage. Production DEV proofs are tree-shaken out.

## Private publication — passed

The normal complete-tree publisher ran before activation, not an ad-hoc bucket upload:

| Witness | Value |
|---|---|
| Previous manifest | `56f02305d0ee` |
| Published manifest | `3717d876c9b2` |
| Cast version | `original-placeholders-v1` |
| Cast SHA-256 | `9adca1abf0468618d218aee5959896aa49dcb1a2fadaa4324fc54f846ef9f0cf` |
| Atlas descriptor SHA-256 | `488cd63d7c2a7a31f8d6fdf2d40a0f495e69c3297623c70ff73c0faeceb82556` |
| Atlas page SHA-256 | `d6a63a2c6bdcdea629f1e712e0145171853edf9388f5d65434017beea506641f` |
| Catalog SHA-256 | `cc8a4b3626ebdd8b1b391c28cc92ea3c0b31bef9e56bc3dd818004d0a63399d8` |
| Retention | all2,064 prior objects unchanged;2,068 total |
| Upload | four objects,104,369 new bytes;57,684,999 total bytes |
| Publisher duration |22.36 seconds |

The remote manifest was independently reread; all prior path/size/hash tuples match. All four new remote objects were
independently downloaded and hashed, matching the manifest. No unrelated private roster rows were read or committed.
15 original members/transparent256px frames cover five colours × Scout/Guardian/Champion, all392 nodes across14
chapters and both Dark champion reward variants. Source is repo-original SVG code, not an alleged PAD export.
The provenance discriminator and visible labels are explicit; no missing-art gameplay fallback exists.

Authenticated **owner production runtime** acceptance remains pending below. Bucket checks, native pipeline tests and
the verified-content/client→host integration are passed, but they are not an invented signed-in iPhone result.

## Commands and balance — passed

Node22+ / pnpm10. `pnpm lint`, `pnpm test --concurrency=1`, `pnpm build`, `pnpm sim:puzzles`,
`pnpm sim:puzzles:preservation`, `pnpm sim:spark` and `pnpm sim:training` pass.
Serial package execution runs the same tests without competing with build/sim CPU; no test thresholds are loosened.
Final rebased tests: **1,481 passed** (domain700, race61, API82, web558, data44, assets36).
Lint passes all six packages; web/API builds and the production CommonJS enabled-capability import pass.

- Puzzles:288 historical engine battles,640 campaign probes (40 no-active champions) and86,016 economic routes.
  Every intermediate JSON-roundtrip replay hash matches. Historical T107 formulas/hashes remain unchanged.
- D290 recipes: ordinary HP6A/damage0.30H/open1; guardian32A/0.66H/open1; champion48A/0.58H/open2; countdown2.
  Pure rules, design, domain pin, API mirror and exact107-row sim envelope agree.
- Mixed ordinary clears7–8/8, guardians7–8/8, champions6–7/8. Champion minimum HP15.0–20.7%, median7–8.5 drags;
  no-actives champions clear1/8 in every colour. Ending HP can be high after Heart recovery; it is not the pressure
  measure alone. Neutral and mono-counter rows are separate, not averaged into mixed results.
- Visible small-policy outliers include counter Fire vs Wood champion3/8 and first counter ordinary4/8.
  PL50/140 probes clear4/4 in10 drags with minimum12.1/11.1% HP. These are bot samples, not player success probabilities
  or real-phone rewards/minute. See [full release rows](../design/uma-puzzles.md#t116-release-scaling-and-small-sample-closure-d290).
- Economy:54 primary-route gross,132 full-map gross,14 chapters, all13 adjacent edges, two-chapter PL,
  source-A recipient allocation and required targeted boss repeats remain pinned. Debt and real lost fights are
  not hidden inside the accepted-win allocation estimate.
- Retained Spark:900 seeds,77% overall clear,60 Drive at clear, leading-style gap4%; regression pass.
  Friendship:240 seeds/row;1★93%,2★78%,3★74%, twist rows77–84%; existing envelope passes.

## Bundle and browser evidence

Rebased release entry: **154,342 bytes gzip** (limit180,000). Lazy individual Hub1,631, map5,574, battle screen4,082,
battle stage5,145, Pixi battle scene5,087, retained Spark18,150, Pixi core85,298 bytes. These are **individual chunks**,
not total network download or the entire Pixi family. Deployed numbers/build stamp are in the PR witness.
Firebase and Pixi remain lazy.

Browser proofs use a web-only local server without the API and explicitly separate `puzzle-proof-*` IndexedDB.
All outfits, debt, wins and portraits in screenshots are invented; no owner save is opened or rewards granted.
The cast preview uses the exact production original-SVG source. Battle shots use older original DEV sprites,
not a claim that those synthetic names/images are the production cast.

| Screenshot | Proof |
|---|---|
| [Home390](puzzle-release/t116-home-390.png) | actual Home card, visible placeholder label, full44pt action |
| [Original cast390](puzzle-release/t116-placeholders-390.png) | five colours/glyphs, original Scout presentation |
| [Hub390](puzzle-release/t116-hub-390.png) | saved five-member parties, independent PL and separate repayment bank |
| [Map390](puzzle-release/t116-map-390.png) | explicit branches, reached/won states and real material vocabulary |
| [Battle390](puzzle-release/t116-battle-390.png) | intent, HP, board, charged skills and thumb controls |
| [Battle375](puzzle-release/t116-battle-375.png) |375×667, no page/horizontal scroll; same saved fight after refresh |
| [Result390](puzzle-release/t116-result-390.png) | isolated replay-backed win, gross12 → debt7 repaid → Items+5 |

Measured mid-fight DOM dimensions equal390×844 and375×667. Controls are44pt or larger. Refresh retains
drag6/30, HP4,085/8,900, enemy HP/countdowns, board and active charge. This proves browser layout/replay, not
physical touch latency, safe-area feel, low-power thermal behavior or60/120Hz pacing.

## Preservation and recovery

Expected effects on the first updated online account sync are authorized release effects, not manual smoke rewards:

1. Verify replacement content, drain outgoing state and capture the canonical **whole account plus old local journals**
   in a device-only archive before any protected request. A fetch/parse/write/identity/pending-write failure blocks freeze.
2. Resolve already-terminal pending Spark journals before freezing. Close unfinished paid Spark runs and refund their
   original ledger cost once, bypassing the daily storage cap. Never give both EXP and a refund for one terminal run.
3. Freeze existing outfit/scenario units once. Preserve their earned CL, all four presets, global card stars, lineage,
   Extra stats, race history/badges and other modes. Debt is CL−1 once per unit under one original-A style, not per preset.
4. Clear only unapplied old EXP. Pool unit/account EXP at1,250 per Legacy Universal CL Ticket, rounding one positive
   account remainder once, retain original universal stock and bypass material debt for this migration credit.
5. Activate save16/zero retired EXP and material-driven CL. Future units begin CL1 outside the old debt cohort.
   No ongoing universal mint, free CL10, scenario unlock, outfit deletion, Inspiration/Farm mutation or RPG reset.

The preparing device retains `puzzle-preservation-backup-v1`; Settings/Hub/recovery explicitly download its private JSON.
Other devices must use that device for the backup. Keep it private; no account JSON belongs in git.
Retry resumes protected receipts/lost acknowledgements, never resnapshots or duplicates credit. Retained missing
content/journals are repaired explicitly; old clients must update and reconcile rather than force-upload old EXP.
Do not clear IndexedDB or partially restore fields. After economic mutation, reverting just the frontend is unsafe;
use forward recovery or owner-authorized whole-account restore with all devices quiescent.

Synthetic rehearsal:40 units,180 debt,15,983 pooled EXP; original3 universals→13 credited→16 stock; one unfinished
paid run refunds5 daily tickets. Interrupted retry, whole pre-freeze restore and post-final restore without recredit pass.
Backup failure/identity/outgoing-write cases block mutation. Real content-verified host integration resumes offline,
commits exactly once, repays matching debt, adopts authority and spends its earned stock into actual nodes while
preserving builds. Existing loss/abandon, rejected offline spend, corrupt journal, content-version hold, takeover,
rollback and other-mode regression tests pass.

## Owner production/iPhone protocol

**Pending owner acceptance**, deliberately after production release. The agent performs no hidden account spends,
grants, enrollments or battle wins to manufacture this evidence.

- Reopen production online, accept **Update ready → Restart** if offered; confirm Settings build/content3717d876c9b2,
  successful preparation and privately download the backup. A visible preservation failure means Retry, not Clear data.
- Home→Uma Puzzles→Roster: enroll five owned outfits, choose eligible elements, fill a party and choose URA Finale.
  Confirm real original placeholders, party persistence and guide/practice before the first fight.
- Win one ordinary battle. Check five outfit EXP awards, gross material→matching debt repayment→net global Items,
  map clear and refresh. Existing debt can make net stock zero: that is repayment, not a missing reward.
  Puzzles spend no daily Training Tickets and grant no racing EXP, cards, crops or Inspiration.
- Suspend/reopen mid-board (also offline), verify the same board/HP/intents/charge, finish/reload without duplicate
  rewards and reconnect. Test loss/retry/abandon without erasing old wins.
- Defeat a Guardian/Champion; choose Dark Pace/Late before entry. Inspect targeted stock, both exchange directions
  after the higher Opening gate, and the irreversible repayment preview before confirming.
- In Profile/Training/Constellation spend one eligible scenario/source-A ticket (or explicitly selected universal).
  Confirm shared CL across four presets, real named nodes and SP/stat deltas; old configurations and the new D288
  previous-scenario Load feature remain usable. Check another race, Friendship, Farm and RPG afterward.
- If a second device is available, use explicit online same-seed takeover; the displaced device must not settle again.
  Real account receipts/ledger arithmetic, actual authenticated cache and cross-device acceptance remain pending.
- Physical touch: fast/long/edge/diagonal/revisited drags, first-swap clock expiry, lost capture/multi-touch,
  guide cancellation, background/lock/resume, portrait rotation, installed PWA safe areas, plain/chibi glyph
  legibility, reduced motion, sustained play/low-power mode and60/120Hz timing. Browser screenshots do not sign these off.

Report actual party levels/colours, encounter and failure/success symptoms; no private account JSON or tokens needed.
Device checks join T038's standing owner pass. Later permitted PAD art is optional T109, not unfinished release code.
