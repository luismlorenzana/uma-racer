// Frozen parent selection and scenario-start inheritance (docs/design/skills-and-inheritance.md#inheritance).

import type { SkillTemplate, UmaTemplate } from './content'
import {
  SAVE_ID_PATTERN,
  type ParentSnapshot,
  type SkillUnlock,
  type UmaSave,
} from './save'
import {
  DISTANCE_CATEGORIES,
  GRADES,
  STRATEGIES,
  SURFACES,
  type Aptitudes,
  type Grade,
} from './types'

export const GRANDPARENT_UNIQUE_PICK_CAP = 2

export type AptitudeCategory =
  | `surface:${(typeof SURFACES)[number]}`
  | `distance:${(typeof DISTANCE_CATEGORIES)[number]}`
  | `strategy:${(typeof STRATEGIES)[number]}`

export interface ParentFingerprint {
  umaId: string
  completedTier: number
  takenAt: number
}

export interface ScenarioStartSelection {
  parents: ParentFingerprint[]
  grandparentUniqueSkillIds: string[]
  grandparentWhiteSkillIds: string[]
  pinkSparks: (AptitudeCategory | null)[]
}

export const EMPTY_SCENARIO_START_SELECTION: ScenarioStartSelection = {
  parents: [],
  grandparentUniqueSkillIds: [],
  grandparentWhiteSkillIds: [],
  pinkSparks: [],
}

export type ParentIssueCode =
  | 'no-snapshot'
  | 'self-character'
  | 'already-selected-character'
  | 'malformed-snapshot'
  | 'missing-content'
  | 'missing-skill'
  | 'unsafe-id'
  | 'stale-fingerprint'

export interface ParentCandidate {
  umaId: string
  charaId: string | null
  privateArtId: string
  fingerprint: ParentFingerprint | null
  snapshot: ParentSnapshot | null
  frozenParentMiniIds: string[]
  newAutomaticUniqueCount: number
  newAutomaticWhiteCount: number
  issues: ParentIssueCode[]
  eligible: boolean
}

export type GrandparentIssueCode = 'child-character' | 'chosen-parent-character' | 'duplicate-character' | 'missing-skill'

export interface GrandparentContributor {
  parentUmaId: string
  snapshot: ParentSnapshot['parents'][number]
  issues: GrandparentIssueCode[]
  eligible: boolean
}

export interface InheritanceSkillOption {
  skillId: string
  sourceUmaId: string
}

export interface GrandparentProjection {
  contributors: GrandparentContributor[]
  uniquePool: InheritanceSkillOption[]
  whitePool: InheritanceSkillOption[]
  uniquePickCap: number
  whitePickCap: number
}

export interface PinkSparkOption {
  category: AptitudeCategory
  before: Grade
  after: Grade
}

export interface PinkSparkProjection {
  parentUmaId: string
  options: PinkSparkOption[]
  selected: AptitudeCategory | null
  beforeAptitudes: Aptitudes
  afterAptitudes: Aptitudes
}

export interface ScenarioInheritanceResult {
  currentParents: ParentSnapshot[]
  skillLibrary: SkillUnlock[]
  aptitudes: Aptitudes
  pinkSparks: PinkSparkProjection[]
  grandparents: GrandparentProjection
}

const cloneAptitudes = (aptitudes: Aptitudes): Aptitudes => ({
  surface: { ...aptitudes.surface },
  distance: { ...aptitudes.distance },
  strategy: { ...aptitudes.strategy },
})

export function cloneParentSnapshot(snapshot: ParentSnapshot): ParentSnapshot {
  return {
    ...snapshot,
    aptitudes: cloneAptitudes(snapshot.aptitudes),
    inheritableWhiteSkillIds: [...snapshot.inheritableWhiteSkillIds],
    parents: snapshot.parents.map((parent) => ({
      ...parent,
      aptitudes: cloneAptitudes(parent.aptitudes),
      inheritableWhiteSkillIds: [...parent.inheritableWhiteSkillIds],
    })),
  }
}

export function parentFingerprint(snapshot: ParentSnapshot): ParentFingerprint {
  return { umaId: snapshot.umaId, completedTier: snapshot.completedTier, takenAt: snapshot.takenAt }
}

