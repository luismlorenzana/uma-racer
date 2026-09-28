// Pure GameTora character-card normalization (docs/design/uma-progression.md).

import { GRADES, type Aptitudes, type Grade, type Stats, type UmaTemplate } from '@racer/domain'
import { id, ids, number as numberValue, records, text, type NormalizeResult, type RawRecord } from './shared'

const LAUNCH_DATE = '2021-02-24'

function stats(value: unknown, scale = 1): Stats | null {
  if (!Array.isArray(value) || value.length < 5) return null
  const values = value.slice(0, 5).map(numberValue)
  if (values.some((entry) => entry === null)) return null
  const [speed, stamina, power, guts, wit] = values as [number, number, number, number, number]
  return {
    speed: speed * scale,
    stamina: stamina * scale,
    power: power * scale,
    guts: guts * scale,
    wit: wit * scale,
  }
}

function grade(value: unknown): Grade | null {
  return typeof value === 'string' && GRADES.includes(value as Grade) ? (value as Grade) : null
}

function aptitudes(value: unknown): Aptitudes | null {
  if (!Array.isArray(value) || value.length < 10) return null
  const values = value.slice(0, 10).map(grade)
  if (values.some((entry) => entry === null)) return null
  const [turf, dirt, sprint, mile, medium, long, front, pace, late, end] = values as [
    Grade,
    Grade,
    Grade,
    Grade,
    Grade,
    Grade,
    Grade,
    Grade,
    Grade,
    Grade,
  ]
  return {
    surface: { turf, dirt },
    distance: { sprint, mile, medium, long },
    strategy: { front, pace, late, end },
  }
}

function horseSex(character: RawRecord | undefined): UmaTemplate['realHorseSex'] {
  if (character?.sex === 1) return 'male'
  if (character?.sex === 2) return 'female'
  return null
}

export function normalizeUmas(
  characterCards: unknown,
  characters: unknown,
  signatureFamilies: ReadonlyMap<string, readonly string[]> = new Map(),
): NormalizeResult<UmaTemplate> {
  const warnings: string[] = []
  const charactersById = new Map(records(characters).map((row) => [id(row.char_id), row]))
  const items: UmaTemplate[] = []

  for (const row of records(characterCards)) {
    const umaId = id(row.card_id)
    const charaId = id(row.char_id)
    const name = text(row.name_en)
    const jpRelease = text(row.release)
    const baseStats = stats(row.five_star_stats)
    const growthRates = stats(row.stat_bonus, 0.01)
    const aptitude = aptitudes(row.aptitude)

    if (!umaId || !charaId || !name || !jpRelease || !baseStats || !growthRates || !aptitude) {
      warnings.push(`Uma ${umaId ?? '<missing id>'} has invalid required fields and was skipped`)
      continue
    }

    const uniqueSkills = ids(row.skills_unique)
    items.push({
      id: umaId,
      charaId,
      name,
      outfit: text(row.title_en_gl) ?? text(row.title),
      jpRelease,
      globalRelease: text(row.release_en),
      starter: jpRelease === LAUNCH_DATE,
      baseStats,
      growthRates,
      aptitudes: aptitude,
      uniqueSkillId: uniqueSkills[0] ?? null,
      awakeningSkillIds: ids(row.skills_awakening_en ?? row.skills_awakening),
      // Her innate skills and her own story events' skills (D186); the library deduplicates repeats across lists.
      innateSkillIds: [...new Set(ids(row.skills_innate))],
      eventSkillIds: [...new Set(ids(row.skills_event))],
      realHorseSex: horseSex(charactersById.get(charaId)),
      signatureRaceFamilyIds: [...(signatureFamilies.get(charaId) ?? [])],
      imageSource: `https://gametora.com/images/umamusume/characters/thumb/chara_stand_${charaId}_${umaId}.png`,
    })
  }

  return { items, warnings }
}
