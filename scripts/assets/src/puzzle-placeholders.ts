// Local-only, repeatable original-art export. Normal hash/atlas/pack verification is still required (D289).
import { createHash } from 'node:crypto'
import { mkdir, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import sharp from 'sharp'
import { canonicalPuzzleJson, parsePuzzleCastSource, PUZZLE_ELEMENTS, type PuzzleSource } from '@racer/domain'
import { puzzlePlaceholderSvg, type PlaceholderRank } from './puzzle-placeholder-art'
import { writeImmutable } from './puzzles'

export async function exportPuzzlePlaceholders(contentDir: string) {
  const root = resolve(contentDir), originals = resolve(root, 'originals'), overrides = resolve(root, 'overrides')
  await mkdir(originals, { recursive: true }); await mkdir(overrides, { recursive: true })
  const realRoot = await realpath(root)
  for (const path of [originals, overrides]) if (!(await realpath(path)).startsWith(realRoot + sep)) throw new Error('Placeholder export escapes content directory')
  const source: PuzzleSource = { schemaVersion: 1, version: 'original-placeholders-v1', provenanceRevision: 'original-placeholders-v1', members: [] }
  for (const element of PUZZLE_ELEMENTS) for (const rank of ['scout', 'guardian', 'champion'] as PlaceholderRank[]) {
    const id = `placeholder-${element}-${rank}`, location = `originals/${id}.png`
    const pixels = await sharp(Buffer.from(puzzlePlaceholderSvg(element, rank))).png().toBuffer()
    const sha256 = createHash('sha256').update(pixels).digest('hex')
    await writeImmutable(resolve(root, location), pixels)
    source.members.push({ id, name: `${element[0]!.toUpperCase()}${element.slice(1)} placeholder · ${rank}`, family: `placeholder-${element}`, variant: rank,
      elements: [element], roles: rank === 'scout' ? ['striker', 'healer'] : rank === 'guardian' ? ['guard', 'converter', 'ward'] : ['champion'],
      source: { access: 'original-placeholder', reference: 'repo:scripts/assets/src/puzzle-placeholder-art.ts', revision: 'original-placeholders-v1', verifiedAt: '2026-10-08T00:00:00.000Z' },
      art: { location, sha256, mimeType: 'image/png', variant: rank } })
  }
  const parsed = parsePuzzleCastSource(source), input = resolve(overrides, 'puzzles-placeholders.json'), evidence = resolve(overrides, 'puzzles-placeholder-evidence.json')
  await writeImmutable(input, canonicalPuzzleJson(parsed))
  await writeImmutable(evidence, canonicalPuzzleJson({ schemaVersion: 1, revision: parsed.provenanceRevision, entries: parsed.members.map(m => ({
    id: m.id, reference: m.source.reference, artHash: m.art.sha256, artLocation: m.art.location, artVariant: m.art.variant, verifiedAt: m.source.verifiedAt })) }))
  return { members: parsed.members.length, input, evidence }
}
