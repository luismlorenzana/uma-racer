// Runtime guards for private content before it reaches game UI or Pixi (T002).

import type { ContentAtlas, ContentAtlasKind, ContentManifest, ContentManifestFile } from '@racer/domain'

export interface EmptyContentManifest {
  version: null
  files: []
}

export type RuntimeContentManifest = ContentManifest | EmptyContentManifest

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    path.split('/').every((part) => part.length > 0 && part !== '..' && !part.startsWith('.'))
  )
}

function parseManifestFile(value: unknown, index: number): ContentManifestFile {
  if (!isRecord(value)) throw new Error(`Invalid manifest file at index ${index}`)
  const { path, bytes, sha256 } = value
  if (typeof path !== 'string' || !validPath(path)) throw new Error(`Invalid manifest path at index ${index}`)
  if (!Number.isSafeInteger(bytes) || (bytes as number) < 0) throw new Error(`Invalid manifest byte size for ${path}`)
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Invalid manifest hash for ${path}`)
  return { path, bytes: bytes as number, sha256 }
}

export function parseContentManifest(value: unknown): RuntimeContentManifest {
  if (!isRecord(value) || !Array.isArray(value.files)) throw new Error('Invalid content manifest')
  if (value.version === null) {
    if (value.files.length !== 0) throw new Error('Empty content manifest cannot contain files')
    return { version: null, files: [] }
  }
  if (typeof value.version !== 'string' || !/^[a-f0-9]{12}$/.test(value.version)) {
    throw new Error('Invalid content manifest version')
  }
  if (typeof value.generatedAt !== 'string' || !isRecord(value.source)) throw new Error('Invalid content manifest metadata')
  const source: Record<string, string> = {}
  for (const [key, sourceVersion] of Object.entries(value.source)) {
    if (typeof sourceVersion !== 'string') throw new Error(`Invalid source version for ${key}`)
    source[key] = sourceVersion
  }
  const files = value.files.map(parseManifestFile)
  if (new Set(files.map((file) => file.path)).size !== files.length) throw new Error('Content manifest has duplicate paths')
  return { version: value.version, generatedAt: value.generatedAt, source, files }
}

export function parseContentPack<T extends { id: string }>(value: unknown, label: string): T[] {
  if (!isRecord(value) || typeof value.version !== 'string' || !Array.isArray(value.items)) {
    throw new Error(`Invalid ${label} content pack`)
  }
  const ids = new Set<string>()
  return value.items.map((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0) {
      throw new Error(`Invalid ${label} item at index ${index}`)
    }
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`)
    ids.add(item.id)
    return item as T
  })
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

export function parseContentAtlas(value: unknown, expectedKind: ContentAtlasKind): ContentAtlas {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.kind !== expectedKind) {
    throw new Error(`Invalid ${expectedKind} atlas header`)
  }
  if (value.frameWidth !== 128 || value.frameHeight !== 128 || !Array.isArray(value.pages) || !isRecord(value.frames)) {
    throw new Error(`Invalid ${expectedKind} atlas shape`)
  }
  const pages = value.pages.map((page, index) => {
    if (!isRecord(page) || typeof page.path !== 'string' || !validPath(page.path)) {
      throw new Error(`Invalid ${expectedKind} page ${index}`)
    }
    if (!positiveInteger(page.width) || !positiveInteger(page.height) || page.width > 4096 || page.height > 4096) {
      throw new Error(`Invalid ${expectedKind} page dimensions at index ${index}`)
    }
    return { path: page.path, width: page.width, height: page.height }
  })
  if (pages.length === 0 || new Set(pages.map((page) => page.path)).size !== pages.length) {
    throw new Error(`Invalid ${expectedKind} atlas pages`)
  }

  const frames: ContentAtlas['frames'] = {}
  const framesByPage: ContentAtlas['frames'][string][][] = pages.map(() => [])
  for (const [id, frame] of Object.entries(value.frames)) {
    if (!id || !isRecord(frame)) throw new Error(`Invalid ${expectedKind} frame id`)
    const { page, x, y, width, height } = frame
    if (
      !Number.isSafeInteger(page) ||
      (page as number) < 0 ||
      (page as number) >= pages.length ||
      !Number.isSafeInteger(x) ||
      (x as number) < 0 ||
      !Number.isSafeInteger(y) ||
      (y as number) < 0 ||
      width !== 128 ||
      height !== 128
    ) {
      throw new Error(`Invalid ${expectedKind} frame ${id}`)
    }
    const parsed = { page: page as number, x: x as number, y: y as number, width: 128 as const, height: 128 as const }
    const atlasPage = pages[parsed.page]!
    if (parsed.x + parsed.width > atlasPage.width || parsed.y + parsed.height > atlasPage.height) {
      throw new Error(`Out-of-bounds ${expectedKind} frame ${id}`)
    }
    if (framesByPage[parsed.page]!.some((other) => rectanglesOverlap(parsed, other))) {
      throw new Error(`Overlapping ${expectedKind} frame ${id}`)
    }
    framesByPage[parsed.page]!.push(parsed)
    frames[id] = parsed
  }
  if (Object.keys(frames).length === 0) throw new Error(`Empty ${expectedKind} atlas`)
  return { schemaVersion: 1, kind: expectedKind, frameWidth: 128, frameHeight: 128, pages, frames }
}

export function findRequiredFile(
  manifest: ContentManifest,
  pattern: RegExp,
  label: string,
): ContentManifestFile {
  const matches = manifest.files.filter((file) => pattern.test(file.path))
  if (matches.length !== 1) throw new Error(`Expected exactly one ${label} file, found ${matches.length}`)
  return matches[0]!
}
