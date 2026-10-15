// The new game's code boundaries (M034 "Build beside, switch once"; T137 "Code boundaries"). Both ways:
// - `g2/` imports only today's surviving generic pieces (below); a task that widens the list says why, and T143 keeps
//   every listed piece. Today's domain root is read for types only: the rules are `@racer/domain/rework/*` and `hub`.
// - nothing outside `g2/` imports it, so today's entry, routes and bundle never see it; and a built `dist/` holds no
//   `g2/` module (scripts/check-size.mjs refuses one at build time too).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const G2 = join(SRC, 'g2')
const DIST_MANIFEST = fileURLToPath(new URL('../../dist/.vite/manifest.json', import.meta.url))

/** Today's pieces `g2/` may import, by path under `src/` without extension. */
const G2_ALLOWED: readonly RegExp[] = [
  /^ui\/(Button|BottomSheet|Panel|Row|Chip|Pill|SegmentedControl|Meter|Numeral|AtlasSprite|Placeholder)$/,
  // T141: the race and badge pages' generic pieces, kept by T143 with the race scene and the badge records.
  /^ui\/(TypeIcon|RaceMarkIcon|FlairCards|CardFocusIcons|IconChoiceRow|PresetBadge|Crest|Section)$/,
  // T141: today's pure race and badge views, imported as they are (they read `UmaSave` through `careerView`), and the
  // race's accomplishment facts. T143 moves them with the race scene; none touches today's store or Dexie.
  /^game\/(race-plan|race-fit|race-facts|goals-view|flair-view|badge-collection-view|trainer-view|badge-frame)$/,
  // T138's Town Hall: the album chrome and its pure query engine (the Stable, the Card Library, the Uma picker), art
  // tiles, crests, the card type and focus icons, and the art viewer (T138 "Shared pieces"). The album's preferences are
  // the new game's own (`g2/ui/albumPrefs`), not today's Dexie-backed `game/album/prefs`.
  /^ui\/(ArtTile|ArtViewer|Crest|TypeIcon|CardFocusIcons)$/,
  /^ui\/album\/(AlbumChrome|FilterTray|SortSheet|VirtualGrid|useArt)$/,
  /^game\/album\/query$/,
  /^ui\/icons(\/index)?$/,
  /^ui\/icons\/defineIcon$/,
  /^ui\/motionFeatures$/,
  /^index\.css$/,
  /^content\/[\w./-]+$/,
  /^auth\/[\w./-]+$/,
  /^scenes\/race\/[\w./-]+$/,
  // T136: the save layer's tests run against the generation-2 API's own pure resolver, so the device meets the server's
  // real rules. Test support only; T143 moves it with the API module.
  /^\.\.\/\.\.\/api\/src\/save-g2\/resolve$/,
]

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__snapshots__' ? [] : files(path)
    return /\.(tsx?|css)$/.test(entry) ? [path] : []
  })
}

interface Import {
  readonly specifier: string
  readonly typeOnly: boolean
}

const STATEMENT = /\bimport\s+(type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bexport\s+(type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|@import\s+['"]([^'"]+)['"]/g

function imports(file: string): Import[] {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(STATEMENT)].map((match) => ({
    specifier: (match[2] ?? match[4] ?? match[5] ?? match[6] ?? match[7])!,
    typeOnly: match[1] !== undefined || match[3] !== undefined,
  }))
}

/** A relative specifier as a path under `src/`, extension and `/index` kept as written. */
const underSrc = (file: string, specifier: string): string =>
  relative(SRC, resolve(dirname(file), specifier.replace(/\?.*$/, ''))).split(sep).join('/').replace(/\.(tsx?|js)$/, '')

const isInside = (file: string): boolean => resolve(file).startsWith(G2 + sep)

/** The Racing places, which read today's race and badge rules at the domain root (T141). */
const RACING = /^g2\/places\/racing\//

describe('the g2 boundaries', () => {
  it("imports only today's surviving generic pieces from outside g2/", () => {
    const offenders: string[] = []
    const sources = files(G2)
    expect(sources.length).toBeGreaterThan(30)
    for (const file of sources) {
      for (const { specifier, typeOnly } of imports(file)) {
        // T141: the Racing places call today's race, badge and flair rules, which live at the domain root until T143 moves
        // them (M034 "What stays as it is"); every other place reads the root for types only.
        if (specifier === '@racer/domain' && !typeOnly && !RACING.test(relative(SRC, file).split(sep).join('/'))) {
          offenders.push(`${relative(SRC, file)}: today's domain root, beyond types`)
        }
        if (!specifier.startsWith('.')) continue
        const target = resolve(dirname(file), specifier)
        if (isInside(target)) continue
        const path = underSrc(file, specifier)
        if (!G2_ALLOWED.some((allowed) => allowed.test(path))) offenders.push(`${relative(SRC, file)} → ${path}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('is imported by nothing outside g2/, so today\'s entry never reaches it', () => {
    const offenders: string[] = []
    for (const file of files(SRC).filter((path) => !isInside(path))) {
      for (const { specifier } of imports(file)) {
        if (specifier.startsWith('.') && isInside(resolve(dirname(file), specifier))) offenders.push(`${relative(SRC, file)} → ${specifier}`)
        if (/(^|\/)g2(\/|$)/.test(specifier) && !specifier.startsWith('.')) offenders.push(`${relative(SRC, file)} → ${specifier}`)
      }
    }
    expect(offenders).toEqual([])
    const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')
    expect(html).toContain('/src/main.tsx')
    expect(html).not.toMatch(/g2/)
  })

  it.skipIf(!existsSync(DIST_MANIFEST))('leaves no g2/ module in a built dist/', () => {
    const manifest = JSON.parse(readFileSync(DIST_MANIFEST, 'utf8')) as Record<string, { file: string; src?: string }>
    const g2 = Object.entries(manifest).filter(([key, node]) => key.includes('src/g2/') || node.src?.includes('src/g2/') || key === 'g2.html')
    expect(g2).toEqual([])
  })
})
