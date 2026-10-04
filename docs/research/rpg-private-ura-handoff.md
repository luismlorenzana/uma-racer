# First private URA RPG chapter — owner/Claude handoff

Prepared on 2026-10-03 under T097 (D248). **Not published and not a playable-release sign-off.** This report
contains only aggregate coverage and immutable identity, not extracted character rows or art. The standing
schema, commands and per-chapter checklist are in [RPG chapter content](../technical/rpg-chapter-content.md).

## Prepared private files

The isolated worktree is `/Users/luismartinez/.codex/worktrees/uma-rpg-design/uma-racer`.
Its ignored `content/overrides/` holds `rpg-chapters.json`, `rpg-source-evidence.json` and the private
`author-rpg-ura.mts` authoring helper. Imported objects/catalog are under ignored `content/data/` and
`content/art/priconne/`; source images are in ignored `scripts/assets/.cache/priconne/`. Keep these files until
the owner has transferred/reimported them into the canonical private content workspace; do not archive this
worktree and lose ignored files. No original-content file is part of the PR.

| Identity / coverage | Result |
|---|---|
| Required pack version | `ura-priconne-v1` |
| Required full pack SHA-256 | `344facafc402061e24c6cc66dc885b8ca80a5aa55c6a6777bd04e00d67a13a7f` |
| Chapter / recommendation | URA Finale, Tier 1 Lv1 |
| Graph | 10 nodes, 5 distinct battle nodes; 3–4 fights on a full route |
| Cast / combat variants | 7 playable characters, 11 adapted actors |
| Actions / phase actors | 19 actions including phase actions, 1 phase-changing boss actor |
| Portraits | 7/7 verified official-page fantasy-panel variants; 153,844 encoded bytes |
| Unresolved references | 0 |
| Bounded private replay | 12/12 route-and-seed clears; 42 fights, 42 matching restored hashes |
| Boss shifts / pacing | 12 shifts; 5.86 mean rounds; invented entrants end Lv11–12 |

The official [directory](https://priconne-redive.jp/character/) and selected character pages were checked in the
browser. Its SPA panels point to the official linked CDN; the importer validates recorded exact variants and
decodes actual downloaded bytes. Every combat number, role, affinity, intent and phase was authored for Uma RPG,
not extracted from PriConne's combat system. Required fork teams differ tactically (guard/heal versus caster
pressure); optional elite adds encounter EXP, not a clear token. The boss changes protective play to elemental
pressure. Full HP/MP resets remain the existing engine rule.

Replay entrants have invented base stats 100, no growth and five different weapon paths. Foundation techniques
unlock when points become available. This bounded check establishes roughly ten levels and replayable fights;
it does **not** settle difficulty for real account outfits, all compositions or physical iPhone play.

## Publication handoff — still required

1. Owner/Claude reviews private teams/variants and adapted kits, then copies the two override JSON files into the
   canonical ignored `content/overrides/`. Keep the version immutable; edits require a new version.
2. In the complete canonical private content workspace run `pnpm assets:rpg:import`, `pnpm data:rpg:import`, then
   `pnpm data:rpg:validate --replay`. Expected identity/coverage are above. The source cache may be transferred
   privately to permit `pnpm assets:rpg:import --offline`.
3. Run the existing full-content publication dry run and publish as owner/Claude. The task worktree's partial
   manifest contains only RPG objects: **never publish that partial manifest as the game's complete manifest**.
   The full manifest version will differ after combining existing Uma/cards/races/Spark packs.
4. Record the published manifest version and verify the exact pack hash via authenticated `/api/content/*`.
   Play both forks/elite choices through the real runtime, including accepted EXP and checkpoint reload.
5. T098's token bridge and T105's Inspiration advance are implemented. T099's candidate Home gate, saved-party
   resumes and full guide are under verification; [release acceptance](rpg-release-acceptance.md) still requires
   authenticated publication and owner device sign-off. An unavailable Home card must never launch synthetic
   opponents or an unverified chapter. Other thirteen chapters remain M029, not T097.

No credentials, bucket writes, infrastructure edits or private roster rows were used in the code PR. Prepared
private content is explicitly separate from merged/deployed application code.
