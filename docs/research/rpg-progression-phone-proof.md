# T096 — acknowledged RPG progression phone proof

Recorded 2026-10-03 at **390×844** and **375×667** in the browser preview. These are invented outfits, opponents
and portraits, not extracted Uma/PriConne rows or art. Rules: [RPG progression](../design/uma-rpg.md#settled-t096-encounter-exp-and-checkpoint-choices-d246),
D246. This is an internal vertical slice, **not** the M028 real-content/Home release.

## Reproduce safely

Run the web dev server and open `/dev/rpg-chapter-proof`. Its real chapter, battle and progression hosts use only
`uma-rpg-chapter-proof-v1` plus its separate simulated-account database. DEV → Reset this proof only touches
those disposable rows. No actual account mutation or private content publish occurs. The standalone T094
`/dev/rpg-battle-proof` remains an unrewarded practice journal.

1. Start Invented crossroads, enter Opening challenge, use two Attack actions to win. In DEV tools enable **Hold
   account acknowledgement** before Submit result. All five preview +1,549 EXP, Lv10→14, levels 11/12/13/14,
   all five stats 94→100 (+6), +2 points, four slots and 333 remaining EXP, explicitly **unearned**. Refresh
   preserves this pending identity and preview. No profile/point/promotion spend link is offered.
2. Disable Hold and acknowledge queued commands. The same five grants become accepted once. Return to map,
   Accept win, then open Ember · profile & skills. She has acknowledged Lv14/333 EXP and six available points
   (seven earned, one foundation already learned). Learn Fire · Area: points fall to five only after ACK.
   Select that skill with the foundation, Save loadout, refresh; both references remain equipped. A refresh
   before ACK instead shows the pending block and the previous acknowledged loadout, not a provisional choice.
3. Continue Crossroads → Quiet camp → Captain approach → Captain finale. On a fresh proof's Attack-only route,
   the boss wins in six saved actions/two rounds. Each Lv14 frozen entrant earns **2,091** tapered boss EXP,
   crossing Lv15–20 with 120 EXP left and five slots. Accept boss clear and reload the profile: still Lv20/120,
   with nine unspent points. No hidden chapter-clear EXP, Items, tickets, race/Training/Farm/card progress.
4. DEV → Reset proof to Lv50 promotion seeds only invented profiles with 657 banked EXP. Review Tier 2,
   select the foundation as legacy and explicitly discard 24 unspent tier points. Preview shows Tier 1 Lv50 →
   Tier 2 Lv5, 17 EXP left and all five stats 154→161. Confirm, then refresh: Tier 2 Lv5/17, empty fresh tree,
   two new points, three slots and the selected Tier 1 foundation still equipped. Automated tests additionally
   perform two promotions and verify omitted legacy pruning is rejected at the save boundary.

## Phone and accessibility checks

- Result and editor content scroll inside the shared shell; there is no horizontal page overflow at either size.
  All observed buttons, links and selects meet 44 px targets; checkbox labels provide the full 44 px row.
- All five entrant cards reveal exact crossed levels, five before/after stat values, points, slots and bank. Pending
  and acknowledged headings differ in text, not just color. Signature/weapon overlays use frozen party identity.
- Promotion fits both viewports, or scrolls internally for a larger learned roster. It contains focus, makes the
  background inert, restores focus on close and supports Escape; unit tests exercise these behaviors. No promotion
  is enabled until required choices are valid. Repeated submissions cannot buy two points.
- Reveal animation uses `m.article` under strict LazyMotion, transform/opacity only. Reduced motion and pending
  previews skip entry animation. Browser console checks found no RPG warnings/errors. The simulated transport is
  not production networking; integration tests use the actual grouped API parser/resolver, not that test server.
- **Not verified here:** physical iPhone touch/safe-area/VoiceOver, real private chapter balance/portraits, a live
  production RPG save. These remain the T097 content and T099 owner-device/release gates. Home stays unchanged.

## Screenshots

| View | 390×844 | 375×667 |
|---|---|---|
| Pending, unearned EXP | [capture](rpg-progression/t096-pending-390x844.jpg) | [capture](rpg-progression/t096-pending-375x667.jpg) |
| Accepted five-outfit reveal | [capture](rpg-progression/t096-result-390x844.jpg) | [capture](rpg-progression/t096-result-375x667.jpg) |
| Safe-checkpoint skill setup | [capture](rpg-progression/t096-skills-390x844.jpg) | [capture](rpg-progression/t096-skills-375x667.jpg) |
| Bank and legacy promotion preview | [capture](rpg-progression/t096-promotion-390x844.jpg) | [capture](rpg-progression/t096-promotion-375x667.jpg) |
| Accepted next-tier profile | — | [capture](rpg-progression/t096-promoted-375x667.jpg) |

## Verification

`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm sim:rpg:progression` and `pnpm sim:rpg:combat` pass. Tests cover
fixed replay hashes, five distinct frozen entrant levels, KO winners, zero loss/abandon, level-relative catch-up/replay,
multi-level gains, bank/overflow, two promotions, lost acknowledgement/idempotency, profile-only reconciliation,
checkpoint/lease conflicts, invalid point/slot edits and atomic preset pruning.

Final suite: 977 tests (domain 435, web 366, API 55, race 61, data 35, assets 25). One initial full run exposed an
existing Blob-URL allocation-order assumption; its assertion now checks the correct atlas page independent of
concurrent download order, without changing the loader. A second run exceeded the unchanged race test's local-only
250 ms timing budget under concurrent load; the final idle rerun passed. No race timing rule was changed.

Production startup entry: **151.90 KB gzip**, below 180 KB; lazy RPG setup/profile **12.23 KB**, battle **10.58 KB**,
chapter **10.01 KB**, shared battle host **9.56 KB**. Spark chunk **18.08 KB**. DEV proof code/fixtures are absent
from production. No new dependency, root-save/Dexie migration, infrastructure or private content change.
