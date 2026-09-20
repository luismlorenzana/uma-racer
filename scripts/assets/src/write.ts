// Content-addressed atlas writer that merges assets into T001's manifest.

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { posix, resolve } from 'node:path'
import type { ContentAtlas, ContentAtlasKind, ContentManifest, ContentManifestFile } from '@racer/domain'
import type { BuiltAtlas } from './atlas'

export interface AtlasDefinition {
  kind: ContentAtlasKind
  atlas: BuiltAtlas
}

export interface WriteAtlasesOptions {
  contentDir: string
  atlases: readonly AtlasDefinition[]
  generatedAt?: string
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readManifest(contentDir: string): Promise<ContentManifest> {
  try {
    return JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as ContentManifest
  } catch {
    throw new Error('Content manifest not found; run pnpm data:import first')
  }
}

function isFamilyFile(path: string, kinds: ReadonlySet<string>): boolean {
  if (!path.startsWith('atlases/')) return false
  const name = posix.basename(path)
  return [...kinds].some((kind) => name.startsWith(`${kind}.`) || name.startsWith(`${kind}-`))
}

export async function writeAtlases(options: WriteAtlasesOptions): Promise<ContentManifest> {
  const previous = await readManifest(options.contentDir)
  const atlasDir = resolve(options.contentDir, 'atlases')
  await mkdir(atlasDir, { recursive: true })
  const kinds = new Set(options.atlases.map(({ kind }) => kind))
  const files: ContentManifestFile[] = previous.files.filter((file) => !isFamilyFile(file.path, kinds))
  const keepNames = new Set<string>()

  for (const { kind, atlas } of options.atlases) {
    const pages: ContentAtlas['pages'] = []
    for (let index = 0; index < atlas.pages.length; index += 1) {
      const page = atlas.pages[index]!
      const digest = sha256(page.bytes)
      const name = `${kind}-${index}.${digest.slice(0, 8)}.webp`
      await writeFile(resolve(atlasDir, name), page.bytes)
      keepNames.add(name)
      const path = posix.join('atlases', name)
      pages.push({ path, width: page.width, height: page.height })
      files.push({ path, bytes: page.bytes.length, sha256: digest })
    }

    const descriptor: ContentAtlas = {
      schemaVersion: 1,
      kind,
      frameWidth: 128,
      frameHeight: 128,
      pages,
      frames: atlas.frames,
    }
    const json = JSON.stringify(descriptor)
    const digest = sha256(json)
    const name = `${kind}.${digest.slice(0, 8)}.json`
    await writeFile(resolve(atlasDir, name), json, 'utf8')
    keepNames.add(name)
    files.push({ path: posix.join('atlases', name), bytes: Buffer.byteLength(json), sha256: digest })
  }

  files.sort((left, right) => left.path.localeCompare(right.path))
  const version = sha256(files.map((file) => file.sha256).sort().join('')).slice(0, 12)
  const manifest: ContentManifest = {
    version,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: previous.source,
    files,
  }
  const manifestPath = resolve(options.contentDir, 'manifest.json')
  const temporaryManifest = `${manifestPath}.${process.pid}.tmp`
  await writeFile(temporaryManifest, JSON.stringify(manifest), 'utf8')
  await rename(temporaryManifest, manifestPath)

  const existingNames = await readdir(atlasDir)
  await Promise.all(
    existingNames
      .filter((name) => !keepNames.has(name) && isFamilyFile(posix.join('atlases', name), kinds))
      .map((name) => unlink(resolve(atlasDir, name))),
  )
  return manifest
}

export interface ArtFileFamily {
  /** Manifest directory, e.g. `art/uma`. */
  dir: string
  images: readonly { id: string; bytes: Buffer }[]
}

export interface WriteArtOptions {
  contentDir: string
  families: readonly ArtFileFamily[]
  generatedAt?: string
}

/**
 * Writes one content-addressed WebP per entry and merges them into the manifest, replacing whatever
 * the same directories held before. Art is fetched per item at runtime, so it is never atlased.
 */
export async function writeArtFiles(options: WriteArtOptions): Promise<ContentManifest> {
  const previous = await readManifest(options.contentDir)
  const dirs = new Set(options.families.map((family) => family.dir))
  const files: ContentManifestFile[] = previous.files.filter((file) => ![...dirs].some((dir) => file.path.startsWith(`${dir}/`)))

  for (const family of options.families) {
    const target = resolve(options.contentDir, family.dir)
    await mkdir(target, { recursive: true })
    const keepNames = new Set<string>()
    for (const image of family.images) {
      if (!/^[A-Za-z0-9_-]+$/.test(image.id)) throw new Error(`Unsafe art id: ${image.id}`)
      const digest = sha256(image.bytes)
      const name = `${image.id}.${digest.slice(0, 8)}.webp`
      await writeFile(resolve(target, name), image.bytes)
      keepNames.add(name)
      files.push({ path: posix.join(family.dir, name), bytes: image.bytes.length, sha256: digest })
    }
    const existing = await readdir(target)
    await Promise.all(existing
      .filter((name) => !keepNames.has(name))
      .map((name) => unlink(resolve(target, name))))
  }

  files.sort((left, right) => left.path.localeCompare(right.path))
  const version = sha256(files.map((file) => file.sha256).sort().join('')).slice(0, 12)
  const manifest: ContentManifest = {
    version,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: previous.source,
    files,
  }
  const manifestPath = resolve(options.contentDir, 'manifest.json')
  const temporaryManifest = `${manifestPath}.${process.pid}.tmp`
  await writeFile(temporaryManifest, JSON.stringify(manifest), 'utf8')
  await rename(temporaryManifest, manifestPath)
  return manifest
}
