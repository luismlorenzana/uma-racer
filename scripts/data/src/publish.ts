// Verified, manifest-last private content publishing (docs/technical/infrastructure.md#release-runbook).

import type { ContentManifest, ContentManifestFile } from '@racer/domain'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const VERSION_PATTERN = /^[a-f0-9]{12}$/
const SHA_PATTERN = /^[a-f0-9]{64}$/
// `art/<family>/<id>.<hash>.webp` is the per-entry art added alongside the packs and atlases.
const CONTENT_PATH_PATTERN = /^(?:(?:data|atlases)\/[A-Za-z0-9][A-Za-z0-9._-]*|art\/[a-z][a-z-]*\/[A-Za-z0-9][A-Za-z0-9._-]*)$/

export interface RemoteObjectState {
  bytes: number
}

export interface ContentStorageClient {
  readManifest: () => Promise<unknown | null>
  objectState: (path: string) => Promise<RemoteObjectState | null>
  upload: (localPath: string, objectPath: string) => Promise<void>
}

export interface PublishContentOptions {
  contentDir: string
  storage: ContentStorageClient
  dryRun?: boolean
  now?: () => number
}

export interface PublishContentResult {
  dryRun: boolean
  localVersion: string
  remoteVersionBefore: string | null
  remoteVersionAfter: string | null
  uploadPaths: readonly string[]
  alreadyPresentPaths: readonly string[]
  totalBytes: number
  uploadBytes: number
  elapsedMs: number
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseFile(value: unknown): ContentManifestFile {
  if (!record(value) || Object.keys(value).some((key) => !['path', 'bytes', 'sha256'].includes(key))) {
    throw new Error('Local content manifest contains an invalid file entry')
  }
  if (typeof value.path !== 'string' || !CONTENT_PATH_PATTERN.test(value.path) || value.path.includes('..')) {
    throw new Error('Local content manifest contains an unsafe file path')
  }
  if (!Number.isSafeInteger(value.bytes) || (value.bytes as number) < 0) {
    throw new Error(`Local content manifest has invalid byte length for ${value.path}`)
  }
  if (typeof value.sha256 !== 'string' || !SHA_PATTERN.test(value.sha256)) {
    throw new Error(`Local content manifest has invalid SHA-256 for ${value.path}`)
  }
  return { path: value.path, bytes: value.bytes as number, sha256: value.sha256 }
}

function parseLocalManifest(value: unknown): ContentManifest {
  if (!record(value) || typeof value.version !== 'string' || !VERSION_PATTERN.test(value.version) ||
    typeof value.generatedAt !== 'string' || !record(value.source) || !Array.isArray(value.files)) {
    throw new Error('Local content manifest is malformed')
  }
  const files = value.files.map(parseFile)
  if (files.length === 0 || new Set(files.map((file) => file.path)).size !== files.length) {
    throw new Error('Local content manifest must contain unique files')
  }
  const expectedVersion = createHash('sha256')
    .update(files.map((file) => file.sha256).sort().join(''))
    .digest('hex')
    .slice(0, 12)
  if (value.version !== expectedVersion) throw new Error('Local content manifest version does not match its file hashes')
  const source = Object.fromEntries(Object.entries(value.source).map(([key, entry]) => {
    if (typeof entry !== 'string') throw new Error('Local content manifest source versions must be strings')
    return [key, entry]
  }))
  return { version: value.version, generatedAt: value.generatedAt, source, files }
}

function remoteVersion(value: unknown | null): string | null {
  if (value === null) return null
  if (!record(value) || (value.version !== null && (typeof value.version !== 'string' || !VERSION_PATTERN.test(value.version)))) {
    throw new Error('Remote content manifest is malformed')
  }
  return value.version as string | null
}

async function readManifest(contentDir: string): Promise<{ manifest: ContentManifest; path: string }> {
  const path = resolve(contentDir, 'manifest.json')
  let bytes: Buffer
  try {
    bytes = await readFile(path)
  } catch (error) {
    throw new Error(`Local content output is absent at ${path}; run pnpm data:import and pnpm assets:import first`, { cause: error })
  }
  try {
    return { manifest: parseLocalManifest(JSON.parse(bytes.toString('utf8')) as unknown), path }
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Local content manifest is not valid JSON: ${path}`, { cause: error })
    throw error
  }
}

async function verifyFile(contentDir: string, file: ContentManifestFile): Promise<string> {
  const path = resolve(contentDir, ...file.path.split('/'))
  let bytes: Buffer
  try {
    bytes = await readFile(path)
  } catch (error) {
    throw new Error(`Local content file is missing: ${file.path}`, { cause: error })
  }
  if (bytes.byteLength !== file.bytes) {
    throw new Error(`Local content byte length mismatch: ${file.path} (manifest ${file.bytes}, file ${bytes.byteLength})`)
  }
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== file.sha256) throw new Error(`Local content SHA-256 mismatch: ${file.path}`)
  return path
}

export async function publishContent(options: PublishContentOptions): Promise<PublishContentResult> {
  const startedAt = options.now?.() ?? Date.now()
  const { manifest, path: manifestPath } = await readManifest(options.contentDir)
  const localPaths = new Map<string, string>()
  for (const file of manifest.files) localPaths.set(file.path, await verifyFile(options.contentDir, file))

  const remoteVersionBefore = remoteVersion(await options.storage.readManifest())
  const uploadPaths: string[] = []
  const alreadyPresentPaths: string[] = []
  for (const file of manifest.files) {
    const state = await options.storage.objectState(file.path)
    if (state?.bytes === file.bytes) alreadyPresentPaths.push(file.path)
    else uploadPaths.push(file.path)
  }

  if (!options.dryRun) {
    for (const path of uploadPaths) await options.storage.upload(localPaths.get(path)!, path)
    await options.storage.upload(manifestPath, 'manifest.json')
  }
  const remoteVersionAfter = options.dryRun
    ? remoteVersionBefore
    : remoteVersion(await options.storage.readManifest())
  if (!options.dryRun && remoteVersionAfter !== manifest.version) {
    throw new Error(`Published manifest verification failed: expected ${manifest.version}, found ${remoteVersionAfter ?? 'none'}`)
  }

  const elapsedMs = (options.now?.() ?? Date.now()) - startedAt
  return {
    dryRun: options.dryRun ?? false,
    localVersion: manifest.version,
    remoteVersionBefore,
    remoteVersionAfter,
    uploadPaths,
    alreadyPresentPaths,
    totalBytes: manifest.files.reduce((total, file) => total + file.bytes, 0),
    uploadBytes: manifest.files.filter((file) => uploadPaths.includes(file.path)).reduce((total, file) => total + file.bytes, 0),
    elapsedMs,
  }
}