export function sameParentFingerprint(left: ParentFingerprint, right: ParentFingerprint): boolean {
  return left.umaId === right.umaId && left.completedTier === right.completedTier && left.takenAt === right.takenAt
}

export function grandparentWhitePickCap(poolSize: number): number {
  if (!Number.isSafeInteger(poolSize) || poolSize < 0) throw new Error('Grandparent white pool size is invalid')
  return Math.ceil(poolSize / 2)
}

function contentIssues(snapshot: ParentSnapshot, skills: ReadonlyMap<string, SkillTemplate>): ParentIssueCode[] {
  const ids = [snapshot.umaId, snapshot.charaId, snapshot.inheritedUniqueSkillId, ...snapshot.inheritableWhiteSkillIds]
    .filter((id): id is string => id !== null)
  if (ids.some((id) => !SAVE_ID_PATTERN.test(id))) return ['unsafe-id']
  if (snapshot.inheritedUniqueSkillId) {
    const unique = skills.get(snapshot.inheritedUniqueSkillId)
    if (!unique || unique.kind !== 'inherited-unique') return ['missing-skill']
  }
  if (snapshot.inheritableWhiteSkillIds.some((id) => skills.get(id)?.kind !== 'white')) return ['missing-skill']
  return []
}

/** Project every owned Uma without consulting any live parent gameplay field. */
export function projectParentCandidates(input: {
  child: UmaSave
  childTemplate: UmaTemplate
  ownedUmas: readonly UmaSave[]
  umaTemplates: ReadonlyMap<string, UmaTemplate>
  skills: ReadonlyMap<string, SkillTemplate>
  selected?: readonly ParentFingerprint[]
  permanentSkillIds?: ReadonlySet<string>
}): ParentCandidate[] {
  const selected = input.selected ?? []
  const selectedCharacters = new Set(selected.flatMap((fingerprint) => {
    const candidate = input.ownedUmas.find((uma) => uma.templateId === fingerprint.umaId)
    return candidate?.parentSnapshot ? [candidate.parentSnapshot.charaId] : []
  }))
  const permanent = input.permanentSkillIds ?? new Set(input.child.skillLibrary.map((unlock) => unlock.skillId))
  return [...input.ownedUmas].sort((left, right) => left.templateId.localeCompare(right.templateId)).map((owned) => {
    const snapshot = owned.parentSnapshot ? cloneParentSnapshot(owned.parentSnapshot) : null
    const template = input.umaTemplates.get(owned.templateId)
    const issues: ParentIssueCode[] = []
    if (!snapshot) issues.push('no-snapshot')
    if (!template || (snapshot && template.charaId !== snapshot.charaId)) issues.push('missing-content')
    if (snapshot?.charaId === input.childTemplate.charaId) issues.push('self-character')
    if (snapshot && selectedCharacters.has(snapshot.charaId) && !selected.some((item) => item.umaId === snapshot.umaId)) {
      issues.push('already-selected-character')
    }
    if (snapshot) issues.push(...contentIssues(snapshot, input.skills))
    const selectedFingerprint = selected.find((item) => item.umaId === owned.templateId)
    if (snapshot && selectedFingerprint && !sameParentFingerprint(selectedFingerprint, parentFingerprint(snapshot))) {
      issues.push('stale-fingerprint')
    }
    const alreadyKnown = new Set(permanent)
    for (const fingerprint of selected) {
      if (fingerprint.umaId === owned.templateId) break
      const prior = input.ownedUmas.find((uma) => uma.templateId === fingerprint.umaId)?.parentSnapshot
      if (!prior) continue
      if (prior.inheritedUniqueSkillId) alreadyKnown.add(prior.inheritedUniqueSkillId)
      prior.inheritableWhiteSkillIds.forEach((id) => alreadyKnown.add(id))
    }
    const newUnique = snapshot?.inheritedUniqueSkillId && !alreadyKnown.has(snapshot.inheritedUniqueSkillId) ? 1 : 0
    const newWhites = snapshot?.inheritableWhiteSkillIds.filter((id) => !alreadyKnown.has(id)).length ?? 0
    return {
      umaId: owned.templateId,
      charaId: snapshot?.charaId ?? template?.charaId ?? null,
      privateArtId: owned.templateId,
      fingerprint: snapshot ? parentFingerprint(snapshot) : null,
      snapshot,
      frozenParentMiniIds: snapshot?.parents.map((parent) => parent.umaId) ?? [],
      newAutomaticUniqueCount: newUnique,
      newAutomaticWhiteCount: newWhites,
      issues: [...new Set(issues)],
      eligible: issues.length === 0,
    }
  })
}

