import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
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

  /** Bounded immutable read for preparation. Diagnostics never include private content. */
  async readVerifiedBytes(file: { path: string; bytes: number; sha256: string }): Promise<Buffer> {
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 8388608 || !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !file.path.includes(`.${file.sha256.slice(0, 8)}.`)) throw new Error('Content read exceeds verified bounds')
    const { stream } = await this.open(file.path), chunks: Buffer[] = []; let size = 0
    try {
      for await (const part of stream) {
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part)
        size += chunk.length
        if (size > file.bytes) throw new Error('Immutable content size mismatch')
        chunks.push(chunk)
      }
    } finally { stream.destroy() }
    const bytes = Buffer.concat(chunks)
    if (size !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Immutable content hash mismatch')
    return bytes
  }
  async readVerifiedJson(file: { path: string; bytes: number; sha256: string }): Promise<unknown> {
    try { return JSON.parse((await this.readVerifiedBytes(file)).toString('utf8')) as unknown }
    catch { throw new Error('Required private content failed verification; retry or request a compatible publication') }
  }
}
