# T001 — Content data packs (Milestone 1, part 1)

**Goal:** a re-runnable importer that turns GameTora's public datasets into normalized, content-hashed JSON packs in the
gitignored `/content/` folder, with a manifest the existing API already serves. **Data only**: no images/atlases (T002),
no bucket upload (done by Claude), no game UI beyond what already exists.

Read first: `AGENTS.md`, `docs/technical/architecture.md` §3, `docs/design/uma-progression.md`, `docs/design/support-cards.md`,
`docs/design/skills-and-inheritance.md`, `docs/design/racing.md`, `docs/research/data-backlog.md`, `scripts/data/README.md`.

## Deliverables

1. **Content types** in `packages/domain/src/content.ts`, exported from `packages/domain/src/index.ts`:
   `UmaTemplate`, `SupportCardTemplate`, `SkillTemplate`, `RaceTemplate`, `CourseTemplate`, `ContentManifest` (shapes below).
2. **Workspace package `scripts/data`** named `@racer/data-pipeline`:
   - Add `scripts/*` to `pnpm-workspace.yaml`.
   - Scripts: `lint` (`tsc --noEmit`), `test` (`vitest run`), `import` (`tsx src/import.ts`). Add `tsx` as a devDependency of this package only.
   - Root `package.json` script: `"data:import": "pnpm --filter @racer/data-pipeline import"`.
   - `src/gametora.ts`: fetch the manifest, then each dataset. Cache raw JSON in `scripts/data/.cache/<dataset>.json` (already
     gitignored). The `--refresh` flag re-downloads; otherwise the cache is used when present.
   - `src/normalize/{umas,cards,skills,races,courses}.ts`: **pure** raw → template functions.
   - `src/pack.ts`: write `content/data/<name>.<first 8 hex of sha256>.json`, delete stale `content/data/<name>.*.json`, and write
     `content/manifest.json`.
   - `src/import.ts`: orchestrate the steps and print counts plus warnings.
   - Tests with **synthetic fixtures** in `src/__fixtures__/` (invented values in the real shapes). No network in tests.
3. **Docs:** update `scripts/data/README.md` (built, how to run), tick covered items in `docs/research/data-backlog.md`, append
   a `docs/decisions.md` row for the pack format, and add `pnpm data:import` to `AGENTS.md`, `CLAUDE.md`, and `README.md` commands.

## Source

- Manifest: `https://gametora.com/data/manifests/umamusume.json`, a map of dataset name → version string.
- Dataset URL: `https://gametora.com/data/umamusume/<name>.<manifest[name]>.json`
- Datasets used: `character-cards`, `characters`, `support-cards`, `skills`, `races`, `racetracks`, and (added by T014)
  `ura-objectives`.

## Mapping rules

### Umas — `character-cards` (one row per outfit) joined with `characters` on `char_id`

| Template field | Rule |
|---|---|
| `id` | `String(card_id)` |
| `charaId` | `String(char_id)` |
| `name` | `name_en` |
| `outfit` | `title_en_gl ?? title ?? null` |
| `jpRelease` / `globalRelease` | `release` (YYYY-MM-DD) / `release_en \|\| null` |
| `starter` | `jpRelease === '2021-02-24'` (JP launch day). Real data must yield **exactly 25**; log the count |
| `baseStats` | `five_star_stats` array → `{ speed, stamina, power, guts, wit }` (index 0..4 in that order) |
| `growthRates` | `stat_bonus` ints are percent → fractions (`20` → `0.2`), same order |
| `aptitudes` | `aptitude` is 10 letters in order **[turf, dirt, sprint, mile, medium, long, front, pace, late, end]** → domain `Aptitudes` (`surface`, `distance`, `strategy`). Validate each is S–G |
| `uniqueSkillId` | `skills_unique[0]` as string, or `null` |
| `awakeningSkillIds` | `(skills_awakening_en ?? skills_awakening)` → strings |
| `realHorseSex` | `characters[char_id].sex`: `1` → `'male'`, `2` → `'female'`, else `null` |
| `signatureRaceFamilyIds` | T014 joins character-level `ura-objectives`, preserves ordered distinct retained race-family ids, and shares them across outfits |
| `imageSource` | `https://gametora.com/images/umamusume/characters/thumb/chara_stand_${char_id}_${card_id}.png` |

### Support cards — `support-cards`, **SSR only** (`rarity === 3`)

| Template field | Rule |
|---|---|
| `id`, `charaId`, `charName`, `title` | `String(support_id)`, `String(char_id)`, `char_name`, `title_en` |
| `type` | `speed`, `stamina`, `power`, `guts`, **`intelligence` → `wit`**, `friend`, `group` |
| `jpRelease`, `era` | `release`; `era = eraOf(release)` from `@racer/domain` |
| `obtain` | `gacha` → `'gacha'`; `story_event` → `'event'`; `promo`, `limited_quest`, `shop` → `'free'`; anything else → `'unknown'` plus a warning |
| `starter` | `obtain === 'event' \|\| obtain === 'free'` (log the count) |
| `hintSkillIds` / `eventSkillIds` | `hints.hint_skills` / `(event_skills_en ?? event_skills)` → strings |
| `effectProfile` | See below |
| `uniqueEffect` | `{ level: unique.level, effects: unique.effects }` (raw `{type, value}[]`), or `null` |
| `imageSource` | `https://gametora.com/images/umamusume/supports/support_card_s_${support_id}.png` |

**Effect profile.** `effects` is a list of rows `[effectId, v1 … v11]` (values per level checkpoint; `-1` means not unlocked).
For each row take the **maximum value excluding -1**. Map effect IDs to the domain `CardEffect` keys:

