// Pure outfit RPG progression: classes, stats, points and class trees (docs/design/uma-rpg-classes.md, D277–D280).
import type { UmaTemplate } from '../content'
import {
  DISTANCE_CATEGORIES, GRADES, STATS, STRATEGIES, SURFACES,
  type Aptitudes, type Grade, type Stats, type Strategy,
} from '../types'
import { RPG_VARIANTS_PER_TREE, rpgNode, type RpgNode } from './catalog'
import { RPG_CLASSES, type RpgClass, type RpgTreeId, type RpgWeapon } from './kinds'

export * from './kinds'

export const RPG_TIER_MAX_LEVEL = 50
/** D264: two points a level up to Lv45, plus five each time a depth opens: 115 a tier. */
export const RPG_TREE_POINTS_PER_LEVEL = 2
export const RPG_TREE_POINT_MAX_LEVEL = 45
export const RPG_TREE_POINTS_PER_DEPTH = 5
export const RPG_DEPTH_GATES = [1, 10, 20, 30, 40] as const
/** Three slots at Lv1, one more at each gate: ten by Lv40 (D264). */
export const RPG_BASE_ACTIVE_SLOTS = 3
export const RPG_ACTIVE_SLOT_GATES = [10, 15, 20, 25, 30, 35, 40] as const
export const RPG_MAX_ACTIVE_SLOTS = RPG_BASE_ACTIVE_SLOTS + RPG_ACTIVE_SLOT_GATES.length
export const RPG_MAX_LEGACY_SLOTS = 2

