// Publishes only racer-authored overlays; platform remains the only master importer (SE1).
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { authoringOverlay, CONTENT, localContent } from './local'
import { scenarioCoverage } from '@racer/domain/master'

export function overlayPublication(value: unknown) {
  const bytes = Buffer.from(JSON.stringify(value))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  return { bytes, index: { version: sha256.slice(0, 12), file: { path: `overlays/racer.${sha256.slice(0, 16)}.json`, bytes: bytes.length, sha256 } } }
}

async function main() {
  const dir = resolve(process.env.CONTENT_DIR ?? CONTENT)
  const { master } = await localContent(undefined, dir) // Validate every private reference before replacing the index.
  const coverage = scenarioCoverage(master.data, new Date().toISOString().slice(0, 10))
  if (coverage !== null) console.warn(coverage)
  const { bytes, index } = overlayPublication(await authoringOverlay(dir))
  await mkdir(resolve(dir, 'overlays'), { recursive: true })
  await writeFile(resolve(dir, index.file.path), bytes)
  await writeFile(resolve(dir, 'overlay.json'), JSON.stringify(index))
  console.log(`Racer overlay: ${index.version} · ${bytes.length} bytes (no master rows or images)`)
}
if (process.argv[1]?.endsWith('/import.ts')) void main().catch(() => { console.error('Overlay build failed; check the private source and authored references'); process.exitCode = 1 })
