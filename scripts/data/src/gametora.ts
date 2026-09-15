// Fetches and locally caches the public source datasets described by T001.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const GAMETORA_MANIFEST_URL = 'https://gametora.com/data/manifests/umamusume.json'
export const GAMETORA_DATA_URL = 'https://gametora.com/data/umamusume'
export const DATASET_NAMES = [
  'character-cards',
  'characters',
  'support-cards',
  'skills',
  'races',
  'racetracks',
] as const

export type DatasetName = (typeof DATASET_NAMES)[number]
export type GameToraManifest = Record<string, string>

export interface JsonResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

export type FetchJson = (url: string) => Promise<JsonResponse>

export interface LoadGameToraOptions {
  refresh?: boolean
  cacheDir?: string
  fetcher?: FetchJson
}

export interface LoadedGameToraData {
  manifest: GameToraManifest
  datasets: Record<DatasetName, unknown>
}

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_CACHE_DIR = resolve(packageDir, '.cache')

const defaultFetcher: FetchJson = (url) => fetch(url)

async function fetchJson(url: string, fetcher: FetchJson): Promise<unknown> {
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`GameTora returned HTTP ${response.status} for ${url}`)
  return response.json()
}

function parseManifest(value: unknown): GameToraManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('GameTora manifest is not an object')
  }
  const entries = Object.entries(value)
  if (entries.some(([, version]) => typeof version !== 'string' || !version)) {
    throw new Error('GameTora manifest contains a non-string version')
  }
  return Object.fromEntries(entries) as GameToraManifest
}

async function readCached(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export async function loadGameToraData(options: LoadGameToraOptions = {}): Promise<LoadedGameToraData> {
  const fetcher = options.fetcher ?? defaultFetcher
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
  const manifest = parseManifest(await fetchJson(GAMETORA_MANIFEST_URL, fetcher))
  await mkdir(cacheDir, { recursive: true })

  const entries = await Promise.all(
    DATASET_NAMES.map(async (name) => {
      const version = manifest[name]
      if (!version) throw new Error(`GameTora manifest is missing ${name}`)
      const cachePath = resolve(cacheDir, `${name}.json`)
      const cached = options.refresh ? undefined : await readCached(cachePath)
      if (cached !== undefined) return [name, cached] as const

      const dataset = await fetchJson(`${GAMETORA_DATA_URL}/${name}.${version}.json`, fetcher)
      await writeFile(cachePath, JSON.stringify(dataset), 'utf8')
      return [name, dataset] as const
    }),
  )

  return { manifest, datasets: Object.fromEntries(entries) as Record<DatasetName, unknown> }
}
