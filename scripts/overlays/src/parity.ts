// One-off local parity against the final racer packs. Full differences stay under gitignored content/review/.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { cardRaceBonus, sourceCardEffect, type SupportCardTemplate } from '@racer/domain'
import { CONTENT, localContent, ROOT } from './local'

async function main() {
  const original = resolve(process.env.PARITY_CONTENT_DIR ?? resolve(ROOT, '../uma-racer/content'))
  const { content, master } = await localContent(undefined, original)
  const manifest = JSON.parse(await readFile(resolve(original, 'manifest.json'), 'utf8')) as { version: string; files: { path: string; bytes: number; sha256: string }[] }
  const changes: { pack: string; id: string; field: string; before: unknown; after: unknown }[] = []
  let raceBonusDifferences = 0
  for (const pack of ['umas', 'cards', 'skills', 'races', 'courses'] as const) {
    const file = manifest.files.find((file) => new RegExp(`^data/${pack}\\.[a-f0-9]{8}\\.json$`).test(file.path))
    if (file === undefined) throw new Error('Missing parity oracle pack')
    const bytes = await readFile(resolve(original, file.path))
    if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Invalid parity oracle bytes')
    const old = (JSON.parse(bytes.toString()) as { items: { id: string }[] }).items
    const left = new Map(old.map((row) => [row.id, row as Record<string, unknown>]))
    const right = new Map(content[pack].map((row) => [row.id, row as unknown as Record<string, unknown>]))
    for (const id of new Set([...left.keys(), ...right.keys()])) {
      const before = left.get(id), after = right.get(id)
      if (!before || !after) { changes.push({ pack, id, field: before ? 'removed' : 'added', before, after }); continue }
      if (pack === 'cards' && cardRaceBonus(before as unknown as SupportCardTemplate) !== cardRaceBonus(after as unknown as SupportCardTemplate)) raceBonusDifferences += 1
      for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (field !== 'imageSource' && !isDeepStrictEqual(before[field], after[field])) changes.push({ pack, id, field, before: before[field], after: after[field] })
      }
    }
    console.log(`${pack}: ${old.length} → ${content[pack].length}`)
  }
  await mkdir(resolve(CONTENT, 'review'), { recursive: true })
  await writeFile(resolve(CONTENT, 'review/se1-parity.json'), JSON.stringify({ before: manifest.version, after: master.manifest.version, changes }, null, 2))
  const counts: Record<string, number> = {}
  for (const change of changes) counts[`${change.pack}.${change.field}`] = (counts[`${change.pack}.${change.field}`] ?? 0) + 1
  console.log(JSON.stringify({ before: manifest.version, after: master.manifest.version, fieldDifferences: counts }))
  const permitted = new Set(['umas.added', 'umas.globalRelease', 'umas.signatureRaceFamilyIds', 'cards.added', 'cards.effectProfile', 'cards.obtain', 'cards.starter', 'cards.uniqueEffect', 'skills.added', 'races.added'])
  // Metadata/new coverage is reviewed in the acceptance note. Nothing may disappear or change retained rules.
  const unexpected = changes.filter((change) => !permitted.has(`${change.pack}.${change.field}`))
  const activeUniqueLoss = changes.filter((change) => change.pack === 'cards' && change.field === 'uniqueEffect').some((change) => {
    const card = content.cards.find((card) => card.id === change.id)!
    const before = change.before as SupportCardTemplate['uniqueEffect']
    return before?.effects.some((effect) => sourceCardEffect(effect.type, card.type) !== null)
  })
  console.log(JSON.stringify({ retainedCardRaceBonusDifferences: raceBonusDifferences, unexpectedFieldDifferences: unexpected.length, activeUniqueLoss }))
  if (raceBonusDifferences || unexpected.length || activeUniqueLoss) throw new Error('Unresolved master parity difference; see private review report')
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Private parity failed'); process.exitCode = 1 })