function compareFrozenGrandparent(
  left: ParentSnapshot['parents'][number],
  right: ParentSnapshot['parents'][number],
): number {
  return right.takenAt - left.takenAt || right.completedTier - left.completedTier || left.umaId.localeCompare(right.umaId)
}

/** Resolve a finite, closest-only grandparent pool from the selected snapshots. */
export function projectGrandparents(input: {
  childCharaId: string
  parents: readonly ParentSnapshot[]
  skills: ReadonlyMap<string, SkillTemplate>
  excludedSkillIds: ReadonlySet<string>
}): GrandparentProjection {
  const parentCharacters = new Set(input.parents.map((parent) => parent.charaId))
  const grouped = new Map<string, { parentUmaId: string; snapshot: ParentSnapshot['parents'][number] }[]>()
  for (const parent of input.parents) {
    for (const grandparent of parent.parents) {
      const group = grouped.get(grandparent.charaId) ?? []
      group.push({ parentUmaId: parent.umaId, snapshot: grandparent })
      grouped.set(grandparent.charaId, group)
    }
  }
  const contributors: GrandparentContributor[] = []
  for (const charaId of [...grouped.keys()].sort()) {
    const entries = grouped.get(charaId)!.sort((left, right) => compareFrozenGrandparent(left.snapshot, right.snapshot))
    entries.forEach((entry, index) => {
      const issues: GrandparentIssueCode[] = []
      if (charaId === input.childCharaId) issues.push('child-character')
      if (parentCharacters.has(charaId)) issues.push('chosen-parent-character')
      if (index > 0) issues.push('duplicate-character')
      const unique = entry.snapshot.inheritedUniqueSkillId
      if ((unique && input.skills.get(unique)?.kind !== 'inherited-unique') || entry.snapshot.inheritableWhiteSkillIds.some((id) => input.skills.get(id)?.kind !== 'white')) {
        issues.push('missing-skill')
      }
      contributors.push({ parentUmaId: entry.parentUmaId, snapshot: { ...entry.snapshot, aptitudes: cloneAptitudes(entry.snapshot.aptitudes), inheritableWhiteSkillIds: [...entry.snapshot.inheritableWhiteSkillIds] }, issues, eligible: issues.length === 0 })
    })
  }
  const uniqueById = new Map<string, InheritanceSkillOption>()
  const whiteById = new Map<string, InheritanceSkillOption>()
  for (const contributor of contributors.filter((item) => item.eligible)) {
    const unique = contributor.snapshot.inheritedUniqueSkillId
    if (unique && !input.excludedSkillIds.has(unique) && !uniqueById.has(unique)) {
      uniqueById.set(unique, { skillId: unique, sourceUmaId: contributor.snapshot.umaId })
    }
    for (const white of contributor.snapshot.inheritableWhiteSkillIds) {
      if (!input.excludedSkillIds.has(white) && !whiteById.has(white)) {
        whiteById.set(white, { skillId: white, sourceUmaId: contributor.snapshot.umaId })
      }
    }
  }
  const uniquePool = [...uniqueById.values()].sort((a, b) => a.skillId.localeCompare(b.skillId) || a.sourceUmaId.localeCompare(b.sourceUmaId))
  const whitePool = [...whiteById.values()].sort((a, b) => a.skillId.localeCompare(b.skillId) || a.sourceUmaId.localeCompare(b.sourceUmaId))
  return {
    contributors,
    uniquePool,
    whitePool,
    uniquePickCap: Math.min(GRANDPARENT_UNIQUE_PICK_CAP, uniquePool.length),
    whitePickCap: grandparentWhitePickCap(whitePool.length),
  }
}

