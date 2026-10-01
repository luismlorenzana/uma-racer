// Pure outfit RPG progression and tree rules (docs/design/uma-rpg.md, D219/D227).
import type { UmaTemplate } from '../content'
import {
  DISTANCE_CATEGORIES, GRADES, STATS, STRATEGIES, SURFACES,
  type Aptitudes, type Grade, type Stats, type Strategy,
} from '../types'

export const RPG_ELEMENTS = ['fire', 'ice', 'lightning', 'light', 'dark'] as const
export type RpgElement = typeof RPG_ELEMENTS[number]
export const RPG_WEAPONS = ['greatsword', 'spear', 'sword-shield', 'wizard-staff', 'cleric-staff', 'tome'] as const
export type RpgWeapon = typeof RPG_WEAPONS[number]
export const RPG_TIER_MAX_LEVEL = 50
export const RPG_TREE_POINTS_PER_EVEN_LEVEL = 1
export const RPG_SKILL_MAX_LEVEL = 5
export const RPG_DEPTH_GATES = [2, 10, 20, 34, 50] as const
export const RPG_B_MAX_DEPTH = 3
export const RPG_ACTIVE_SLOT_GATES = [1, 10, 20, 35, 50] as const
export const RPG_MAX_LEGACY_SLOTS = 2
export const RPG_SIGNATURE_MULTIPLIER = 1.1

const WEAPONS_BY_STYLE: Record<Strategy, readonly RpgWeapon[]> = {
  front: ['greatsword'], pace: ['spear', 'sword-shield'],
  late: ['wizard-staff', 'cleric-staff'], end: ['tome'],
}
const ELEMENTS_BY_DISTANCE: Record<typeof DISTANCE_CATEGORIES[number], readonly RpgElement[]> = {
  sprint: ['dark', 'light'], mile: ['ice', 'light'],
  medium: ['fire', 'dark'], long: ['lightning', 'light'],
}

export type RpgAffinity = 'A' | 'B'
export type RpgAffinities = Partial<Record<RpgElement, RpgAffinity>>
export type RpgBranch = 'foundation' | 'focused' | 'area' | 'committed' | 'multi' | 'role' | 'hybrid' | 'signature'
const BRANCHES: readonly (readonly RpgBranch[])[] = [
  ['foundation'], ['focused', 'area'], ['committed', 'multi'], ['role', 'hybrid'], ['signature'],
]

export interface RpgSkillRef {
  tier: number
  weapon: RpgWeapon
  element: RpgElement
  depth: number
  branch: RpgBranch
}
export interface RpgSkill extends RpgSkillRef { level: number }
export interface RpgProfile {
  outfitId: string
  sourceContentVersion: string
  /** Deep copies at enrollment; mutable scenario/racing builds are never consulted again. */
  baseStats: Stats
  growthRates: Stats
  sourceAptitudes: Aptitudes
  affinities: RpgAffinities
  style: Strategy
  weapon: RpgWeapon
  defaultSignature: RpgElement
  tier: number
  level: number
  exp: number
  /** Only this tier's purchased nodes. Earlier mastery is archived by the save layer. */
  tree: RpgSkill[]
  /** At most two deliberately carried, already learned techniques from earlier tiers. */
  legacy: RpgSkill[]
}
export interface RpgCoreStats extends Stats {
  atk: number
  matk: number
  initiative: number
  pdef: number
  mdef: number
  dexterity: number
  hp: number
  mp: number
}

function requireSafe(value: number, name: string, min = 0): void {
  if (!Number.isSafeInteger(value) || value < min) throw new RangeError(`Invalid ${name}`)
}

function frozenStats(value: Stats, name: string, growth = false): Stats {
  if (!value || typeof value !== 'object') throw new RangeError(`Missing ${name}`)
  const copy = {} as Stats
  for (const key of STATS) {
    const number = value[key]
    if (!Number.isFinite(number) || number < 0 || (growth ? number > 1 : !Number.isSafeInteger(number))) {
      throw new RangeError(`Invalid ${name}.${key}`)
    }
    copy[key] = number
  }
  return copy
}

