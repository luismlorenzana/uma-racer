import type { SkillTemplate, UmaTemplate } from '@racer/domain'

/** Skills that belong to an Uma's own lineage identity, not skills inherited from another lineage slot. */
export function naturalLineageSkills(
  template: Pick<UmaTemplate, 'uniqueSkillId' | 'awakeningSkillIds'>,
  skills: ReadonlyMap<string, SkillTemplate>,
): SkillTemplate[] {
  const ids = [template.uniqueSkillId, ...template.awakeningSkillIds].filter((id): id is string => id !== null)
  const seen = new Set<string>()
  return ids.flatMap((id) => {
    if (seen.has(id)) return []
    const skill = skills.get(id)
    if (!skill || (id !== template.uniqueSkillId && skill.kind !== 'gold')) return []
    seen.add(id)
    return [skill]
  })
}

export function naturalGoldSkills(
  template: Pick<UmaTemplate, 'uniqueSkillId' | 'awakeningSkillIds'>,
  skills: ReadonlyMap<string, SkillTemplate>,
): SkillTemplate[] {
  return naturalLineageSkills(template, skills).filter((skill) => skill.kind === 'gold')
}
