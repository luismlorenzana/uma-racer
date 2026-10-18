# SB6 · shared album acceptance

The packet adopts the published uma-kit album, not a local copy. The dependency's compact Filter button had lost its
accessible name; [uma-platform #28](https://github.com/luismlorenzana/uma-platform/pull/28) fixes that upstream and
published 0.7.1. SB6 pins it. No game rules, save shapes, content packs or infrastructure change.

## Reproduce without private content

Start the web on your own port, then open
`/dev/seeds/town/stable?seed=busy&art=synthetic`. `art=synthetic` is a dev-only proof using invented SVG faces and
busts through the real racer `AlbumArtProvider`; it never reads private content, owner saves, auth or the network.
The ordinary seeds still fall back to initials. `fresh`, `gate` and `promote` also work. All committed evidence is
synthetic; production art and account screenshots must stay outside git.

For current acceptance, use the desktop browser at phone width, in light and dark. On 2026-10-18 the owner removed
Simulator validation entirely (uma-platform P60) and requested local validation followed by a successful production
deployment. The earlier Simulator observations below are historical evidence, not a remaining release gate. The
owner checks physical-phone edges after deployment.

## Automated checks

- `pnpm lint`, `pnpm test`, `pnpm test:ci`, `pnpm build`, `pnpm docs:update` pass.
- Startup locally: **153.62 KB gzip / 180 KB**, including SD4's shared frames. The release workflow measured
  **154.07 KB** in CI and **154.11 KB** for the deployed build (production API URL), both below budget.
- Compatibility fixtures read the old query, saved views and seen ids at `uma-racer:g2:album:stable`, and write back
  to that same key. No save migration or schema change.
- Art tests cover per-character face ids, per-outfit bust/chibi ids, outfit-icon fallback after invalid art, hold
  before load, release on unmount and no previous-outfit flash. Race tests deduplicate verified bust loads while
  preserving runner order, including repeated outfits and absent/invalid images.
- Real-route regressions cover unlock/reveal (single and multiple), NEW, profile order, work and Lineage context
  sorts and refusal words, Farm preselection and Free-only eligibility, and Racing's reversible Open goals filter.
- The Options regression opens a busy Uma, closes back to the picker, reopens Options, and chooses Recall. The
  original Recall confirmation opens; no receipt is written and her job remains intact until confirmation.
- The source-reach check from `src/main.tsx` passes. Album-only `Numeral` and the unused `useArtSet` export retire
  with their last consumer. PixiJS is still imported only by the race scene; no race module requests chibis.

## Acceptance record

### Simulator, 2026-10-17–18

The installed Home Screen app shows five face columns, three bust-card columns and one list column. The top and
bottom bars fit the safe areas with no Safari controls. Filters apply and clear correctly; the sort sheet keeps the
six racer sorts. Profile busts, round selected faces, work rows and Town Hall pips load through the real art port.

| Context | Verified |
|---|---|
| Stable | Icons, Cards and List in light; tier/target badges; planner facet and Clear all; sort sheet; profile navigation |
| Training session | Five face columns in light/dark, descriptions and selection, round selected Uma, unchanged unlock setup |
| Farm | Dark Free-only picker, Farm Level order, suited tie, selected worker; changing her retains the job and correctly disables a grade above her Farm Level |
| Racing | Dark picker with level order and work descriptions, selected control; pre-race bust, actual PixiJS runner busts, finishing order and result hero; Races returns to the list |
| Trophy Hall | Selected face, light picker and selection marker |
| Card Library lens | Light five-face picker and selected marker; library still has its own card tiles and scenario lens |
| Bond | Dimmed unavailable candidates with the original scenario refusal, light/dark shared frame |
| Featured Uma | Dark picker, current featured Uma refused and labelled, another synthetic Uma selected successfully; only the plaza renders chibis |
| Dev grants | Dark picker on the synthetic account, using the same album; no real account touched |

Evidence (all invented content): [Stable](stable-light.png), [Cards](cards-light.png), [List](list-light.png),
[session](session-picker-dark.png), [Farm](farm-picker-dark.png), [race](race-dark.png), [results](result-dark.png),
[Library lens](library-picker-light.png), [Bond](bond-picker-dark.png), [featured](featured-picker-dark.png),
[dev grants](dev-picker-dark.png), [Trophy Hall](trophy-picker-light.png).

### Local browser, 390×844 (rechecked 2026-10-18)

Icons show five face columns, Cards three bust columns, and scrolling reaches the final owned row above the dock.
Search narrows the Stable to the named outfit. Saved views save under the same existing device key. The real
Lineage flow was played on the in-memory account: grant synthetic dishes through Account, start Slot A for Ember
Stride, finish it through the dev UI, collect, open her profile and Lineage, then Fill A. Its shared picker shows
the proper contribution descriptions and excludes her; selecting Amber Sprint still runs `set-lineage`.
[Lineage picker](lineage-picker-390.png).

### Released, 2026-10-18

The owner waived the unfinished Simulator Lineage/scrolling pass on 2026-10-18 and requested local validation only,
then deployment confirmation (P60). Browser coverage and the automated regressions above remain the acceptance
evidence. [Feature PR #120](https://github.com/luismlorenzana/uma-racer/pull/120) merged through protected main as
`4885baf762ad5256f5af2fa394fed30beed3db96`.

The standard [production workflow](https://github.com/luismlorenzana/uma-racer/actions/runs/39145322463) succeeded
for that exact SHA: fresh lint/tests/build, API image and Cloud Run deployment, API readiness and auth checks, web
build, Firebase Hosting deployment and hosted-app checks. Independent read-only smoke checks afterwards returned
API health `ok`, unauthenticated `/api/save` **401**, and Hosting **200** with `cache-control: no-cache`.

SB6 is Done under this acceptance policy. Its packet is removed and both queues record the feature merge hash.
Signed-in production UI, physical-iPhone edges, touch scrolling and VoiceOver feel are owner checks, not claimed
here. This change touches the album, picker sheets and race portraits; the owner should check those edges on phone.
