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

Install from Simulator Safari: ⋯ → Share → View More → Add to Home Screen, keep **Open as Web App** on, then launch
its Home Screen icon. Validation device: iPhone 17 Pro, iOS 26.4. Repeat in light and dark. The initial **SB6 Racer**
install checked the Stable's edges; the later **SB6 Album** install used a localhost-only proxy on 5187 with a
synthetic manifest (`scope: /`, start URL the seed above), forwarding the worktree's Vite on 5186. This keeps all
place routes in the installed app instead of opening out-of-scope routes in Safari. No production config changes.

## Automated checks

- `pnpm lint`, `pnpm test`, `pnpm test:ci`, `pnpm build`, `pnpm docs:update` pass.
- Startup: **153.62 KB gzip / 180 KB**, including SD4's shared frames.
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

### Browser supplement, 390×844

Search narrows the Stable to the named outfit. Saved views save under the same existing device key. The real
Lineage flow was played on the in-memory account: grant synthetic dishes through Account, start Slot A for Ember
Stride, finish it through the dev UI, collect, open her profile and Lineage, then Fill A. Its shared picker shows
the proper contribution descriptions and excludes her; selecting Amber Sprint still runs `set-lineage`.
[Lineage picker](lineage-picker-390.png).

### Remaining release gates

The Mac locked during the final native Lineage check. Its Home Screen check (and finishing the phone scrolling
pass) requires the owner to unlock the Mac; browser and regression coverage do not replace that gate. The feature
PR remains in draft until then. Production deployment/verification and both packet-queue closeouts follow that
acceptance. The owner's physical iPhone and VoiceOver feel remain separate owner checks.
