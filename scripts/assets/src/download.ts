// Private source-image cache. Cached and downloaded bytes never enter git.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ContentAtlasKind } from '@racer/domain'

export interface ImageSource {
  id: string
  url: string
}

export interface DownloadedImage {
  id: string
  bytes: Buffer
  cacheHit: boolean
}

export interface DownloadOptions {
  cacheDir: string
  kind: ContentAtlasKind
  refresh?: boolean
  concurrency?: number
  fetcher?: typeof fetch
}

function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Unsafe asset id: ${id}`)
  return id
}

async function fromNetwork(source: ImageSource, path: string, fetcher: typeof fetch): Promise<DownloadedImage> {
  let response: Response
  try {
    response = await fetcher(source.url, { headers: { 'User-Agent': 'Uma-Racer-private-asset-importer/1.0' } })
  } catch (error) {
    throw new Error(`Failed to download ${source.id} from ${source.url}: ${String(error)}`)
  }
  if (!response.ok) throw new Error(`Failed to download ${source.id} from ${source.url}: HTTP ${response.status}`)
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('image/')) {
    throw new Error(`Failed to download ${source.id} from ${source.url}: expected an image, got ${contentType || 'unknown'}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0) throw new Error(`Failed to download ${source.id} from ${source.url}: empty response`)
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, bytes)
  await rename(temporary, path)
  return { id: source.id, bytes, cacheHit: false }
}

export async function downloadImages(
  sources: readonly ImageSource[],
  options: DownloadOptions,
): Promise<DownloadedImage[]> {
  const targetDir = resolve(options.cacheDir, options.kind)
  await mkdir(targetDir, { recursive: true })
  const results = new Array<DownloadedImage>(sources.length)
  const fetcher = options.fetcher ?? fetch
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < sources.length) {
      const index = cursor
      cursor += 1
      const source = sources[index]!
      const path = resolve(targetDir, `${safeId(source.id)}.source`)
      if (!options.refresh) {
        try {
          results[index] = { id: source.id, bytes: await readFile(path), cacheHit: true }
          continue
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      results[index] = await fromNetwork(source, path, fetcher)
    }
  }

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 8, sources.length || 1))
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}
