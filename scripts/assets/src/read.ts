// Reads and verifies the T001 pack inputs used by the private asset pipeline.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { SCENARIOS, type ContentManifest, type ContentManifestFile } from '@racer/domain'
import type { ImageSource } from './download'

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function dataFile(manifest: ContentManifest, name: 'umas' | 'cards' | 'skills'): ContentManifestFile {
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

/**
 * Scenario crests have no pack entry — scenarios are a domain constant, not imported content — so their
 * sources come from a Claude-authored private override (D107), keyed by scenario id because GameTora's own
 * numbering is not our tier order.
 */
async function readScenarioIcons(contentDir: string): Promise<ImageSource[]> {
  let raw: string
  try {
    raw = await readFile(resolve(contentDir, 'overrides/scenario-icons.json'), 'utf8')
  } catch {
    // Absent is legal: the crest atlas is simply not built, and the app falls back to no crest.
    return []
  }
  const parsed: unknown = JSON.parse(raw)
  const icons = (parsed as { icons?: unknown } | null)?.icons
  if (!icons || typeof icons !== 'object') throw new Error('scenario-icons.json must hold an "icons" object')
  return Object.entries(icons as Record<string, unknown>).map(([id, url]) => {
    if (!SCENARIOS.some((scenario) => scenario.id === id)) {
      throw new Error(`scenario-icons.json names an unknown scenario: ${id}`)
    }
    if (typeof url !== 'string' || !/^https:\/\//.test(url)) {
      throw new Error(`scenario-icons.json has an invalid source for ${id}`)
    }
    return { id, url }
  })
}

/** Every icon the skills pack uses, once, keyed by the skill's `iconId` (D182). */
export function parseSkillIcons(bytes: Buffer): ImageSource[] {
  const { items } = JSON.parse(bytes.toString('utf8')) as { items: { iconId?: unknown }[] }
  const ids = new Set<string>()
  for (const item of items) {
    if (typeof item.iconId === 'number' && Number.isSafeInteger(item.iconId) && item.iconId > 0) ids.add(String(item.iconId))
  }
  return [...ids].sort().map((id) => ({ id, url: `https://gametora.com/images/umamusume/skill_icons/utx_ico_skill_${id}.png` }))
}

/** Each Uma outfit's character, from the verified pack: T059's stands and faces are per character. */
function parseCharas(bytes: Buffer): { id: string; charaId: string }[] {
  const { items } = JSON.parse(bytes.toString('utf8')) as { items: { id?: unknown; charaId?: unknown }[] }
  return items.map((item, index) => {
    if (typeof item.id !== 'string' || typeof item.charaId !== 'string' || !/^\d{4}$/.test(item.charaId)) {
      throw new Error(`Invalid Uma character id at index ${index}`)
    }
    return { id: item.id, charaId: item.charaId }
  })
}

export async function readAssetSources(
  contentDir: string,
): Promise<{
  manifest: ContentManifest
  umas: ImageSource[]
  umaCharas: { id: string; charaId: string }[]
  cards: ImageSource[]
  scenarios: ImageSource[]
  skills: ImageSource[]
}> {
  let manifest: ContentManifest
  try {
    manifest = JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as ContentManifest
  } catch {
    throw new Error('Content manifest not found; run pnpm data:import first')
  }
  const umaFile = dataFile(manifest, 'umas')
  const cardFile = dataFile(manifest, 'cards')
  const skillFile = dataFile(manifest, 'skills')
  const [umaBytes, cardBytes, skillBytes] = await Promise.all([
    verifiedPack(contentDir, umaFile),
    verifiedPack(contentDir, cardFile),
    verifiedPack(contentDir, skillFile),
  ])
  return {
    manifest,
    umas: parseSources(umaBytes, 'umas'),
    umaCharas: parseCharas(umaBytes),
    cards: parseSources(cardBytes, 'cards'),
    scenarios: await readScenarioIcons(contentDir),
    skills: parseSkillIcons(skillBytes),
  }
}
