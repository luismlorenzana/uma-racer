// Private, immutable campaign/portrait catalog (docs/technical/rpg-chapter-content.md, T097).
import type { ContentManifestFile } from '../content'
import { isRpgBattleNode, type RpgChapterPack } from './chapter'

export interface RpgPackReference {
  version: string; sha256: string; path: string; art: { key: string; path: string }[]
}
export interface RpgContentCatalog { schemaVersion: 1; activeHash: string; packs: RpgPackReference[] }
export interface RpgPackIdentity { contentVersion: string; contentHash: string }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const fail = (): never => { throw new Error('Invalid RPG catalog: missing, ambiguous or stale pack/art reference') }

export function parseRpgContentCatalog(raw: unknown, files: readonly ContentManifestFile[]): RpgContentCatalog {
  if (!record(raw) || !exact(raw, ['schemaVersion', 'activeHash', 'packs']) || raw.schemaVersion !== 1 ||
    typeof raw.activeHash !== 'string' || !Array.isArray(raw.packs) || raw.packs.length < 1 || raw.packs.length > 64) return fail()
  for (const p of raw.packs as unknown[]) {
    if (!record(p) || !exact(p, ['version', 'sha256', 'path', 'art']) || typeof p.version !== 'string' ||
      !/^[A-Za-z0-9_.:-]{1,120}$/.test(p.version) || typeof p.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.sha256) ||
      p.path !== `data/rpg-chapters.${p.sha256.slice(0, 8)}.json` || !files.some(f => f.path === p.path && f.sha256 === p.sha256) ||
      !Array.isArray(p.art) || p.art.length < 1 || p.art.length > 500) return fail()
    for (const a of p.art as unknown[]) {
      if (!record(a) || !exact(a, ['key', 'path']) || typeof a.key !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(a.key) ||
        typeof a.path !== 'string') return fail()
      const file = files.find(f => f.path === a.path)
      if (!file || a.path !== `art/priconne/${a.key}.${file.sha256.slice(0, 8)}.webp`) return fail()
    }
    if (new Set(p.art.map(a => (a as { key: string }).key)).size !== p.art.length) return fail()
  }
  const catalog = raw as unknown as RpgContentCatalog
  if (new Set(catalog.packs.map(p => p.sha256)).size !== catalog.packs.length ||
    new Set(catalog.packs.map(p => p.version)).size !== catalog.packs.length ||
    !catalog.packs.some(p => p.sha256 === catalog.activeHash)) return fail()
  return catalog
}

/** Publication is stricter than legacy runtime parsing: every fight earns EXP and the boss changes tactics. */
export function assertProductionRpgPack(pack: RpgChapterPack): void {
  if (pack.schemaVersion !== 2) throw new Error('Production RPG requires provenance-bearing pack v2')
  for (const chapter of pack.chapters) {
    if (chapter.nodes.some(n => isRpgBattleNode(n) && !(n.baseExp && n.baseExp > 0))) throw new Error('Production RPG battle requires positive authored EXP')
    const boss = chapter.nodes.find(n => n.id === chapter.bossNodeId)!
    if (!boss.enemies.some(id => {
      const actor = pack.actors.find(a => a.id === id)!
      const mechanics = (moves: typeof actor.combat.moves) => moves.map(m => [m.kind, m.channel, m.element, m.power, m.target, m.status ?? null])
      return actor.combat.phaseTwo && JSON.stringify(mechanics(actor.combat.moves)) !== JSON.stringify(mechanics(actor.combat.phaseTwo.moves))
    })) throw new Error('Production RPG boss requires a changed phase kit')
  }
}
