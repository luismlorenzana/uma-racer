# First playable RPG — release acceptance

T099 release, 2026-10-04. The owner explicitly authorized Codex to publish, merge and release, then accept
improvements from production play (D257). This overrides the pre-merge physical-iPhone gate; it does **not** mean
device or real-account gameplay checks have passed. Home availability, saved-party resume and the nine-page guide
change no combat, EXP, skill, reward or token-debt numbers. T099/M028 retire with this standing checklist retained.

Code/deployment identity: [PR #88](https://github.com/luismlorenzana/uma-racer/pull/88). Its final merged build,
deployment workflow and hosted smoke results are recorded on the PR after deployment. Settings must show that
merged build id; publishing content by itself does not deploy code.

## Private publication — complete

The [private publication record](rpg-private-ura-handoff.md) names the ignored source/cache and immutable pack.
Codex reimported it into `/Users/luismartinez/workspace/uma-racer/content` using cached verified portraits,
validated the combined tree and published through the existing scoped private-bucket command:

- Pack version `ura-priconne-v1`, SHA-256 `344facafc402061e24c6cc66dc885b8ca80a5aa55c6a6777bd04e00d67a13a7f`.
- One chapter, ten nodes, five battle nodes, eleven actors, seven characters/portraits and zero unresolved references.
- Twelve deterministic route/seed clears, 42 fights and 42 restored-state hash matches; twelve boss phase shifts.
- Invented base-100/no-growth entrants end Lv11–12; mean 5.86 rounds. This is not a real-outfit balance sign-off.
- Local partial manifest `69cfea84822d` is **not** a production manifest version. Never publish this task worktree's
  RPG-only manifest as the game's complete content manifest.
- Complete production manifest **`56f02305d0ee`**, replacing `e268e2f353a0`: **2,064 files, 57,580,630 bytes**.
  All 2,055 previous file paths/hashes are unchanged; nine added objects total 169,142 bytes. Dry run and real
  publication agree: 9 uploaded, 2,055 already present; manifest uploaded last and read back at the expected version.
- Signed-in production Settings shows **`56f02305d0ee · network`**, with existing Uma/card/race/atlas coverage intact.
  The release Home gate additionally verifies real chapter/portrait bytes before opening the hub.

No credentials, original rows or portraits belong in git. Physical play and real-account rewards/spends are deferred
below, not inferred from publication. The authenticated desktop session inspected during release had a pre-existing
Farm projection sync error and 134 pending ordinary changes before T099 deployed. Its save/outbox were preserved;
no reset, forced snapshot adoption, enrollment or reward-spend mutation was used to manufacture a clean test account.

## Implementation and automatic checks

Home inspects only manifest filenames before a tap. Entry lazy-loads and validates the actual active production-v2
URA chapter plus every referenced portrait, not a saved boolean. Failure shows unavailable/retry and mutates no save.
Direct new chapter attempts use the same verifier; an existing checkpoint still resolves its exact retained identity.
The hub projects five presets and each foreground checkpoint; it never creates an attempt merely by showing a card.
The guide covers five distinct members, locked A-style/weapon, A/B elements, MP, channels/weakness, support/KO,
offline/retry/takeover, EXP/tree/promotion and both scenario token families including advance repayment/mirrored SP.

- `pnpm lint`, `pnpm test`, `pnpm build`: pass; 1,092 tests (423 web), no added dependencies.
  Startup JS 152.33 KB gzip; RPG hub 13.45 KB, map 5.35 KB, battle 9.77 KB, shared guide 5.05 KB (Vite's decimal KB).
- `pnpm sim:rpg:progression`, `pnpm sim:rpg:combat`: passing; two-tier promotion/catch-up and combat replay envelopes.
- `pnpm sim:spark`: passing after the shared guide's contextual-first-paint adjustment.
- `pnpm sim:training -- --content=<existing-ignored-content/data>`: passing aggregate-only card-training check.
  Plain `pnpm sim:training` first failed because this isolated code worktree has no private `content/data`; no packs
  were copied into git or fabricated to bypass that dependency.
- Release tests cover absent/legacy/no-URA/corrupt-art/offline content, retry without fallback, click deduplication,
  resume labels, all guide pages, contextual first paint and newer-checkpoint refresh preserving queues/journals.
- Existing host/API suites cover long journals, same-seed retry, lease takeover/stale commit rejection, duplicated
  receipts, pending-versus-accepted EXP/Items, shared-preset Inspiration spends/mirrored SP and debt repayment.

## Browser evidence — invented data, not production acceptance

Use DEV-only `/dev/rpg-release-proof` for the read-only hub/guide projection and `/dev/rpg-chapter-proof` for the
real hosts over separate synthetic client/account databases. Both are excluded from the production route graph.
Every captured screenshot contains invented data and missing-art placeholders; none contains private character art.

At 390×844 and 375×667, verify the hub/guide, map fork, battle, result, promotion and Inspiration spend. Battle
document bounds must equal the viewport, while its formation/result and normal menus may scroll internally. Enabled
controls must be at least 44 pt; weapon/element/HP/MP/intent/weakness labels remain usable without color. The shared
guide traps focus, makes the underlying screen inert and restores focus on close. Browser labels do not establish
physical VoiceOver behavior, touch latency, Home Screen background handling or a real two-device acceptance.

Observed in this browser pass: first guide page and contextual map/battle entry, focus isolation/return, unchanged
mid-fight action 1 and enemy HP 64/180 after refresh, reduced-motion boss phase 1→2, held-acknowledgement result
remaining unearned, accepted five-outfit EXP, map Skill/Slot collection and unchanged token totals after clear reload.
The isolated Lv50 probe confirmed explicit legacy/discard, 657 banked EXP applying to Tier 2 Lv5 (17 EXP left),
stats 154→161, a fresh tree and retained legacy skill. Loss/retry/takeover/long-journal behavior is covered by the
existing host/API tests; its real-device/private-content repetition remains open below.

| Synthetic screen | 390×844 | 375×667 |
|---|---|---|
| Saved-party hub | [Image](screenshots/rpg-release/hub-390.jpg) | [Image](screenshots/rpg-release/hub-375.jpg) |
| Guide | [Party page](screenshots/rpg-release/guide-party-390.jpg) | [Class page](screenshots/rpg-release/guide-class-375.jpg), [token page](screenshots/rpg-release/guide-tokens-375.jpg) |
| Map fork | [Image](screenshots/rpg-release/map-390.jpg) | [Image](screenshots/rpg-release/map-375.jpg) |
| Mid-fight | [Image](screenshots/rpg-release/battle-390.jpg) | [Restored fight](screenshots/rpg-release/battle-375.jpg) |
| EXP result | [Acknowledged](screenshots/rpg-release/result-390.jpg) | [Pending](screenshots/rpg-release/result-pending-375.jpg), [clear tokens](screenshots/rpg-release/clear-375.jpg) |
| Promotion | [Image](screenshots/rpg-release/promotion-390.jpg) | [Image](screenshots/rpg-release/promotion-375.jpg) |
| Inspiration token cost | [Slot preview](screenshots/rpg-release/inspiration-slot-390.jpg) | [Slot preview](screenshots/rpg-release/inspiration-slot-375.jpg), [gold bank](screenshots/rpg-release/inspiration-gold-375.jpg) |

Inspiration previews are intentionally read-only: confirmation shows the independent cost but cannot spend. The
real token-spend acceptance is not claimed by these images; grouped host/API spending tests and the owner protocol
are separate evidence. All images are invented fixtures, never private character portraits.

## Owner production/iPhone protocol — post-release feedback

1. Record deployed build commit, published manifest version/hash and phone model/iOS. Open the literal production
   Home Screen app, tap **Update ready → Restart** if offered, then confirm Settings shows the new build/content.
   A failed content check must leave the real save unchanged and show an actionable retry, never invented enemies.
2. Enroll five owned outfits with eligible A styles, confirm the permanent weapons, fill/save one preset and switch
   away/back. No Front/End quota; enrollment/preset rows must say pending until account acknowledgement. Open every
   guide page from the hub; battle starts the same guide on the action page, map on checkpoint rules.
3. Launch URA, preview both fork teams/intents and a low-level warning if applicable. Enter a fight, spend MP, use
   guard/healing and a weakness. Check five portraits/overlays, text alternatives, targets and thumb-zone controls.
   At each size check reduced motion and VoiceOver. Long-fight coverage must not add battle document scrolling.
4. Background/foreground and reload mid-turn. Same device restores the action prefix, HP/MP and enemy kit.
   Disconnect, finish a fight and confirm provisional EXP/tokens are visibly pending and not spendable; reconnect
   and submit/accept once. Reopen result/reconnect again: no second grant, checkpoint movement or debt repayment.
5. On a second device explicitly take over that same frozen fight; confirm the warning/restart and that the first
   device cannot commit. Missing journals or retained pack recovery must never create a friendlier encounter.
6. Lose or explicitly abandon, then retry free: same seed/kit/party, no loss reward. Finish both fork variants and
   boss, then accept the map reward. Voluntary replay after clear creates a new attempt, not duplicated clear receipts.
7. Inspect all five EXP/stat/tree-point reveals, set up a learned skill at a safe checkpoint and verify the next
   entered fight uses it. Open/pending fights keep their frozen setup. If an outfit is legitimately Lv50, manually
   promote with explicit point discard/legacy choices; stats and bank cannot decrease. Never edit the owner's save
   to manufacture a promotion test; the isolated proof and progression sim cover this until a real outfit qualifies.
8. Check global Items and the temporary Inspiration bank. Gross grants first repay matching scenario/family debt;
   only overflow adds spendable Items. Pre-existing Item stock stays available. Unlock a still-locked lineage slot
   and gold position on a unit outside the frozen advance cohort once tokens are available; no re-charge for already
   open positions. All four distance presets share those unlocks and bank. Verify one-side grandparent Unique/gold
   2× SP, exact opposite-side mirror normal SP and a cheaper own/card/parent source winning the price comparison.
9. Confirm Racing/Training/Farm progress and currencies did not change except explicit Inspiration choices; note
   any layout, input, resume, real-outfit difficulty or reward issue. Keep private account/character details outside
   git; record only aggregate pass/fail, immutable pack identity, build and owner confirmation here/in the PR.

## Release evidence and deferred acceptance

- [x] Complete private content published; signed-in production manifest version verified; immutable pack hash recorded.
- [x] Owner explicitly authorizes production-first merge/release (D257), without waiting on Claude or device sign-off.
- [x] T099/M028 specs retired under D104; standing rules and this deferred acceptance protocol retained.
- [ ] Final merged CI/deployment green; hosted build/health/auth-guard and live Home portrait gate verified (record on PR).
- [ ] Real-content normal fight/loss/retry/fork/boss, EXP/skills, idempotent rewards and Inspiration spend accepted.
- [ ] Real-device offline/background/reload and explicit second-device takeover checked.
- [ ] Owner physical-iPhone sign-off recorded, separately from synthetic browser/screenshots/tests.

The remaining thirteen chapter publications are M029; closing this first release does not claim 14/14 coverage.
