// Lazy private chapter pack seam; no synthetic production fallback (docs/technical/rpg-chapter-content.md).
import { parseRpgChapterPack, type RpgChapterPack } from '@racer/domain'
import { contentApi } from '../api/client'
import type { ContentTransport, LoadedContent } from './runtime'

export async function loadRpgChapterPack(content: LoadedContent, transport: ContentTransport = contentApi): Promise<RpgChapterPack | null> {
  const files = content.manifest.files.filter((f) => /^data\/rpg-chapters\.[a-f0-9]{8}\.json$/.test(f.path))
  if (files.length === 0) return null
  if (files.length !== 1) throw new Error('RPG chapter pack is ambiguous')
  const file = files[0]!
  const { bytes, contentType } = await transport.file(file.path)
  if (contentType.split(';')[0]?.trim() !== 'application/json' || bytes.byteLength !== file.bytes) throw new Error('Invalid RPG chapter bytes or type')
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((part) => part.toString(16).padStart(2, '0')).join('')
  if (hash !== file.sha256) throw new Error('RPG chapter hash mismatch')
  const raw: unknown = JSON.parse(new TextDecoder().decode(bytes))
  const version = typeof raw === 'object' && raw !== null && 'version' in raw && typeof raw.version === 'string' ? raw.version : ''
  const artKeys = content.manifest.files.flatMap((f) => {
    const match = /^art\/priconne\/([A-Za-z0-9_.:-]{1,24})\.[a-f0-9]{8}\.webp$/.exec(f.path)
    return match ? [match[1]!] : []
  })
  return parseRpgChapterPack(raw, { version, contentHash: hash, artKeys })
}
