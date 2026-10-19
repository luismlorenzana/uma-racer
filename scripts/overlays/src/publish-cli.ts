// Only the two-file, racer-authored overlay release. Master data/art is never uploaded by Racer (SE1).
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { parseOverlayIndex } from '@racer/domain/master'
import { CONTENT, localContent } from './local'
import { storage } from './storage'

async function main() {
  const dir = resolve(process.env.CONTENT_DIR ?? CONTENT)
  await localContent(undefined, dir)
  const indexBytes = await readFile(resolve(dir, 'overlay.json'))
  const index = parseOverlayIndex(JSON.parse(indexBytes.toString()))
  const bytes = await readFile(resolve(dir, index.file.path))
  const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')
  if (bytes.length !== index.file.bytes || hash(bytes) !== index.file.sha256) throw new Error('Overlay integrity failure')
  const remote = await storage('uma-racer', 'uma-racer-content')
  const pointer = await remote.info('overlay.json')
  const existing = await remote.read(index.file.path)
  if (existing !== null && hash(existing) !== index.file.sha256) throw new Error('Immutable overlay conflict')
  if (process.argv.includes('--dry-run')) { console.log(`Overlay ${index.version}: ${existing ? 0 : 1} immutable file + index, ${bytes.length} bytes; dry run`); return }
  if (existing === null) await remote.put(index.file.path, bytes, '0')
  const uploaded = await remote.read(index.file.path)
  if (uploaded === null || hash(uploaded) !== index.file.sha256) throw new Error('Overlay upload failed verification')
  await remote.put('overlay.json', indexBytes, pointer?.generation ?? '0')
  if (Buffer.compare(Buffer.from(await remote.read('overlay.json') ?? []), indexBytes) !== 0) throw new Error('Overlay index verification failed')
  console.log(`Overlay ${index.version} published and verified; master data and old assets untouched`)
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Overlay publish failed'); process.exitCode = 1 })
