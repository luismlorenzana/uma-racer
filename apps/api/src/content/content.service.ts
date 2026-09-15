import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { Readable } from 'node:stream'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Storage } from '@google-cloud/storage'

/** Written by scripts/data + scripts/assets next to the packs they describe. */
export interface ContentManifest {
  version: string | null
  files: { path: string; bytes: number; sha256: string }[]
}

const EMPTY_MANIFEST: ContentManifest = { version: null, files: [] }

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
}

// Serves the private content packs (original-game data and images) to authenticated clients only.
// Local dev reads the gitignored `content/` folder; production reads the private GCS bucket.
@Injectable()
export class ContentService {
  private readonly source: 'local' | 'gcs'
  private readonly dir: string
  private readonly bucketName: string | undefined
  private storage: Storage | undefined

  constructor(config: ConfigService) {
    this.source = config.get<string>('CONTENT_SOURCE') === 'gcs' ? 'gcs' : 'local'
    this.dir = resolve(process.cwd(), config.get<string>('CONTENT_DIR') ?? '../../content')
    this.bucketName = config.get<string>('CONTENT_BUCKET')
  }

  /** Rejects traversal and anything outside the content root. */
  static safePath(path: string): string {
    const clean = path.replace(/^\/+/, '')
    if (!clean || clean.split('/').some((part) => part === '..' || part === '' || part.startsWith('.'))) {
      throw new NotFoundException('not found')
    }
    return clean
  }

  static contentType(path: string): string {
    return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
  }

  private bucket() {
    if (!this.bucketName) throw new NotFoundException('content bucket not configured')
    this.storage ??= new Storage()
    return this.storage.bucket(this.bucketName)
  }

  async manifest(): Promise<ContentManifest> {
    try {
      if (this.source === 'gcs') {
        const [buf] = await this.bucket().file('manifest.json').download()
        return JSON.parse(buf.toString('utf8')) as ContentManifest
      }
      return JSON.parse(await readFile(resolve(this.dir, 'manifest.json'), 'utf8')) as ContentManifest
    } catch {
      return EMPTY_MANIFEST
    }
  }

  async open(path: string): Promise<{ stream: Readable; contentType: string; bytes?: number }> {
    const clean = ContentService.safePath(path)
    const contentType = ContentService.contentType(clean)
    if (this.source === 'gcs') {
      const file = this.bucket().file(clean)
      const [exists] = await file.exists()
      if (!exists) throw new NotFoundException('not found')
      return { stream: file.createReadStream(), contentType }
    }
    const full = resolve(this.dir, clean)
    if (!full.startsWith(this.dir + sep)) throw new NotFoundException('not found')
    try {
      const info = await stat(full)
      return { stream: createReadStream(full), contentType, bytes: info.size }
    } catch {
      throw new NotFoundException('not found')
    }
  }
}
