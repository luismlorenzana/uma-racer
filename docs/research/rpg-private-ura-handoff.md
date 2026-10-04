# First private URA RPG chapter — publication record

Prepared on 2026-10-03 under T097 (D248); **published on 2026-10-04 by Codex at the owner's direction (D257)**.
Publication is not a physical-device or real-account gameplay sign-off. This report
contains only aggregate coverage and immutable identity, not extracted character rows or art. The standing
schema, commands and per-chapter checklist are in [RPG chapter content](../technical/rpg-chapter-content.md).

## Prepared private files

The isolated worktree is `/Users/luismartinez/.codex/worktrees/uma-rpg-design/uma-racer`.
Its ignored `content/overrides/` holds `rpg-chapters.json`, `rpg-source-evidence.json` and the private
`author-rpg-ura.mts` authoring helper. Imported objects/catalog are under ignored `content/data/` and
`content/art/priconne/`; source images are in ignored `scripts/assets/.cache/priconne/`. The two override JSON files
and generated output have now been copied/reimported into `/Users/luismartinez/workspace/uma-racer/content`.
The source cache and authoring helper still live in the isolated worktree: do not archive it and lose those ignored
files. No original-content file is part of the PR.

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

## Publication — completed; gameplay acceptance follows deployment

1. Codex combined the prepared source with the complete canonical ignored content tree, reimported portraits
   offline from the verified cache, compiled the immutable pack and ran the private validator/replay above.
2. The existing publisher's dry run and real run agree: **9 new objects uploaded; 2,055 unchanged objects retained**.
   Complete manifest **`56f02305d0ee`** replaces `e268e2f353a0`, with 2,064 files / 57,580,630 bytes.
   New RPG objects total 169,142 bytes; the manifest was uploaded last and read back at the expected version.
   The task-local partial manifest `69cfea84822d` was never published.
3. Signed-in production Settings reports **`56f02305d0ee · network`** with existing content coverage intact.
   T099's Home gate checks the real URA chapter and portraits through that authenticated runtime before entry.
4. T098's token bridge, T105's advance and T099's Home/resume/guide implementation ship together. The owner
   explicitly chose production-first validation (D257); real-party fights, rewards/spends and physical-iPhone
   sign-off remain separate post-release checks in [release acceptance](rpg-release-acceptance.md).
   An unavailable Home card must never launch synthetic opponents or an unverified chapter.
5. Other thirteen chapters remain M029. Edits to this chapter require a new immutable version, never overwriting
   retained content needed by a frozen checkpoint.

The release used the existing scoped private-bucket publisher, not new credentials or infrastructure edits.
Private rows/art remain ignored and separate from the code PR and deployment.
