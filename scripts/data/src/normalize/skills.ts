// Pure skill-catalog normalization (docs/design/skills-and-inheritance.md).

import type { SkillCondition, SkillKind, SkillTemplate } from '@racer/domain'
import { id, isRecord, number as numberValue, records, text, type NormalizeResult, type RawRecord } from './shared'

const KINDS: Record<number, SkillKind> = {
  1: 'white',
  2: 'gold',
  3: 'unique-upgraded',
  4: 'inherited-unique',
  5: 'unique',
}

const GLOBAL_TERMS = /\bFront Runner\b|\bPace Chaser\b|\bLate Surger\b|\bEnd Closer\b|\bRunner\b|\bLeader\b|\bBetweener\b|\bChaser\b/g
const TERM_REPLACEMENTS: Record<string, string> = {
  Runner: 'Front Runner',
  Leader: 'Pace Chaser',
  Betweener: 'Late Surger',
  Chaser: 'End Closer',
}

function clean(value: unknown): string {
  return (text(value) ?? '').replace(/\s+/g, ' ')
}

export function toGlobalTerms(value: string): string {
  return value.replace(GLOBAL_TERMS, (term) => TERM_REPLACEMENTS[term] ?? term)
}

function localizedEnglish(raw: RawRecord): RawRecord | null {
  const loc = isRecord(raw.loc) ? raw.loc : null
  return loc && isRecord(loc.en) ? loc.en : null
}

function conditionGroups(raw: RawRecord): SkillCondition[] {
  const localized = localizedEnglish(raw)
  const value = localized?.condition_groups ?? raw.condition_groups
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((group) => ({
    precondition: typeof group.precondition === 'string' ? group.precondition : null,
    condition: typeof group.condition === 'string' ? group.condition : null,
    baseTime: numberValue(group.base_time),
    cooldown: numberValue(group.cd),
    effects: Array.isArray(group.effects)
      ? group.effects
          .filter(isRecord)
          .map((effect) => ({ type: numberValue(effect.type), value: numberValue(effect.value) }))
          .filter((effect): effect is { type: number; value: number } => effect.type !== null && effect.value !== null)
      : [],
  }))
}

function geneVersion(raw: RawRecord): RawRecord | null {
  const localized = localizedEnglish(raw)
  const base = isRecord(raw.gene_version) ? raw.gene_version : null
  const localizedGene = isRecord(localized?.gene_version) ? localized.gene_version : null
  if (localizedGene) return { ...(base ?? {}), ...localizedGene }
  return base
}

function template(raw: RawRecord, forcedKind?: SkillKind, fallback?: RawRecord): SkillTemplate | null {
  const skillId = id(raw.id)
  const rarity = numberValue(raw.rarity)
  const kind = forcedKind ?? (rarity === null ? undefined : KINDS[rarity])
  const name =
    clean(raw.enname) ||
    clean(raw.name_en) ||
    clean(raw.jpname) ||
    clean(fallback?.enname) ||
    clean(fallback?.name_en) ||
    clean(fallback?.jpname)
  if (!skillId || !kind || !name) return null
  const description =
    clean(raw.desc_en) ||
    clean(raw.endesc) ||
    clean(raw.jpdesc) ||
    clean(fallback?.desc_en) ||
    clean(fallback?.endesc) ||
    clean(fallback?.jpdesc)
  const gene = forcedKind ? null : geneVersion(raw)
  return {
    id: skillId,
    kind,
    name,
    description: toGlobalTerms(description),
    costSp: numberValue(raw.cost),
    iconId: numberValue(raw.iconid),
    conditions: conditionGroups(raw),
    inheritedSkillId: gene ? id(gene.id) : null,
  }
}

export function normalizeSkills(value: unknown): NormalizeResult<SkillTemplate> {
  const warnings: string[] = []
  const sourceRows = records(value).filter((row) => numberValue(row.rarity) !== 6)
  const itemsById = new Map<string, SkillTemplate>()

  for (const raw of sourceRows) {
    const item = template(raw)
    if (!item) {
      warnings.push(`Skill ${id(raw.id) ?? '<missing id>'} has invalid required fields and was skipped`)
      continue
    }
    if (!itemsById.has(item.id)) itemsById.set(item.id, item)
  }

  for (const raw of sourceRows) {
    const gene = geneVersion(raw)
    if (!gene) continue
    const geneId = id(gene.id)
    if (!geneId || itemsById.has(geneId)) continue
    const item = template(gene, 'inherited-unique', raw)
    if (item) itemsById.set(item.id, item)
    else warnings.push(`Inherited skill ${geneId} has invalid required fields and was skipped`)
  }

  return { items: [...itemsById.values()], warnings }
}
