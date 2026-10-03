# T098 — RPG Inspiration rewards, independent slots and inherited skills

**Goal:** RPG battles fund a complete Inspiration build for a five-outfit party, with separate slot and natural-gold
unlocks, efficient mirrored grandparents, original token icons and safe existing-save migration. Supersedes the old
one-token/whole-parent-branch proposal (D220). Read M028, RPG design/technical contract, Constellations, Skills &
Lineage, Minigame kit, Items/Farm and D223/D247. Latest main, one PR.

## Product rules

- Global Items has two scenario-typed families: **Inspiration Slot Token [Scenario]** and **Inspiration Skill Token
  [Scenario]**. No second wallet, ticket cost, race/Farm/Training EXP or Badge-page award.
- One slot token opens one existing lineage node for one outfit/scenario: two independently selected parents and
  four grandparents. A grandparent needs its parent slot open; no Training Level prerequisite. An open slot supplies
  aptitudes, baseline whites and the inherited unique of its current occupant.
- Each slot has two separately unlockable natural-gold positions, in awakening-gold order. One skill token opens one
  position; the slot must be open and filled, with that gold present. Unlocks belong to the slot, not the ancestor:
  replacing an occupant is free and retains purchased positions. Unlocking is availability, not equipping/free SP.
  Own-kit/card skills remain available independently of locked lineage moons.
- Parents must be different characters. No ancestor may be the child; grandparents cannot be either parent or repeat
  a character within their side. The same **exact outfit** may occupy one grandparent slot on each side (positions
  need not match); different outfits of that character do not count as an efficient mirror.
- Grandparent-only inherited unique/gold sources cost **2× SP**, including the inherited gold's prerequisite chain.
  A grandparent present on both sides costs normal SP. Parents/own kit/cards cost normal SP. Deduplicated skills use
  the cheapest available source and pay prerequisites once. Baseline whites are not doubled merely for being
  available from a grandparent. Eligibility, Skills prices, loadout budget and race compilation agree.
- Aptitudes count filled slots, including mirrored grandparents; library and loadout remain deduplicated.

## Reward budget and lifecycle

- Five members × six slots = **30 slot tokens** per accepted boss clear. Five × six × two golds = **60 skill tokens**
  minimum per shortest completed chapter route. Five scenario chapters fund 25 full outfit/scenario builds:
  **150 slot + at least 300 skill tokens**, independently of optional fights or level-relative EXP taper.
- Compute the minimum non-boss battle count over legal start-to-boss paths from the immutable graph. Each ordinary/
  elite win pays `ceil(60 / minimumNonBossBattles)` skill tokens. Optional fights pay the same as required fights;
  longer routes earn extra. A boss-only graph pays its 60 skills at clear as well. Authored positive-EXP encounters
  only; legacy unrewarded entries grant zero, with no retroactive payout.
- Freeze scenario/token amounts in a compatible new combat-kit wrapper at encounter entry. Never change an open
  fight's reward from live content. Old wrappers replay identically and grant no tokens.
- Regular tokens are collected with the acknowledged winning map-node transition; boss tokens with chapter clear.
  The group expects checkpoint/Item versions and consumes accepted winning evidence. Skill ledger ids derive from
  encounter identity; slot ids from chapter attempt. Rows/evidence/receipt commit all or none. Loss/abandon, pending
  results, revisiting a node, double tap/lost ACK cannot pay twice. Explicit replay earns under a new attempt; prior
  wins remain earned after a later loss.
- Spend through the grouped command expecting Uma/Item versions, exact closed slot/gold position, correct scenario,
  stock and no ordinary pending write. One −1 movement opens exactly one position. Stale/duplicate spends cannot
  consume twice. Pending grants/spends are visible and unavailable. Reconnect adopts accepted rows without replacing
  newer ordinary edits; ledger reconciliation rebuilds both token stacks.

## Save migration

- Next root-save/Dexie migration adds bounded explicit slot ids/gold-position keys to each ScenarioTraining. TL9
  opens A's three old slots; TL10 both sides. A preexisting assignment below its old gate opens its branch too.
  Every grandfathered slot retains both gold positions. Preserve assignments, loadouts, Extra stats, EXP/TL, careers
  and entity versions; no token grants/charges. Local and cloud use the same pure migration exactly once.
- Current TL10 with empty explicit unlocks stays closed; fresh scenarios start closed. Cards stay TL1–8. TL9/10
  still raise baseline stats/SP, but Spark no longer claims lineage unlocks. Refactor all unlock/library/assignment/
  graph callers, not UI only. Independent API parsers accept old rollout shapes but reject schema downgrade writes.
  Malformed/future state is a visible error, never an empty-state reset.

## UI and assets

- Keep D247 planets/moons/skill rail. Show slots /6, golds /12, both scenario stocks, named one-token confirmation and
  Items link. Locked planets unlock slots; locked moons name the separate skill token. Grandparent details/Skills
  say 2× or mirrored normal. Explain exclusions in the existing Uma picker. No training navigation redesign.
- Items lists both families for all current scenarios with square-bracket names, acquisition/use copy and scenario-
  aware Inspiration navigation through the owned-Uma picker. Original repo-native SVG token icons reuse Farm's icon
  vocabulary: linked-portrait crest versus skill/spark crest, distinguishable by shape/accessible name, not just color.
- Battle/map results distinguish preview, pending collection and acknowledged inventory; link Items/Inspiration.
  Guides explain regular-vs-boss drops/free entry. ≥44pt targets, safe areas, lazy chunks, m.* transform/opacity only.
  Capture synthetic 390×844 and 375×667 screens; active battles never page-scroll.

## Mandatory verification

Pure tests: TL8/9/10, filled-under-gate/current-TL10-closed/repeated migration; six slot/twelve gold spends; wrong
scenario, missing parent, empty/no-gold slot; exact mirrored/nonmirrored grandparents and character exclusions;
cheaper own/card/parent source, shared prerequisites and race-budget agreement. IndexedDB and local/Firestore
resolver: duplicate/replay clear, regular collection, stale Uma/Item/checkpoint, lost ACK/offline pending, ordinary
edit conflicts, ledger reconciliation and old cloud adoption. Synthetic progression/reward check covers two routes
through five scenarios, unchanged Lv50 pacing, ≥30/60 per scenario, five full outfit builds without shortfall, optional
surplus and two tiers/replayed attempt.

Run lint/test/build, sim:rpg:progression, sim:rpg:combat and sim:constellation; report startup ≤180KB gzip, RPG/Spark
chunks. Update design, architecture/technical contract, task map, numeric pins and append-only decision. Persist this
rewrite in an initial docs commit; remove spec in implementation PR (D104). No infrastructure, private publication,
Home release (T099), class/stat/EXP coefficients or farming changes.
