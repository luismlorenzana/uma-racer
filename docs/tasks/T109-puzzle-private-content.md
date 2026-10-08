# T109 — Private PAD cast, atlas and verified content runtime

**Code delivered; real-content acceptance pinned by the owner (D272).** See the living
[content contract](../technical/puzzle-content.md) for implemented parsers, imports, immutable retention, authenticated
loader and temporary DEV-only SVG placeholders. Remaining: permitted real starter/evolution source files/evidence,
actual pack/atlas import, aggregate validation and private art preview. The owner requested proceeding with other
implementation first and returning to this input pass last, before T116. Retain this spec until real content verifies;
do not treat the code-only merge or placeholder screenshots as full completion.

**Depends on T108's semantic cast/recipe interface.** Read design §10, the implementation contract §§1,9, current
RPG private content contract and existing data/assets pipeline/runbook. No infrastructure/env/workflow edits or cloud
credentials are part of ordinary work. One PR, synthetic fixtures only.

## Outcome and non-negotiable source gate

Provide the importer, validators, alpha-safe atlas adapter, retained immutable pack format and client loader for a
real PAD enemy cast. Prepare/verify permitted private source inputs covering a complete opening chapter and valid
joins for all generated chapters. Code may reuse five starter/evolution families with semantic level/role variants;
it must not pretend fourteen different original rosters were imported.

The requested Fandom Monster Book001–020 was robots-blocked in prior research. Do **not** fetch it through a proxy,
CLI workaround or cache to evade that restriction. Accept owner-provided allowed export/files or establish another
verifiable source. Explicitly distinguish verified images from search snippets/unverified URLs. If source/art remains
unavailable, report a content blocker with exact missing inputs; do not substitute PriConne/Uma/anonymous monsters.

## Pipeline contract

1. Author source-adapter code and a versioned normalized schema: stable private cast id, original display name,
   family/evolution variant, source provenance and art variant/hash; semantic join lists allowable recipe/element roles.
   No original PAD combat stats/scripts/skill text. Every extracted row/name/list/image lives in ignored `content/`
   or importer cache. Checked-in source examples invent creatures and URL fixtures.
2. Validate duplicate/unknown ids, variant ambiguity, source provenance, all five elements, regular trios, guardian/
   champion coverage and all generated chapter joins. Stable sorting/hashing makes rerunning unchanged inputs identical.
   Pack availability is a manifest capability with supported recipe/engine versions, not an assumed file name.
3. Download/cache only validated sources through the existing allowed pipeline; verify MIME/decode/dimensions/size,
   bounded retry/timeouts, transparent pixels, local cache integrity and deduplication. No credentials in config/logs.
4. Build separate PAD WebP atlases with alpha gutters and explicit frame rectangles; retain originals privately.
   Keep Uma/PriConne/PAD namespaces distinct. New atlas builds do not overwrite referenced immutable objects.
5. Pack carries version/content hash, provenance revision, cast entries and atlas object hashes. Monster names/art
   are presentation joins; input stores stable cast/recipe/content identity. Publishing must preserve every current
   content family/object and retained version needed by open battles. No unrelated private roster read (D185).

## Client runtime

Add a lazy `apps/web/src/content/puzzles/` loader with authenticated fetch through existing API content paths, schema
and hash verification, explicit missing/future/incompatible states and bounded cached lookup. Resolve/hold art through
the established art ownership pattern so another scene cannot revoke visible URLs. Save the compatible immutable pack
identity at entry and retain it for resume; a new manifest is not permission to change an enemy or reroll a battle.

Manifest discovery is cheap; actual pack/art verification happens lazily before playable entry. Exact API MIME/path
allowlists may change in normal content service code, not infrastructure. A missing pack displays **Uma Puzzles content
unavailable** with Retry and Return; no generic fallback, fake production test double or gameplay-time external hotlink.
Unavailable assets never start a rewarded encounter.

## Tests and private evidence

- Invented pack fixtures: parser bounds, duplicate/unknown joins, invalid/future versions, missing colour, incomplete
  node cast, deterministic pack hash, changed art without recipe change, retained old pack on a content update.
- Synthetic transparent image fixtures: decode rejection, alpha preservation/gutters, multi-atlas rect bounds,
  cache corruption, stable deduplication and absent/broken art.
- Authenticated loader success/failure/offline cache, verification mismatch, art lease lifetime and visible unavailable
  screen. No test network and no extracted rows in snapshots.
- Real ignored-input validation record: timestamp, aggregate cast/element/recipe coverage and object/hash counts only;
  no downloaded original catalogue/name list in a research artifact or PR. Preview actual enemy art privately without
  claiming a synthetic illustration is the final cast.

## Acceptance and publication boundary

Pipeline/runtime code is complete when it validates real permitted inputs or reports the specific unresolved source
blocker; **the full content acceptance is not complete until the real pack exists and all joins/art verify**. Do not
close this task as “done” on fixtures alone. If only a code PR can land while blocked, retain the remaining task spec
and gate; D104 removal happens on full completion, not because the PR is green.

Run lint/test/build + sim:puzzles (synthetic fixtures), report startup/loader/atlas-related chunks. Publish production
only through the existing owner-authorized runbook in T116, not by editing cloud resources. If publication is already
specifically authorized, record hashes/object integrity separately and retain every other content family. Update design,
content technical contract and M030/index; delete this spec only when its complete acceptance is met.
