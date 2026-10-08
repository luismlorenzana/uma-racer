// Writes deterministic, content-addressed data packs described by T001.

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContentManifest, ContentManifestFile } from '@racer/domain'

export interface PackDefinition<T extends { id: string } = { id: string }> {
  name: string
  version: string
  items: readonly T[]
}

export interface WriteContentPacksOptions {
  packs: readonly PackDefinition[]
  source: Record<string, string>
  contentDir?: string
  generatedAt?: string
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const DEFAULT_CONTENT_DIR = resolve(repoRoot, 'content')

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readExistingManifest(contentDir: string): Promise<ContentManifest | null> {
  try {
    return JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as ContentManifest
  } catch {
    return null
  }
}

async function stalePacks(dataDir: string, name: string, keep: string): Promise<string[]> {
  const entries = await readdir(dataDir)
  return entries
    .filter((entry) => entry !== keep && entry.startsWith(`${name}.`) && entry.endsWith('.json'))
    .map((entry) => resolve(dataDir, entry))
}

export async function writeContentPacks(options: WriteContentPacksOptions): Promise<ContentManifest> {
  const contentDir = options.contentDir ?? DEFAULT_CONTENT_DIR
  const dataDir = resolve(contentDir, 'data')
  await mkdir(dataDir, { recursive: true })

  const previous = await readExistingManifest(contentDir)
  const files: ContentManifestFile[] = previous?.files.filter((file) => !file.path.startsWith('data/') || /^data\/(rpg-(chapters|catalog)|puzzles-(cast|catalog))\./.test(file.path)) ?? []
  const stale: string[] = []
  for (const pack of options.packs) {
    const items = [...pack.items].sort((left, right) => left.id.localeCompare(right.id))
    const json = JSON.stringify({ version: pack.version, items })
    const digest = sha256(json)
    const fileName = `${pack.name}.${digest.slice(0, 8)}.json`
    await writeFile(resolve(dataDir, fileName), json, 'utf8')
    stale.push(...(await stalePacks(dataDir, pack.name, fileName)))
    files.push({ path: posix.join('data', fileName), bytes: Buffer.byteLength(json), sha256: digest })
  }

  files.sort((left, right) => left.path.localeCompare(right.path))
  const version = sha256(files.map((file) => file.sha256).sort().join('')).slice(0, 12)
  const source = Object.fromEntries(Object.entries({ ...previous?.source, ...options.source }).sort(([left], [right]) => left.localeCompare(right)))
  const manifest: ContentManifest = {
    version,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source,
    files,
  }
  const manifestPath = resolve(contentDir, 'manifest.json')
  const temporaryManifest = `${manifestPath}.${process.pid}.tmp`
  await writeFile(temporaryManifest, JSON.stringify(manifest), 'utf8')
  await rename(temporaryManifest, manifestPath)
  await Promise.all(stale.map((path) => unlink(path)))
  return manifest
}