function readCategory(aptitudes: Aptitudes, category: AptitudeCategory): Grade {
  const [group, key] = category.split(':') as [keyof Aptitudes, string]
  if (group === 'surface') return aptitudes.surface[key as keyof Aptitudes['surface']]
  if (group === 'distance') return aptitudes.distance[key as keyof Aptitudes['distance']]
  return aptitudes.strategy[key as keyof Aptitudes['strategy']]
}

function writeCategory(aptitudes: Aptitudes, category: AptitudeCategory, grade: Grade): void {
  const [group, key] = category.split(':') as [keyof Aptitudes, string]
  if (group === 'surface') aptitudes.surface[key as keyof Aptitudes['surface']] = grade
  else if (group === 'distance') aptitudes.distance[key as keyof Aptitudes['distance']] = grade
  else aptitudes.strategy[key as keyof Aptitudes['strategy']] = grade
}

const ALL_APTITUDE_CATEGORIES: AptitudeCategory[] = [
  ...SURFACES.map((key) => `surface:${key}` as const),
  ...DISTANCE_CATEGORIES.map((key) => `distance:${key}` as const),
  ...STRATEGIES.map((key) => `strategy:${key}` as const),
]

function upgradedGrade(grade: Grade): Grade {
  const index = GRADES.indexOf(grade)
  return GRADES[Math.max(1, index - 1)]!
}

/** Apply selected pink sparks sequentially so a later parent sees earlier upgrades. */
export function projectPinkSparks(
  aptitudes: Aptitudes,
  parents: readonly ParentSnapshot[],
  selections: readonly (AptitudeCategory | null)[],
): { aptitudes: Aptitudes; projections: PinkSparkProjection[] } {
  if (selections.length !== parents.length) throw new Error('Each selected parent requires one pink-spark selection slot')
  let current = cloneAptitudes(aptitudes)
  const projections: PinkSparkProjection[] = []
  parents.forEach((parent, index) => {
    const beforeAptitudes = cloneAptitudes(current)
    const options = ALL_APTITUDE_CATEGORIES.flatMap((category): PinkSparkOption[] => {
      const parentGrade = readCategory(parent.aptitudes, category)
      const before = readCategory(current, category)
      if (!['A', 'S'].includes(parentGrade) || GRADES.indexOf(before) <= GRADES.indexOf('A')) return []
      return [{ category, before, after: upgradedGrade(before) }]
    })
    const selected = selections[index] ?? null
    if (options.length === 0 && selected !== null) throw new Error(`Parent ${parent.umaId} has no effective pink-spark option`)
    if (options.length > 0 && selected === null) throw new Error(`Parent ${parent.umaId} requires a pink-spark choice`)
    const chosen = selected === null ? null : options.find((option) => option.category === selected)
    if (selected !== null && !chosen) throw new Error(`Parent ${parent.umaId} pink-spark choice is not eligible`)
    if (chosen) writeCategory(current, chosen.category, chosen.after)
    projections.push({ parentUmaId: parent.umaId, options, selected, beforeAptitudes, afterAptitudes: cloneAptitudes(current) })
  })
  return { aptitudes: current, projections }
}

/** Produce a deterministic valid default while the UI still lets the player choose another option. */
export function suggestPinkSparkSelections(aptitudes: Aptitudes, parents: readonly ParentSnapshot[]): (AptitudeCategory | null)[] {
  let current = cloneAptitudes(aptitudes)
  return parents.map((parent) => {
    const selected = ALL_APTITUDE_CATEGORIES.find((category) => {
      const parentGrade = readCategory(parent.aptitudes, category)
      return ['A', 'S'].includes(parentGrade) && GRADES.indexOf(readCategory(current, category)) > GRADES.indexOf('A')
    }) ?? null
    if (selected) writeCategory(current, selected, upgradedGrade(readCategory(current, selected)))
    return selected
  })
}

function assertUniqueSafeIds(ids: readonly string[], label: string): void {
  if (ids.some((id) => !SAVE_ID_PATTERN.test(id)) || new Set(ids).size !== ids.length) throw new Error(`${label} contains invalid or duplicate ids`)
}

