# RPG chapter content and checkpoint authoring

T095/T096's standing contract for T097 private authoring. Product rules remain in
[Global Uma RPG](../design/uma-rpg.md); grouped saves in [the implementation contract](uma-rpg-implementation.md).
No real PriConne rows, extracted descriptions or portraits belong in this document or git.

## Private pack v1

The authenticated content manifest may contain one `data/rpg-chapters.<first-eight-sha256>.json` file. The lazy
`apps/web/src/content/rpg.ts` loader checks MIME type, byte length and SHA-256 before the pure
`parseRpgChapterPack` parser runs. No file means **unavailable**, never a synthetic encounter. Multiple matching
files are ambiguous and rejected. A replaced pack whose hash differs from an open checkpoint is also unavailable;
T097 must retain/load the exact old pack before enabling that old map, not rewrite its checkpoint.

The JSON is `{ schemaVersion: 1, version, actors, chapters }`. `version` is an immutable authored identifier
(for example `opening-v1`), **not** the whole manifest version or a hash of itself. Each chapter's `contentVersion`
must equal it. The verified file's full SHA-256 is injected into each parsed chapter as `contentHash`, stored in the
checkpoint and frozen entry, and checked on resume. It is not embedded in the JSON being hashed.

| Row | Required fields |
|---|---|
| Actor | `id`, `name`, `role`, `artKey`, `combat` |
| Chapter | `id`, `scenarioId`, `title`, `contentVersion`, `recommendedTier`, `recommendedLevel`, `surface`, `distance`, `startNodeId`, `bossNodeId`, `nodes` |
| Node | `id`, `name`, `kind`, `detail`, `enemies`, `exits`; optional `baseExp` for old-pack compatibility |
| Combat actor | `id` (same as actor), `element`, `stats`, `moves`, optional `phaseTwo` |
| Move | `id`, `kind`, `channel`, `element` or `null`, `power`, `target`, `intentText`, optional `status` |
| Phase two | `thresholdPercent`, `moves` |

All objects reject unknown/missing keys. Stable chapter/node/actor/move/art ids use the bounded safe-id alphabet
`A–Z a–z 0–9 _ . : -`, up to 24 characters. Art keys must resolve against actual manifest entries
`art/priconne/<artKey>.<eight-hash>.webp`; an art URL is never executable content or a public hotlink in the pack.
Names/roles are nonempty and at most 80 characters; chapter titles 100; node detail 240. Node detail explains the
tradeoff, not an unimplemented reward claim. Pack bounds are 1–500 actors, 1–64 chapters and 1–64 nodes per chapter,
matching the existing selected-path bound. Each team contains 1–5 unique actor ids in **front-to-back formation order**.
Enemy art loading/importing and production character selection are T097; T095's previews label missing art safely.

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
