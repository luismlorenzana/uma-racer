# RPG chapter content and checkpoint authoring

T095–T097's standing content and authoring contract (D245–D247). Product rules remain in
[Global Uma RPG](../design/uma-rpg.md); grouped saves in [the implementation contract](uma-rpg-implementation.md).
No real PriConne rows, extracted descriptions or portraits belong in this document or git.

## Private packs and exact-version catalog

The authenticated content manifest carries one `data/rpg-catalog.<first-eight-sha256>.json` plus retained
`data/rpg-chapters.<first-eight-sha256>.json` files and their portraits. The lazy
`apps/web/src/content/rpg.ts` loader checks MIME type, byte length and SHA-256 before the pure
`parseRpgChapterPack` parser runs. No file means **unavailable**, never a synthetic encounter. The catalog selects
`activeHash` for new attempts and an exact `contentVersion` + `contentHash` for an existing checkpoint. A missing
retained pack blocks map continuation without rewriting any checkpoint or battle. Explicit replay after clear
starts on the current active pack; ordinary resume does not. A legacy manifest without a catalog can read one v1
pack; multiple legacy packs are ambiguous and rejected.

Catalog shape: `{ schemaVersion: 1, activeHash, packs: [{ version, sha256, path, art: [{ key, path }] }] }`.
It accepts 1–64 immutable pack references, unique versions/full hashes and 1–500 unique art keys per pack.
Every pack path and portrait path must bind its manifest SHA-256 and eight-character filename prefix. Import
retains older packs and images in both the manifest and local output: **there is no implicit pruning**. Owners must
not remove a version while any device/checkpoint references it. Reusing a version for different JSON, or changing
a retained pack's key-to-image mapping, fails rather than silently updating old maps. Catalog/pack requests are
lazy and deduplicated; a failed fetch can retry. Each image id is `key-hash8`, so two versions of the same character
never share the wrong live portrait. Held Blob URLs follow the app's bounded art loader; art is not fetched at startup.

Production JSON is `{ schemaVersion: 2, version, actors, chapters }`; legacy schema 1 remains readable. `version` is an immutable authored identifier
(for example `opening-v1`), **not** the whole manifest version or a hash of itself. Each chapter's `contentVersion`
must equal it. The verified file's full SHA-256 is injected into each parsed chapter as `contentHash`, stored in the
checkpoint and frozen entry, and checked on resume. It is not embedded in the JSON being hashed.

| Row | Required fields |
|---|---|
| Actor | `id`, `name`, `role`, `artKey`, `combat`, `source` (required in v2, absent in v1) |
| Chapter | `id`, `scenarioId`, `title`, `contentVersion`, `recommendedTier`, `recommendedLevel`, `surface`, `distance`, `startNodeId`, `bossNodeId`, `nodes` |
| Node | `id`, `name`, `kind`, `detail`, `enemies`, `exits`; optional `baseExp` for old-pack compatibility |
| Combat actor | `id` (same as actor), `element`, `stats`, `moves`, optional `phaseTwo` |
| Move | `id`, `kind`, `channel`, `element` or `null`, `power`, `target`, `intentText`, optional `status` |
| Phase two | `thresholdPercent`, `moves` |
| Source | `characterId`, `pageUrl`, `portraitUrl`, `variant`, `attribution`, `verifiedAt` |

All objects reject unknown/missing keys. Stable chapter/node/actor/move/art ids use the bounded safe-id alphabet
`A–Z a–z 0–9 _ . : -`, up to 24 characters. Art keys must resolve against actual manifest entries
`art/priconne/<artKey>.<eight-hash>.webp`; an art URL is never executable content or a public hotlink in the pack.
Names/roles are nonempty and at most 80 characters; chapter titles 100; node detail 240. Node detail explains the
tradeoff, not an unimplemented reward claim. Pack bounds are 1–500 actors, 1–64 chapters and 1–64 nodes per chapter,
matching the existing selected-path bound. Each team contains 1–5 unique actor ids in **front-to-back formation order**.
Production art keys use the filesystem-safe subset `A–Z a–z 0–9 _ -` (at most 24 characters).
The map and battle stage join names/portraits from the checkpoint's exact pack; an unavailable image is visibly
labelled, not replaced with another character. It never changes a frozen combat kit.

