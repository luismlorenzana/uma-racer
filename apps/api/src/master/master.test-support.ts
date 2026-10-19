// Complete, tiny invented platform release and racer overlay. Test-only; never reads private content.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildMemoryRelease, syntheticMasterData } from '@luismlorenzana/uma-data/testing'
import { adaptMaster, type RacerOverlays } from '@racer/domain/master'
export async function masterFixture() {
  const data = syntheticMasterData()
  const race = data.races[0]!, course = data.courses[0]!
  data.tracks = Array.from({ length: 10 }, (_, i) => ({ id: 10001 + i, name: `Invented Park ${i + 1}`, courseIds: [990011 + i] }))
  data.races = data.tracks.map((track, i) => ({ ...race, id: 990101 + i, familyId: 9910 + i, grade: [100, 200, 300][i % 3]!, trackId: track.id, courseId: 990011 + i }))
  data.courses = data.tracks.map((track, i) => ({ ...course, id: 990011 + i, trackId: track.id }))
  const overlay: RacerOverlays = { schema: 1, flair: { version: 2, series: [], mainVenueKeys: data.tracks.map((track) => String(track.id)) }, cardFocus: {} }
  const release = await buildMemoryRelease(data)
  const bytes = new TextEncoder().encode(JSON.stringify(overlay))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const index = { version: sha256.slice(0, 12), file: { path: `overlays/racer.${sha256.slice(0, 16)}.json`, bytes: bytes.byteLength, sha256 } }
  const overlays = new Map([['overlay.json', new TextEncoder().encode(JSON.stringify(index))], [index.file.path, bytes]])
  return { data, release, index, overlays, adapted: adaptMaster(data, overlay).content }
}
export async function writeMasterFixture(dir: string) {
  const fixture = await masterFixture()
  for (const [path, bytes] of fixture.release.objects) {
    const full = join(dir, 'master', path.startsWith('files/') ? path.slice(6) : path)
    await mkdir(dirname(full), { recursive: true }); await writeFile(full, bytes)
  }
  for (const [path, bytes] of fixture.overlays) {
    const full = join(dir, 'content', path)
    await mkdir(dirname(full), { recursive: true }); await writeFile(full, bytes)
  }
  return fixture
}