/** A learned node of one tier: core nodes, variants and passives alike. */
export interface RpgNodeRef { tier: number; id: string }
export interface RpgProfile {
  outfitId: string
  sourceContentVersion: string
  /** Deep copies at enrollment; mutable scenario/racing builds are never consulted again. */
  baseStats: Stats
  growthRates: Stats
  sourceAptitudes: Aptitudes
  classId: RpgClass
  /** One of the class's weapon sets, main hand first. */
  weapons: RpgWeapon[]
  tier: number
  level: number
  exp: number
  /** Only this tier's learned nodes. Earlier mastery is archived by the save layer. */
  tree: RpgNodeRef[]
  /** At most two deliberately carried active skills from earlier tiers. */
  legacy: RpgNodeRef[]
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

// --- Classes -----------------------------------------------------------------------------------------------------------

const CLASS_BY_STYLES: Readonly<Record<string, RpgClass>> = {
  front: 'brawler', 'front+pace': 'brawler', pace: 'mage', 'pace+late': 'mage', late: 'cleric', end: 'summoner', 'late+end': 'summoner',
}
const CLASS_OF_STYLE: Readonly<Record<Strategy, RpgClass>> = { front: 'brawler', pace: 'mage', late: 'cleric', end: 'summoner' }
/** Weapon sets a class may enroll with; Mages pick any two of their three. */
export const RPG_CLASS_WEAPONS: Readonly<Record<RpgClass, readonly (readonly RpgWeapon[])[]>> = {
  brawler: [['greatsword', 'spear'], ['axe', 'bow']],
  mage: [['mage-staff', 'arcane-staff'], ['mage-staff', 'short-sword'], ['arcane-staff', 'short-sword']],
  cleric: [['arcane-staff', 'cleric-staff']],
  summoner: [['summoner-tome']],
}
/** Each class leans the shared projection (section 1). */
export const RPG_CLASS_STATS: Readonly<Record<RpgClass, { hp: number; atk: number; matk: number; pdef: number; mdef: number; mp: number }>> = {
  brawler: { hp: 1.15, atk: 1.1, matk: 0.9, pdef: 1.1, mdef: 0.9, mp: 0.8 },
  mage: { hp: 0.9, atk: 0.9, matk: 1.15, pdef: 0.9, mdef: 1.1, mp: 1.3 },
  cleric: { hp: 1, atk: 0.8, matk: 1, pdef: 1, mdef: 1.15, mp: 1.3 },
  summoner: { hp: 1, atk: 1, matk: 1, pdef: 1, mdef: 1, mp: 1.1 },
}

const aStyles = (aptitudes: Aptitudes): Strategy[] => STRATEGIES.filter((s) => aptitudes.strategy[s] === 'A' || aptitudes.strategy[s] === 'S')

/** The classes an outfit may take: its A running styles' class, or a choice among each A style's class. */
export function rpgClassOptions(aptitudes: Aptitudes): RpgClass[] {
  const styles = aStyles(aptitudes)
  if (!styles.length) return []
  const exact = CLASS_BY_STYLES[styles.join('+')]
  if (exact) return [exact]
  return RPG_CLASSES.filter((c) => styles.some((s) => CLASS_OF_STYLE[s] === c))
}

export const sameRpgWeapons = (a: readonly RpgWeapon[], b: readonly RpgWeapon[]): boolean => a.length === b.length && a.every((w, i) => w === b[i])
export function validRpgWeapons(classId: RpgClass, weapons: readonly RpgWeapon[]): boolean {
  return RPG_CLASS_WEAPONS[classId]?.some((set) => sameRpgWeapons(set, weapons)) ?? false
}

/** The class's two trees for its weapons. */
export function rpgClassTrees(classId: RpgClass, weapons: readonly RpgWeapon[]): RpgTreeId[] {
  if (classId === 'summoner') return ['summon-elemental', 'summon-arcane']
  return weapons as RpgTreeId[]
}
export const rpgProfileTrees = (p: Pick<RpgProfile, 'classId' | 'weapons'>): RpgTreeId[] => rpgClassTrees(p.classId, p.weapons)

/** How a build acts each turn: actions, the power and MP share of each skill, and its free action. */
export interface RpgHand { actions: 1 | 2; power: number; mp: number; free: { power: number; kind: 'weapon' | 'short-sword' | 'staff' | 'familiar' } }
export function rpgHand(p: Pick<RpgProfile, 'classId' | 'weapons'>): RpgHand {
  if (p.classId === 'brawler') return { actions: 1, power: 1, mp: 1, free: { power: 1, kind: 'weapon' } }
  if (p.classId === 'cleric') return { actions: 1, power: 0.5, mp: 0.7, free: { power: 0.5, kind: 'staff' } }
  if (p.classId === 'summoner') return { actions: 2, power: 0.5, mp: 0.5, free: { power: 0.5, kind: 'familiar' } }
  return p.weapons.includes('short-sword')
    ? { actions: 1, power: 0.75, mp: 0.75, free: { power: 0.9, kind: 'short-sword' } }
    : { actions: 2, power: 0.6, mp: 0.6, free: { power: 0.4, kind: 'staff' } }
}

// --- Enrollment --------------------------------------------------------------------------------------------------------

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

export function enrollRpgOutfit(input: {
  outfit: Pick<UmaTemplate, 'id' | 'baseStats' | 'growthRates' | 'aptitudes'>
  contentVersion: string
  classId: RpgClass
  weapons: readonly RpgWeapon[]
}): RpgProfile {
  const { outfit, classId, weapons, contentVersion } = input
  if (!outfit || typeof outfit.id !== 'string' || !outfit.id.trim() || outfit.id.length > 128) {
    throw new RangeError('Invalid outfit id')
  }
  if (typeof contentVersion !== 'string' || !contentVersion.trim() || contentVersion.length > 128) {
    throw new RangeError('Invalid content version')
  }
  const baseStats = frozenStats(outfit.baseStats, 'base stats')
  const growthRates = frozenStats(outfit.growthRates, 'growth rates', true)
  const sourceAptitudes = frozenAptitudes(outfit.aptitudes)
  const options = rpgClassOptions(sourceAptitudes)
  if (!options.length) throw new RangeError('Outfit has no A running style')
  if (!options.includes(classId)) throw new RangeError('Class is not open to this outfit')
  if (!validRpgWeapons(classId, weapons)) throw new RangeError('Weapons are not a set of this class')
  return {
    outfitId: outfit.id, sourceContentVersion: contentVersion, baseStats, growthRates, sourceAptitudes,
    classId, weapons: [...weapons], tier: 1, level: 1, exp: 0, tree: [], legacy: [],
  }
}

/** D277: class and weapons can change freely while nothing is learned, at any level. */
export function canChangeRpgClass(profile: RpgProfile): boolean {
  return profile.tree.length === 0 && profile.legacy.length === 0
}

export function changeRpgClass(profile: RpgProfile, classId: RpgClass, weapons: readonly RpgWeapon[]): RpgProfile {
  if (!canChangeRpgClass(profile)) throw new RangeError('Class edits require an empty skill tree')
  if (!rpgClassOptions(profile.sourceAptitudes).includes(classId)) throw new RangeError('Class is not open to this outfit')
  if (!validRpgWeapons(classId, weapons)) throw new RangeError('Weapons are not a set of this class')
  if (classId === profile.classId && sameRpgWeapons(weapons, profile.weapons)) throw new RangeError('Choose a different class or weapons')
  return { ...profile, classId, weapons: [...weapons] }
}

// --- Levels and stats --------------------------------------------------------------------------------------------------

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

export function projectRpgStats(profile: Pick<RpgProfile, 'baseStats' | 'growthRates' | 'tier' | 'level' | 'classId'>): RpgCoreStats {
  const lifetime = rpgLifetimeLevels(profile.tier, profile.level)
  const base = frozenStats(profile.baseStats, 'base stats')
  const growth = frozenStats(profile.growthRates, 'growth rates', true)
  const lean = RPG_CLASS_STATS[profile.classId]
  if (!lean) throw new RangeError('Invalid RPG class')
  const core = {} as Stats
  for (const key of STATS) {
    const projected = Math.round(base[key] / 5 + lifetime * 1.5 * (1 + growth[key]))
    requireSafe(projected, `projected ${key}`)
    core[key] = projected
  }
  // Campaign MP (D261): a pool worth a few skills that carries between fights; Wit buys more casts.
  const hp = Math.round((100 + 6 * core.stamina + 2 * core.power) * lean.hp)
  const mp = Math.round((20 + 1.5 * core.wit) * lean.mp)
  requireSafe(hp, 'projected HP')
  requireSafe(mp, 'projected MP')
  return { ...core, atk: Math.round(core.speed * lean.atk), matk: Math.round(core.speed * lean.matk), initiative: core.stamina,
    pdef: Math.round(core.power * lean.pdef), mdef: Math.round((core.power + core.wit) / 2 * lean.mdef),
    dexterity: core.guts, hp, mp }
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

// --- Trees ------------------------------------------------------------------------------------------------------------

export function rpgTreePointsEarned(level: number): number {
  rpgLifetimeLevels(1, level)
  return Math.min(level, RPG_TREE_POINT_MAX_LEVEL) * RPG_TREE_POINTS_PER_LEVEL +
    RPG_DEPTH_GATES.filter((gate) => level >= gate).length * RPG_TREE_POINTS_PER_DEPTH
}

export function rpgActiveSlots(level: number): number {
  rpgLifetimeLevels(1, level)
  return RPG_BASE_ACTIVE_SLOTS + RPG_ACTIVE_SLOT_GATES.filter((gate) => level >= gate).length
}

/** Nodes cost their depth; unknown nodes count as out of budget. */
export function rpgTreePointsSpent(tree: readonly RpgNodeRef[]): number {
  return tree.reduce((sum, ref) => sum + (rpgNode(ref.id)?.cost ?? Number.MAX_SAFE_INTEGER / 64), 0)
}

export const rpgNodeKey = (ref: RpgNodeRef): string => `${ref.tier}:${ref.id}`

/** Why this node can't be learned now, or null. The same rules validate a stored tree. */
export function rpgLearnBlock(profile: Pick<RpgProfile, 'classId' | 'weapons' | 'tier' | 'level' | 'tree'>, id: string): string | null {
  const node = rpgNode(id)
  if (!node || !rpgProfileTrees(profile).includes(node.tree)) return 'Not in her class trees'
  if (profile.tree.some((ref) => ref.id === id)) return 'Already learned'
  if (profile.level < RPG_DEPTH_GATES[node.depth - 1]!) return `Opens at Lv${RPG_DEPTH_GATES[node.depth - 1]}`
  if (rpgTreePointsSpent(profile.tree) + node.cost > rpgTreePointsEarned(profile.level)) return 'Not enough points'
  return rpgShapeBlock(profile.tree.map((ref) => rpgNode(ref.id)!).filter(Boolean), node)
}

/** Structure only: the core node above, the fork's other side and the variant cap. */
function rpgShapeBlock(learned: readonly RpgNode[], node: RpgNode): string | null {
  const has = (branchDepth: number, variant: 'a' | 'b' | null) =>
    learned.some((n) => n.tree === node.tree && n.branch === node.branch && n.depth === branchDepth && n.variant === variant)
  if (node.variant === null) return node.depth > 1 && !has(node.depth - 1, null) ? 'Needs the core skill above' : null
  if (!has(node.depth, null)) return 'Needs its core skill first'
  if (has(node.depth, node.variant === 'a' ? 'b' : 'a')) return 'The other side of this fork is learned'
  if (learned.filter((n) => n.tree === node.tree && n.variant !== null).length >= RPG_VARIANTS_PER_TREE) return `${RPG_VARIANTS_PER_TREE} variants per tree`
  return null
}

export function learnRpgNode(profile: RpgProfile, id: string): RpgProfile {
  const block = rpgLearnBlock(profile, id)
  if (block) throw new RangeError(block)
  return { ...profile, tree: [...profile.tree, { tier: profile.tier, id }] }
}

/** D280: variants swap freely; the points come back. Core nodes are permanent. */
export function forgetRpgVariant(profile: RpgProfile, id: string): RpgProfile {
  const node = rpgNode(id)
  if (!node || node.variant === null || !profile.tree.some((ref) => ref.id === id)) throw new RangeError('Only a learned variant can be swapped out')
  return { ...profile, tree: profile.tree.filter((ref) => ref.id !== id) }
}

/** A stored tree obeys every learning rule at its level, whatever order it was learned in. */
export function validRpgTree(profile: Pick<RpgProfile, 'classId' | 'weapons' | 'tier' | 'level' | 'tree'>): boolean {
  const trees = rpgProfileTrees(profile)
  const nodes: RpgNode[] = []
  for (const ref of profile.tree) {
    const node = rpgNode(ref.id)
    if (!node || ref.tier !== profile.tier || !trees.includes(node.tree) || profile.level < RPG_DEPTH_GATES[node.depth - 1]!) return false
    nodes.push(node)
  }
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length || rpgTreePointsSpent(profile.tree) > rpgTreePointsEarned(profile.level)) return false
  return nodes.every((node) => rpgShapeBlock(nodes.filter((n) => n !== node), node) === null)
}

/** Active skills she may equip: this tier's learned skills and her legacy ones. */
export function rpgLearnedSkills(profile: Pick<RpgProfile, 'tree' | 'legacy'>): RpgNodeRef[] {
  return [...profile.tree, ...profile.legacy].filter((ref) => rpgNode(ref.id)?.skill)
}

export function validateRpgLoadout(profile: RpgProfile, refs: readonly RpgNodeRef[]): boolean {
  if (refs.length > rpgActiveSlots(profile.level)) return false
  const learned = new Set(rpgLearnedSkills(profile).map(rpgNodeKey))
  const keys = refs.map(rpgNodeKey)
  return new Set(keys).size === keys.length && keys.every((key) => learned.has(key)) &&
    refs.filter((ref) => ref.tier < profile.tier).length <= RPG_MAX_LEGACY_SLOTS
}

export function promoteRpgOutfit(
  profile: RpgProfile, selectedLegacy: readonly RpgNodeRef[], discardUnspentPoints = false,
): { profile: RpgProfile; archivedTier: { tier: number; tree: RpgNodeRef[] }; levelsCrossed: number[] } {
  if (profile.level !== RPG_TIER_MAX_LEVEL) throw new RangeError('Promotion requires Lv50')
  if (!discardUnspentPoints && rpgTreePointsSpent(profile.tree) < rpgTreePointsEarned(profile.level)) {
    throw new RangeError('Unspent tree points require an explicit discard choice')
  }
  requireSafe(profile.tier + 1, 'next RPG tier', 1)
  if (selectedLegacy.length > RPG_MAX_LEGACY_SLOTS) throw new RangeError('Too many legacy skills')
  const available = rpgLearnedSkills(profile)
  const keys = selectedLegacy.map(rpgNodeKey)
  if (new Set(keys).size !== keys.length || keys.some((key) => !available.some((ref) => rpgNodeKey(ref) === key))) {
    throw new RangeError('Legacy selection was not learned')
  }
  const legacy = keys.map((key) => ({ ...available.find((ref) => rpgNodeKey(ref) === key)! }))
  const archivedTier = { tier: profile.tier, tree: profile.tree.map((ref) => ({ ...ref })) }
  const promoted = { ...profile, tier: profile.tier + 1, level: 1, exp: profile.exp, tree: [] as RpgNodeRef[], legacy }
  // The Lv50 bank is applied only after the explicit tier transition.
  const settled = grantRpgExp({ ...promoted, exp: 0 }, promoted.exp)
  return { ...settled, archivedTier }
}