Node kinds: `encounter`, `elite`, `boss`, `branch`, `recovery`, `checkpoint`. Battle nodes must name a nonempty
team; safe nodes must have an empty team. Exits are ordered, unique node ids. A chapter has one terminal boss,
every node is reachable from start, every non-boss has an exit, and no cycles are allowed. This makes all routes
reach the boss without duplicate node rewards. A reconvergence is a `checkpoint` reached from multiple exits.

T096 adds explicit **`baseExp`**, integer 0–1,000,000. Every T097 production battle node must author a positive
base; safe nodes omit it or use zero. Old packs with no base remain readable but unrewarded. Entry freezes the
base and chapter recommendation in a v2 kit wrapper, separate from combat input/hashes. The result uses the
[D246 formula and authoring budget](../design/uma-rpg.md#settled-t096-encounter-exp-and-checkpoint-choices-d246),
never a screen default. Author/retest the chapter's total budget for its actual fight count; the helper's
ordinary/elite/boss weights describe the two/three-fight test graph, not every production chapter.

Recommended tier is positive (bounded at 10,000) and local level 1–50. Surface is `turf`/`dirt`; distance is
`sprint`/`mile`/`medium`/`long`. They theme the map and preview; they do not launch races or alter main-game aptitudes.
Scenario id must exist in `SCENARIOS`. Recommendations are warnings, not entry gates.

`combat` uses engine-v1 `FrozenEnemy`. All thirteen `RpgCoreStats` fields are required, integer 0–100,000
(HP at least 1). Moves are inline kits rather than references to an external skill catalog: 1–8 uniquely named
actions per phase, power 0–500, nonempty intent up to 120 characters. Kinds are damage/heal/guard/buff; channels
physical/magical; elements Fire/Ice/Lightning/Light/Dark. Damage targets front/lowest-hp/seeded and may inflict
burn/slow/mark/weaken; support targets self/lowest-hp-ally and may apply ward/regen/power-up. Phase threshold is
1–99% HP. The engine selects deterministic visible intents from these kits; there is no per-screen random plan.
Never reference a missing action or invent a new status in a private row: unsupported kits fail validation.

The production gate additionally requires positive EXP on every battle and at least one boss actor whose phase
kit changes mechanics (different ids/intent wording alone are not a phase). Runtime v2 parsing checks this too.
These are content validation rules, not new combat coefficients. Native portrait decode happens before packing;
offline publication rechecks byte/hash integrity and 256×256 WebP metadata.

## Curated official-site source evidence

`source.characterId` identifies a playable character on the [official directory](https://priconne-redive.jp/character/).
`pageUrl` must be its exact HTTPS `/character/<id>/` page (without query/fragment); `portraitUrl` is the exact chosen
PNG/JPEG/WebP on that page, on `priconne-redive.jp` or the site's `images.microcms-assets.io` CDN. URLs are bounded
at 2048 characters, without credentials; provenance includes a chosen-variant note (80 characters), attribution
(240) and valid ISO UTC verification timestamp. No remote image hotlink appears in the UI.

The current official site is a client-rendered SPA: fetching its initial HTML is **not** proof that a portrait belongs
to a character. Use the browser to verify the character page and fantasy/modern/other selected panel, then record
private `content/overrides/rpg-source-evidence.json`:

```json
{ "schemaVersion": 1, "pages": [{
  "pageUrl": "https://priconne-redive.jp/character/example/",
  "portraitUrls": ["https://images.microcms-assets.io/assets/invented.png"]
}] }
```

This example is invented. The adapter requires every actor's exact selected URL in its matching page evidence,
and one image source per art key. It downloads once into `scripts/assets/.cache/priconne/` keyed by URL SHA-256,
decodes with the workspace's existing Sharp dependency and writes cropped 256×256 WebP portraits. Source pins
`manifest.source["rpg-art:<key>"]` select exact addressed images for compilation. All evidence, rows, caches and art
remain ignored. `--offline` uses only cached source images, never the network; missing/corrupt images fail.

## Commands and owner/Claude publication checklist

From the repository root, with a reviewed private `content/overrides/rpg-chapters.json`:

```bash
pnpm assets:rpg:import             # sources + evidence → verified private portraits, manifest pins
pnpm assets:rpg:import --offline   # repeat without network once every source is cached
pnpm data:rpg:import               # canonical JSON → immutable pack and retained-version catalog
pnpm data:rpg:validate --replay    # credential-free integrity, graph/kit/art gate and bounded route probe
```

All accept `--content-dir=/absolute/private/path`; importers also accept `--input=/absolute/private/source.json`.
Portrait import accepts `--evidence=...` and `--cache-dir=...`. They print only version/hash, counts and aggregate
coverage; CLI failures do not dump private rows/URLs. Canonical object-key sorting preserves ordered formation,
exits and moves. Failed validation must not swap the last good pack/catalog. The regular GameTora data importer
preserves retained RPG packs/catalog and source pins; regular atlas/art rebuilds preserve the separate PriConne family.

For **each** chapter, the private author must:

1. Pick playable character teams for opening/fork/elite/boss, with genuinely different fork matchups and clear intent.
2. Verify official character pages and the exact selected portrait variants; record private source evidence.
3. Author Uma RPG stats, elements, formation, actions/statuses and phase scripts. Never copy source damage formulas.
4. Author positive encounter EXP using the actual required/optional fight counts; keep a new immutable version for edits.
5. Import art, compile and validate every reference/retained object; run the bounded probe and inspect the chapter privately.
6. **Owner/Claude only:** combine with the complete current private Uma/Spark content tree, then run existing
   `pnpm content:publish -- --dry-run` and `pnpm content:publish`. No task-local partial manifest may replace production.
7. Fetch through the signed-in runtime, record the published manifest version plus RPG pack version/full hash, play
   every route and test old checkpoint resume after an updated active pack. T099 stays blocked until this succeeds.

The existing publisher now rejects invalid present RPG content **before** reading/uploading remote storage. A
publication without RPG remains valid for the current non-RPG game. Publication credentials/infrastructure are
unchanged and belong to the owner; these importers never publish.

The bounded `--replay` probe uses invented base-100/no-growth five-weapon entrants, three fixed seeds, full
HP/MP per encounter and the real EXP/skill rules. It measures live-versus-JSON-restored state hashes, clear count,
phase triggers, mean rounds and ending levels. It is not a production-balance claim for every owned Uma or loadout.
See [the initial private handoff](../research/rpg-private-ura-handoff.md) for aggregate results and the prepared version.

An invented minimal shape (not the production chapter; its art references must still resolve in a private manifest):

```json
{
  "schemaVersion": 1,
  "version": "example-v1",
  "actors": [{
    "id": "example-captain", "name": "Example captain", "role": "Physical vanguard", "artKey": "example-captain",
    "combat": {
      "id": "example-captain", "element": "ice",
      "stats": { "speed": 70, "stamina": 70, "power": 55, "guts": 50, "wit": 55, "atk": 70, "matk": 70,
        "initiative": 70, "pdef": 55, "mdef": 55, "dexterity": 50, "hp": 350, "mp": 140 },
      "moves": [{ "id": "strike", "kind": "damage", "channel": "physical", "element": null,
        "power": 135, "target": "front", "intentText": "Strike front" }]
    }
  }],
  "chapters": [{
    "id": "example-chapter", "scenarioId": "ura-finale", "title": "Example only", "contentVersion": "example-v1",
    "recommendedTier": 1, "recommendedLevel": 10, "surface": "turf", "distance": "medium",
    "startNodeId": "boss", "bossNodeId": "boss",
    "nodes": [{ "id": "boss", "name": "Example finale", "kind": "boss", "detail": "Invented schema example.",
      "enemies": ["example-captain"], "exits": [], "baseExp": 2323 }]
  }]
}
```

The complete branching example is `packages/domain/src/rpg/chapter.synthetic.ts`, used only by tests and the
DEV route. Do not publish it or use its sizes, names or stats as production defaults.

## Accepted map flow

1. Start groups the expected preset, five outfit revisions, checkpoint (absent or cleared) and foreground-preset
   update. A new map starts at attempt 1, empty path; explicit replay of a clear creates attempt +1. Entry costs zero.
2. A safe node queues `choose-node`, appending exactly its id to the path at the expected checkpoint version.
   A battle node instead enters through T092, freezing the full current party, kit and deterministic seed.
3. Actions stay in the local journal. A win queues `battle-result`; it does **not** move the map. On acknowledgement,
   its receipt exists in `rpgResults`, five outfit EXP projections settle atomically and the checkpoint is
   `pending-result`. The preview is unearned until this acknowledgement; a loss pays zero.
4. Accept win consumes that exact accepted winning evidence: `choose-node` for ordinary/elite, `clear-chapter`
   for the terminal boss. The group appends the battle node to the accepted path, clears the frozen entry and
   sets at-checkpoint/cleared. The API reads that evidence inside the same transaction; missing/losing evidence rejects.
   Client graph validation decides legal edges/boss identity, just as client replay decides combat legality (D223).
5. Loss/abandon accepts zero reward, increments retry ordinal and keeps the exact entry/kit/seed/party. Retry must
   enter that same node; it cannot choose the other branch. Earlier accepted nodes and evidence stay untouched.

Map, start and terminal commands are not acknowledged optimistically. Pending entries can still reopen their
local battle via Continue, but never open the next node. Reload, route changes and focus read Dexie and receipts.
Selecting another chapter is navigation until Start/Resume explicitly sets that preset's foreground. If its former
fight is open, Pause explicitly abandons only the unresolved actions and must sync before switching. Each preset
retains all its chapter checkpoints. Party membership/order edits affect future entries only; existing members'
signature/loadout edits require an accepted safe checkpoint and add its revision to the grouped edit dependencies.

Conflict recovery explicitly pulls acknowledged RPG entities/evidence, discards rejected queued commands and their
dependent results, and keeps rejected battle journals in the local archive for diagnosis. A terminal journal from a
rejected result cannot block the accepted open fight: recovery offers an explicit restart of that same frozen entry.
Accepted-result journals remain intact. It never reissues a rejected result or mints a fresh seed.
The T092 second-device takeover/restart policy still applies to an open battle. The root save schema and Dexie schema
are unchanged; `choose-node` is an additive grouped command action, not a new save field.

## Synthetic reward fixture and private-authoring handoff

`syntheticChapterPack()` contains two distinct branching chapter ids for pause/resume testing, both at **Tier 1 Lv10**,
plus a one-fight deliberately unwinnable KO/loss probe (Tier 1 Lv50 recommendation, not a balance target).
Each graph has six nodes: opening → crossroads → (quiet camp **or** elite) → approach → boss.
`rpgChapterFightCounts()` returns **[2, 3]**: two required fights, one optional elite. Five invented Lv10 profiles
have base racing inputs 400 each, no growth, and five distinct class/weapon/element identities. The phone proof
equips their foundation techniques; host traversal tests also use Attack-only loadouts. This is not real Uma data.

The browser Attack-only recovery route cleared the opening in **two saved actions / one round** and boss in
**six / two rounds**. The boss crosses its phase threshold. This deliberately short fixture tests transitions, not
production balance. T096 measures its pinned reward formula over both routes, including catch-up/taper, KO and
two-tier promotion; the sim prints every fight and chapter. T097's authored production count remains independently
chosen and must be retested before release.

Recovery means a **safe setup stop/shorter path** today: every engine-v1 encounter starts at full HP/MP, so it does
not heal a new persistent resource. Elite adds a fight for encounter EXP, not an extra chapter token. The Lv10
fixture's ordinary/elite/boss bases are 1,549 / 968 / 2,323; payouts taper against each frozen entrant level.
T096 adds battle EXP in the existing result group and safe-checkpoint skills/promotion, but no Items, tickets,
seals or racing/training progress. T098 adds the scenario token to the boss-clear group. Home stays gated until T099.