function frozenAptitudes(value: Aptitudes): Aptitudes {
  if (!value || typeof value !== 'object') throw new RangeError('Missing aptitudes')
  const copy = {} as Aptitudes
  for (const [group, keys] of [
    ['surface', SURFACES], ['distance', DISTANCE_CATEGORIES], ['strategy', STRATEGIES],
  ] as const) {
    const source = value[group]
    if (!source || typeof source !== 'object') throw new RangeError(`Missing ${group} aptitudes`)
    const record: Record<string, Grade> = {}
    for (const key of keys) {
      const grade = source[key as keyof typeof source]
      if (!GRADES.includes(grade)) throw new RangeError(`Invalid ${group}.${key} aptitude`)
      record[key] = grade
    }
    // The cast is local to copying a completely validated discriminated record.
    Object.assign(copy, { [group]: record })
  }
  return copy
}

export function rpgAffinities(aptitudes: Aptitudes): RpgAffinities {
  const source = frozenAptitudes(aptitudes)
  const result: RpgAffinities = {}
  for (const distance of DISTANCE_CATEGORIES) {
    const grade = source.distance[distance]
    if (grade !== 'A' && grade !== 'B') continue
    for (const element of ELEMENTS_BY_DISTANCE[distance]) {
      if (grade === 'A' || result[element] !== 'A') result[element] = grade
    }
  }
  return result
}

export function rpgWeaponsForStyle(style: Strategy): readonly RpgWeapon[] {
  if (!STRATEGIES.includes(style)) throw new RangeError('Invalid RPG style')
  return WEAPONS_BY_STYLE[style]
}

export function eligibleRpgCells(profile: Pick<RpgProfile, 'weapon' | 'affinities'>): Array<{
  weapon: RpgWeapon; element: RpgElement; affinity: RpgAffinity; maxDepth: number
}> {
  return RPG_ELEMENTS.flatMap((element) => {
    const affinity = profile.affinities[element]
    return affinity ? [{ weapon: profile.weapon, element, affinity,
      maxDepth: affinity === 'A' ? RPG_DEPTH_GATES.length : RPG_B_MAX_DEPTH }] : []
  })
}

export function enrollRpgOutfit(input: {
  outfit: Pick<UmaTemplate, 'id' | 'baseStats' | 'growthRates' | 'aptitudes'>
  contentVersion: string
  style: Strategy
  weapon: RpgWeapon
  defaultSignature: RpgElement
}): RpgProfile {
  const { outfit, style, weapon, defaultSignature, contentVersion } = input
  if (!outfit || typeof outfit.id !== 'string' || !outfit.id.trim() || outfit.id.length > 128) {
    throw new RangeError('Invalid outfit id')
  }
  if (typeof contentVersion !== 'string' || !contentVersion.trim() || contentVersion.length > 128) {
    throw new RangeError('Invalid content version')
  }
  const baseStats = frozenStats(outfit.baseStats, 'base stats')
  const growthRates = frozenStats(outfit.growthRates, 'growth rates', true)
  const sourceAptitudes = frozenAptitudes(outfit.aptitudes)
  if (!STRATEGIES.some((candidate) => sourceAptitudes.strategy[candidate] === 'A')) {
    throw new RangeError('Outfit has no A running style')
  }
  if (!STRATEGIES.includes(style) || sourceAptitudes.strategy[style] !== 'A') {
    throw new RangeError('Style is not an A running style')
  }
  if (!rpgWeaponsForStyle(style).includes(weapon)) throw new RangeError('Weapon is not in the locked style')
  const affinities = rpgAffinities(sourceAptitudes)
  if (!RPG_ELEMENTS.includes(defaultSignature) || !affinities[defaultSignature]) {
    throw new RangeError('Signature has no A/B distance affinity')
  }
  return {
    outfitId: outfit.id, sourceContentVersion: contentVersion, baseStats, growthRates,
    sourceAptitudes, affinities, style, weapon, defaultSignature,
    tier: 1, level: 1, exp: 0, tree: [], legacy: [],
  }
}