| GameTora effect ID | `CardEffect` |
|---|---|
| 1 | `friendshipBonus` |
| 3 / 4 / 5 / 6 / 7 (Speed / Stamina / Power / Guts / Wit bonus) | `statBonus`, counting **only the ID matching the card's type** |
| 8 | `trainingBonus` |
| 9 / 10 / 11 / 12 / 13 (initial Speed … Wit) | `initialStats`, counting **only the ID matching the card's type** |
| 15 | `raceBonus` |
| 18 | `hintFrequency` |
| 19 | `specialtyPriority` |
| 30 | `skillPointBonus` |

`weight = value / median(value of that effect across all SSR cards that have it)`, clamped to `[0.5, 1.5]` and rounded to
2 decimals. An effect the card doesn't have gets `0`. Other effect IDs are ignored. Values are generated later by the
domain formula (`cardEffectValue`); the profile only says which effects a card has and how strong they are relative to other cards.

### Skills — `skills` (exclude `rarity === 6`, evolution skills)

| Template field | Rule |
|---|---|
| `id` | `String(id)` |
| `kind` | rarity `1` → `'white'`, `2` → `'gold'`, `3` → `'unique-upgraded'`, `4` → `'inherited-unique'`, `5` → `'unique'` |
| `name` | `enname \|\| name_en \|\| jpname` |
| `description` | `desc_en \|\| endesc \|\| jpdesc`, whitespace collapsed, then whole-word terminology fix: Runner → Front Runner, Leader → Pace Chaser, Betweener → Late Surger, Chaser → End Closer |
| `costSp` | `cost ?? null` |
| `iconId` | `iconid ?? null` |
| `conditions` | from `(loc?.en?.condition_groups ?? condition_groups)`: `{ precondition, condition, baseTime: base_time, cooldown: cd ?? null, effects: [{ type, value }] }`. Keep condition strings raw (parsed in a later task) |
| `inheritedSkillId` | `String(gene.id)` where `gene = loc?.en?.gene_version ?? gene_version`, or `null`. Also **emit the gene version itself** as a `SkillTemplate` (`kind: 'inherited-unique'`, same field rules) if its id isn't already in the pack |

### Races — `races` + `racetracks`

| Template field | Rule |
|---|---|
| `id`, `familyId`, `name` | `String(id)`, `String(race_id)`, `name_en`. Dedupe by id; T014 uses the safe decimal family id for objective joins |
| `grade` | `100` → `'g1'`, `200` → `'g2'`, `300` → `'g3'`, `400` → `'op'`, `700` → `'pre-op'`; others skipped with a warning |
| `surface` | `terrain`: `1` → `'turf'`, `2` → `'dirt'` |
| `distance`, `distanceCategory` | `distance`; `distanceCategory(distance)` from `@racer/domain` |
| `direction` | `1` → `'right'`, `2` → `'left'`, `4` → `'straight'` |
| `venue` | `track`: 10001 Sapporo, 10002 Hakodate, 10003 Niigata, 10004 Fukushima, 10005 Nakayama, 10006 Tokyo, 10007 Chukyo, 10008 Kyoto, 10009 Hanshin, 10010 Kokura, 10101 Ohi, 10103 Kawasaki, 10104 Funabashi, 10105 Morioka, 10201 Longchamp. **Skip other tracks** (overseas) |
| `courseId`, `season`, `fieldSize` | `String(course_id)`, `season`, `Math.min(entries, 18)` |

**Courses** (`racetracks[].courses[]`, only for kept venues): `{ id: String(course.id), trackId: String(track.id), distance,
terrain, turn, corners, straights, slopes }`. Keep nested arrays as `unknown` (used by race engine milestones R3/R4).

## Pack and manifest format

    content/
      manifest.json
      data/umas.<hash8>.json      → { version, items: UmaTemplate[] }
      data/cards.<hash8>.json     → { version, items: SupportCardTemplate[] }
      data/skills.<hash8>.json    → { version, items: SkillTemplate[] }
      data/races.<hash8>.json     → { version, items: RaceTemplate[] }
      data/courses.<hash8>.json   → { version, items: CourseTemplate[] }

`ContentManifest` is `{ version, generatedAt, source: { [dataset]: gametoraVersion }, files: [{ path, bytes, sha256 }] }`.
`path` is relative to `content/` (for example `data/umas.1a2b3c4d.json`). `version` is the first 12 hex characters of the
sha256 over the sorted file hashes. This matches what `apps/api/src/content/content.service.ts` already expects: it reads
`manifest.json` and serves `/api/content/files/<path>`. Items are sorted by id, and JSON is written without pretty-printing.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass. CI passes on the PR.
- Unit tests (synthetic fixtures) cover: aptitude and stat index order; stat_bonus percent → fraction; sex mapping; starter
  rules; SSR-only filtering; `intelligence` → `wit`; obtain mapping; effect-profile max, median, clamp, and type matching;
  skill kind mapping with the gene-version emit; loc.en overrides; terminology fix; race grade, surface, direction, and venue
  mapping, including skipping unknown ones; manifest hashing and stale-file cleanup (use a temp dir).
- If GameTora is reachable from your environment, run `pnpm data:import` and report the counts: expected about **267 Umas / 25
  starters**, **312 SSR cards / 94 starters** as of 2026-09-15 (small drift is fine). Then with `pnpm dev`,
  `GET http://localhost:5173/api/content/manifest` returns the manifest, and the web **Settings → Content packs** shows its version.
  If GameTora isn't reachable, say so in the PR; Claude will run the import locally.
- Nothing under `content/` or `.cache/` is committed. Fixtures contain no real game data.