/** Strictly validate a draft against fresh snapshots and build the inherited library. */
export function resolveScenarioInheritance(input: {
  child: UmaSave
  childTemplate: UmaTemplate
  ownedUmas: readonly UmaSave[]
  umaTemplates: ReadonlyMap<string, UmaTemplate>
  skills: ReadonlyMap<string, SkillTemplate>
  permanentLibrary: readonly SkillUnlock[]
  selection: ScenarioStartSelection
}): ScenarioInheritanceResult {
  if (input.selection.parents.length > 2) throw new Error('At most two parents may be selected')
  assertUniqueSafeIds(input.selection.parents.map((item) => item.umaId), 'Parent selection')
  assertUniqueSafeIds(input.selection.grandparentUniqueSkillIds, 'Grandparent unique selection')
  assertUniqueSafeIds(input.selection.grandparentWhiteSkillIds, 'Grandparent white selection')
  if (input.selection.pinkSparks.length !== input.selection.parents.length) throw new Error('Pink-spark selections do not match the parents')

  const rows = projectParentCandidates({
    child: input.child,
    childTemplate: input.childTemplate,
    ownedUmas: input.ownedUmas,
    umaTemplates: input.umaTemplates,
    skills: input.skills,
    selected: input.selection.parents,
    permanentSkillIds: new Set(input.permanentLibrary.map((unlock) => unlock.skillId)),
  })
  const parents = input.selection.parents.map((fingerprint) => {
    const row = rows.find((candidate) => candidate.umaId === fingerprint.umaId)
    if (!row?.snapshot || !row.fingerprint) throw new Error(`Selected parent ${fingerprint.umaId} has no completed snapshot`)
    if (!sameParentFingerprint(fingerprint, row.fingerprint)) throw new Error(`Selected parent ${fingerprint.umaId} snapshot is stale`)
    if (!row.eligible) throw new Error(`Selected parent ${fingerprint.umaId} is not eligible: ${row.issues.join(', ')}`)
    return cloneParentSnapshot(row.snapshot)
  })
  if (new Set(parents.map((parent) => parent.charaId)).size !== parents.length) throw new Error('Selected parents must be different characters')

  const library: SkillUnlock[] = input.permanentLibrary.map((unlock) => ({ ...unlock }))
  const byId = new Set(library.map((unlock) => unlock.skillId))
  const addInherited = (skillId: string | null, sourceId: string): void => {
    if (!skillId || byId.has(skillId)) return
    library.push({ skillId, origin: 'inherited', sourceId })
    byId.add(skillId)
  }
  for (const parent of parents) addInherited(parent.inheritedUniqueSkillId, parent.umaId)
  for (const parent of parents) for (const white of parent.inheritableWhiteSkillIds) addInherited(white, parent.umaId)

  const grandparents = projectGrandparents({ childCharaId: input.childTemplate.charaId, parents, skills: input.skills, excludedSkillIds: byId })
  if (input.selection.grandparentUniqueSkillIds.length > grandparents.uniquePickCap) throw new Error('Too many grandparent unique skills selected')
  if (input.selection.grandparentWhiteSkillIds.length > grandparents.whitePickCap) throw new Error('Too many grandparent white skills selected')
  const uniquePool = new Map(grandparents.uniquePool.map((option) => [option.skillId, option]))
  const whitePool = new Map(grandparents.whitePool.map((option) => [option.skillId, option]))
  for (const id of input.selection.grandparentUniqueSkillIds) {
    const option = uniquePool.get(id)
    if (!option) throw new Error(`Grandparent unique skill ${id} is unavailable`)
    addInherited(id, option.sourceUmaId)
  }
  for (const id of input.selection.grandparentWhiteSkillIds) {
    const option = whitePool.get(id)
    if (!option) throw new Error(`Grandparent white skill ${id} is unavailable`)
    addInherited(id, option.sourceUmaId)
  }
  const sparks = projectPinkSparks(input.child.aptitudes, parents, input.selection.pinkSparks)
  return { currentParents: parents, skillLibrary: library, aptitudes: sparks.aptitudes, pinkSparks: sparks.projections, grandparents }
}