export function rpgExpToNext(level: number): number {
  requireSafe(level, 'RPG level', 1)
  if (level >= RPG_TIER_MAX_LEVEL) throw new RangeError('Lv50 banks EXP until promotion')
  return 120 + 16 * level
}

export function rpgLifetimeLevels(tier: number, level: number): number {
  requireSafe(tier, 'RPG tier', 1)
  requireSafe(level, 'RPG level', 1)
  if (level > RPG_TIER_MAX_LEVEL) throw new RangeError('RPG level exceeds tier')
  const lifetime = RPG_TIER_MAX_LEVEL * (tier - 1) + level - 1
  requireSafe(lifetime, 'lifetime RPG levels')
  return lifetime
}

export function projectRpgStats(profile: Pick<RpgProfile, 'baseStats' | 'growthRates' | 'tier' | 'level'>): RpgCoreStats {
  const lifetime = rpgLifetimeLevels(profile.tier, profile.level)
  const base = frozenStats(profile.baseStats, 'base stats')
  const growth = frozenStats(profile.growthRates, 'growth rates', true)
  const core = {} as Stats
  for (const key of STATS) {
    const projected = Math.round(base[key] / 5 + lifetime * 1.5 * (1 + growth[key]))
    requireSafe(projected, `projected ${key}`)
    core[key] = projected
  }
  const hp = 100 + 6 * core.stamina + 2 * core.power
  const mp = 20 + 3 * core.wit
  requireSafe(hp, 'projected HP')
  requireSafe(mp, 'projected MP')
  return { ...core, atk: core.speed, matk: core.speed, initiative: core.stamina,
    pdef: core.power, mdef: Math.round((core.power + core.wit) / 2),
    dexterity: core.guts, hp, mp }
}

export function rpgTreePointsEarned(level: number): number {
  rpgLifetimeLevels(1, level)
  return Math.floor(level / 2) * RPG_TREE_POINTS_PER_EVEN_LEVEL
}

export function rpgActiveSlots(level: number): number {
  rpgLifetimeLevels(1, level)
  return RPG_ACTIVE_SLOT_GATES.filter((gate) => level >= gate).length + 2
}

export function rpgTreePointsSpent(tree: readonly RpgSkill[]): number {
  return tree.reduce((sum, skill) => sum + skill.level, 0)
}

export function rpgSkillKey(ref: RpgSkillRef): string {
  return `${ref.tier}:${ref.weapon}:${ref.element}:${ref.depth}:${ref.branch}`
}

export function canUseRpgSignature(profile: Pick<RpgProfile, 'affinities'>, element: RpgElement): boolean {
  return RPG_ELEMENTS.includes(element) && Boolean(profile.affinities[element])
}

export function rpgSignatureMagnitude(
  magnitude: number,
  profile: Pick<RpgProfile, 'weapon' | 'affinities'>,
  action: { kind: 'damage' | 'healing'; weapon: RpgWeapon; element: RpgElement | null },
  activeSignature: RpgElement,
): number {
  requireSafe(magnitude, 'RPG magnitude')
  if (!canUseRpgSignature(profile, activeSignature)) throw new RangeError('Ineligible active signature')
  const result = action.weapon === profile.weapon && action.element === activeSignature
    ? Math.round(magnitude * RPG_SIGNATURE_MULTIPLIER) : magnitude
  requireSafe(result, 'specialized magnitude')
  return result
}

export function grantRpgExp(profile: RpgProfile, amount: number): { profile: RpgProfile; levelsCrossed: number[] } {
  requireSafe(amount, 'RPG EXP grant')
  rpgLifetimeLevels(profile.tier, profile.level)
  requireSafe(profile.exp, 'RPG EXP bank')
  if (amount > Number.MAX_SAFE_INTEGER - profile.exp) throw new RangeError('RPG EXP overflow')
  let exp = profile.exp + amount
  let level = profile.level
  const levelsCrossed: number[] = []
  while (level < RPG_TIER_MAX_LEVEL && exp >= rpgExpToNext(level)) {
    exp -= rpgExpToNext(level)
    level += 1
    levelsCrossed.push(level)
  }
  return { profile: { ...profile, level, exp }, levelsCrossed }
}

