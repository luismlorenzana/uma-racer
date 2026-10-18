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

Install from Simulator Safari: ⋯ → Share → View More → Add to Home Screen; name it **SB6 Racer**, keep **Open as Web
App** on, then launch its Home Screen icon. Validation device: iPhone 17 Pro, iOS 26.4. Repeat in light and dark.

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

## Acceptance record

Simulator and production results are recorded here as validation finishes. The physical owner's iPhone and
VoiceOver feel remain owner checks, separate from the Simulator and browser evidence.
