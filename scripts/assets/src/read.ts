// Reads and verifies the T001 pack inputs used by the private asset pipeline.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ContentManifest, ContentManifestFile } from '@racer/domain'
import type { ImageSource } from './download'

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function dataFile(manifest: ContentManifest, name: 'umas' | 'cards'): ContentManifestFile {
  const matches = manifest.files.filter((file) => new RegExp(`^data/${name}\\.[a-f0-9]{8}\\.json$`).test(file.path))
  if (matches.length !== 1) throw new Error(`Expected exactly one ${name} pack; run pnpm data:import first`)
  return matches[0]!
}

function parseSources(bytes: Buffer, label: string): ImageSource[] {
  const parsed: unknown = JSON.parse(bytes.toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) {
    throw new Error(`Invalid ${label} pack envelope`)
  }
  return (parsed as { items: unknown[] }).items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid ${label} item at index ${index}`)
    const { id, imageSource } = item as { id?: unknown; imageSource?: unknown }
    if (typeof id !== 'string' || typeof imageSource !== 'string' || !/^https:\/\//.test(imageSource)) {
      throw new Error(`Invalid ${label} image source at index ${index}`)
    }
    return { id, url: imageSource }
  })
}

async function verifiedPack(contentDir: string, file: ContentManifestFile): Promise<Buffer> {
  const bytes = await readFile(resolve(contentDir, file.path))
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Content pack failed integrity: ${file.path}`)
  return bytes
}

export async function readAssetSources(
  contentDir: string,
): Promise<{ manifest: ContentManifest; umas: ImageSource[]; cards: ImageSource[] }> {
  let manifest: ContentManifest
  try {
    manifest = JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as ContentManifest
  } catch {
    throw new Error('Content manifest not found; run pnpm data:import first')
  }
  const umaFile = dataFile(manifest, 'umas')
  const cardFile = dataFile(manifest, 'cards')
  const [umaBytes, cardBytes] = await Promise.all([
    verifiedPack(contentDir, umaFile),
    verifiedPack(contentDir, cardFile),
  ])
  return { manifest, umas: parseSources(umaBytes, 'umas'), cards: parseSources(cardBytes, 'cards') }
}