export function spendRpgTreePoint(profile: RpgProfile, ref: RpgSkillRef): RpgProfile {
  if (ref.tier !== profile.tier || ref.weapon !== profile.weapon ||
    !RPG_ELEMENTS.includes(ref.element) || !Number.isInteger(ref.depth) ||
    ref.depth < 1 || ref.depth > RPG_DEPTH_GATES.length ||
    !BRANCHES[ref.depth - 1]?.includes(ref.branch)) throw new RangeError('Invalid tree cell')
  const affinity = profile.affinities[ref.element]
  if (!affinity || (affinity === 'B' && ref.depth > RPG_B_MAX_DEPTH)) {
    throw new RangeError('Element cannot reach this depth')
  }
  if (profile.level < RPG_DEPTH_GATES[ref.depth - 1]!) throw new RangeError('Depth level gate is closed')
  if (rpgTreePointsSpent(profile.tree) >= rpgTreePointsEarned(profile.level)) throw new RangeError('No tree point')
  const key = rpgSkillKey(ref)
  const current = profile.tree.find((skill) => rpgSkillKey(skill) === key)
  if (current && current.level >= RPG_SKILL_MAX_LEVEL) throw new RangeError('Skill is mastered')
  if (!current && ref.depth > 1 && !profile.tree.some((skill) =>
    skill.element === ref.element && skill.depth === ref.depth - 1)) {
    throw new RangeError('Previous tree depth is missing')
  }
  const tree = current
    ? profile.tree.map((skill) => rpgSkillKey(skill) === key ? { ...skill, level: skill.level + 1 } : skill)
    : [...profile.tree, { ...ref, level: 1 }]
  return { ...profile, tree }
}

export function validateRpgLoadout(
  profile: RpgProfile, activeSignature: RpgElement, refs: readonly RpgSkillRef[],
): boolean {
  if (!canUseRpgSignature(profile, activeSignature) || refs.length > rpgActiveSlots(profile.level)) return false
  const seen = new Set<string>()
  let legacyCount = 0
  for (const ref of refs) {
    const key = rpgSkillKey(ref)
    if (seen.has(key) || ref.weapon !== profile.weapon) return false
    seen.add(key)
    if (ref.tier < profile.tier) legacyCount += 1
    const source = ref.tier === profile.tier ? profile.tree : profile.legacy
    if (!source.some((skill) => rpgSkillKey(skill) === key)) return false
  }
  return legacyCount <= RPG_MAX_LEGACY_SLOTS
}

export function promoteRpgOutfit(
  profile: RpgProfile, selectedLegacy: readonly RpgSkillRef[], discardUnspentPoints = false,
): { profile: RpgProfile; archivedTier: { tier: number; tree: RpgSkill[] } ; levelsCrossed: number[] } {
  if (profile.level !== RPG_TIER_MAX_LEVEL) throw new RangeError('Promotion requires Lv50')
  if (!discardUnspentPoints && rpgTreePointsSpent(profile.tree) < rpgTreePointsEarned(profile.level)) {
    throw new RangeError('Unspent tree points require an explicit discard choice')
  }
  requireSafe(profile.tier + 1, 'next RPG tier', 1)
  if (selectedLegacy.length > RPG_MAX_LEGACY_SLOTS) throw new RangeError('Too many legacy skills')
  const available = [...profile.tree, ...profile.legacy]
  const keys = selectedLegacy.map(rpgSkillKey)
  if (new Set(keys).size !== keys.length || keys.some((key) => !available.some((skill) => rpgSkillKey(skill) === key))) {
    throw new RangeError('Legacy selection was not learned')
  }
  const legacy = keys.map((key) => ({ ...available.find((skill) => rpgSkillKey(skill) === key)! }))
  const archivedTier = { tier: profile.tier, tree: profile.tree.map((skill) => ({ ...skill })) }
  const promoted = { ...profile, tier: profile.tier + 1, level: 1, exp: profile.exp,
    tree: [] as RpgSkill[], legacy }
  // The Lv50 bank is applied only after the explicit tier transition.
  const settled = grantRpgExp({ ...promoted, exp: 0 }, promoted.exp)
  return { ...settled, archivedTier }
}
