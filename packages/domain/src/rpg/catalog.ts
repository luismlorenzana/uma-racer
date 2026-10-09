// Every class tree, node and number (docs/design/uma-rpg-classes.md, D280). One set of rules builds every skill, so a
// rebalance changes a rule here, not a table of cells. Powers are full-turn units (Attack = 1.0) before the hand factor.
import { rpgElementBeats, type RpgDamageKind, type RpgElement, type RpgStatusKind, type RpgTreeId, type RpgWeaponKind } from './kinds'

/** Single-target total power by depth, and the full-turn MP by depth (6 + 4 × depth). */
export const RPG_SKILL_POWER = [1.6, 2.2, 2.9, 3.7, 4.6] as const
export const RPG_SKILL_MP = [10, 14, 18, 22, 26] as const
/** Every-foe skills deal this share of single-target power to each foe; random multi-hits get a small bonus. */
export const RPG_AOE_SHARE = 0.55
export const RPG_RANDOM_BONUS = 1.05
export const RPG_VARIANT_DEPTHS = [2, 3, 4] as const
export const RPG_VARIANTS_PER_TREE = 3

export interface RpgPart { kind: RpgDamageKind; share: number }
export interface RpgHit { power: number; parts: RpgPart[] }
export type RpgSkillTarget = 'one' | 'all' | 'random'
export interface RpgSkillDef {
  target: RpgSkillTarget
  /** `all`: every foe takes each hit. `one`: every hit on the tapped foe. `random`: each hit on a random living foe. */
  hits: RpgHit[]
  /** Extra hits on the tapped foe (Executioner). */
  focus?: RpgHit[]
  /** After the last hit, one hit on every other living foe (Burst). */
  splash?: RpgHit
  /** After the hits, one hit on every living foe (Armageddon). */
  sweep?: RpgHit
  /** Full-turn MP at Tier 1, before the hand factor. */
  mp: number
  /** The kind the skill is known by: its element, Ultima, or a summon's weapon. Picks the Cleric's blessing branch. */
  primary: RpgDamageKind
  rider?: { status: RpgStatusKind; stacks: number; per: 'foe' | 'hit' | 'element-hit' }
  /** Every living ally gains this (Heaven's Legion). */
  allies?: { status: 'barrier'; stacks: number }
  special?: 'pierce' | 'vs-broken' | 'vs-wounded'
}
export interface RpgNode {
  id: string
  tree: RpgTreeId
  branch: string
  depth: number
  variant: 'a' | 'b' | null
  name: string
  /** Points to learn: the node's depth. */
  cost: number
  /** Active nodes are skills that take a slot; passive nodes shape Short Sword follow-ups or Cleric blessings. */
  skill: RpgSkillDef | null
  passive: string | null
  /** One line for the tree screen. */
  summary: string
}

const power = (d: number) => RPG_SKILL_POWER[d - 1]!
const mp = (d: number) => RPG_SKILL_MP[d - 1]!
const at = <T>(list: readonly T[], d: number) => list[d - 1]!
const round = (n: number) => Math.round(n * 1000) / 1000

/** Two-part hits: 75% weapon + 25% element in the same hit. */
function dual(n: number, total: number, weapon: RpgWeaponKind, element: RpgDamageKind): RpgHit[] {
  return Array.from({ length: n }, () => ({ power: round(total / n), parts: [{ kind: weapon, share: 0.75 }, { kind: element, share: 0.25 }] }))
}
/** Hits alternate weapon then element; weapon hits carry 75% of the total. One hit is two-part. */
function alternate(n: number, total: number, weapon: RpgWeaponKind, element: RpgDamageKind): RpgHit[] {
  if (n === 1) return dual(1, total, weapon, element)
  const w = Math.ceil(n / 2), e = Math.floor(n / 2)
  return Array.from({ length: n }, (_, i) => i % 2 === 0
    ? { power: round(0.75 * total / w), parts: [{ kind: weapon, share: 1 }] }
    : { power: round(0.25 * total / e), parts: [{ kind: element, share: 1 }] })
}
function pure(n: number, total: number, kinds: RpgDamageKind | readonly RpgDamageKind[]): RpgHit[] {
  const list = typeof kinds === 'string' ? [kinds] : kinds
  return Array.from({ length: n }, (_, i) => ({ power: round(total / n), parts: [{ kind: list[i % list.length]!, share: 1 }] }))
}
/** Fused summon hits: half one kind, half another (the second may cycle). */
function fused(n: number, total: number, first: RpgDamageKind, second: readonly RpgDamageKind[]): RpgHit[] {
  return Array.from({ length: n }, (_, i) => ({ power: round(total / n), parts: [{ kind: first, share: 0.5 }, { kind: second[i % second.length]!, share: 0.5 }] }))
}
const RIDER: Readonly<Record<'fire' | 'ice' | 'lightning', RpgStatusKind>> = { fire: 'burn', ice: 'enfeeble', lightning: 'shock' }

type Shape = (d: number) => RpgSkillDef
interface BranchSpec { branch: string; names: readonly string[]; a: readonly string[]; b: readonly string[] }
interface ActiveTree {
  tree: RpgTreeId
  branches: readonly BranchSpec[]
  core: (branch: string, d: number) => RpgSkillDef
  a: (branch: string, d: number) => RpgSkillDef
  b: (branch: string, d: number) => RpgSkillDef
  summary: (skill: RpgSkillDef) => string
}

const NODES: RpgNode[] = []
function describe(skill: RpgSkillDef): string {
  const per = skill.target === 'all' ? 'every foe' : skill.target === 'random' ? 'random foes' : 'one foe'
  const n = skill.hits.length
  const total = skill.hits.reduce((s, h) => s + h.power, 0)
  return `${per} · ${n} hit${n === 1 ? '' : 's'} · ${round(total)}`
}
function addActive(spec: ActiveTree): void {
  for (const b of spec.branches) {
    for (let d = 1; d <= 5; d += 1) {
      const skill = spec.core(b.branch, d)
      NODES.push({ id: `${spec.tree}.${b.branch}.${d}`, tree: spec.tree, branch: b.branch, depth: d, variant: null,
        name: at(b.names, d), cost: d, skill, passive: null, summary: spec.summary(skill) })
      if (!(RPG_VARIANT_DEPTHS as readonly number[]).includes(d)) continue
      for (const side of ['a', 'b'] as const) {
        const variant = (side === 'a' ? spec.a : spec.b)(b.branch, d)
        NODES.push({ id: `${spec.tree}.${b.branch}.${d}${side}`, tree: spec.tree, branch: b.branch, depth: d, variant: side,
          name: (side === 'a' ? b.a : b.b)[d - 2]!, cost: d, skill: variant, passive: null, summary: spec.summary(variant) })
      }
    }
  }
}
function addPassive(tree: RpgTreeId, branches: readonly { branch: string; core: readonly [string, string, string][]; forks: readonly [string, string, string, string][] }[]): void {
  // core: [name, passive key, summary]; forks per depth 2..4: [A name, A key, B name, B key] with summaries in PASSIVE_TEXT.
  for (const b of branches) {
    b.core.forEach(([name, key, summary], i) => {
      const d = i + 1
      NODES.push({ id: `${tree}.${b.branch}.${d}`, tree, branch: b.branch, depth: d, variant: null, name, cost: d, skill: null, passive: key, summary })
      if (d < 2 || d > 4) return
      const [an, ak, bn, bk] = b.forks[d - 2]!
      NODES.push({ id: `${tree}.${b.branch}.${d}a`, tree, branch: b.branch, depth: d, variant: 'a', name: an, cost: d, skill: null, passive: ak, summary: PASSIVE_TEXT[ak]! })
      NODES.push({ id: `${tree}.${b.branch}.${d}b`, tree, branch: b.branch, depth: d, variant: 'b', name: bn, cost: d, skill: null, passive: bk, summary: PASSIVE_TEXT[bk]! })
    })
  }
}

// --- Brawler -----------------------------------------------------------------------------------------------------------
type Elemental = 'fire' | 'ice' | 'lightning'
const GH = [1, 1, 2, 2, 3], SH = [2, 2, 4, 4, 6]
const el = (branch: string) => branch as Elemental

addActive({ tree: 'greatsword', summary: describe, branches: [
  { branch: 'fire', names: ['Flame Slash', 'Blazing Cleave', 'Inferno Edge', 'Volcanic Rend', 'Meteor Strike'],
    a: ['Searing Crush', 'Magma Breaker', 'Cataclysm'], b: ['Twin Embers', 'Ember Flurry', 'Wildfire Combo'] },
  { branch: 'ice', names: ['Frost Slash', 'Rime Cleave', 'Glacier Edge', 'Frozen Rend', 'Glacial Execution'],
    a: ['Avalanche Crush', 'Permafrost Breaker', 'Iceberg Splitter'], b: ['Twin Icicles', 'Hailstorm Flurry', 'Blizzard Combo'] },
  { branch: 'lightning', names: ['Volt Slash', 'Thunder Cleave', 'Tempest Edge', 'Lightning Rend', "Heaven's Fury"],
    a: ['Storm Crush', 'Thunderclap Breaker', 'Judgment Blade'], b: ['Twin Sparks', 'Static Flurry', 'Chain Combo'] },
],
core: (b, d) => ({ target: 'one', hits: dual(at(GH, d), power(d), 'greatsword', el(b)), mp: mp(d), primary: el(b),
  ...(d === 5 ? { rider: { status: RIDER[el(b)], stacks: 2, per: 'foe' as const } } : {}) }),
a: (b, d) => ({ target: 'one', hits: dual(1, 1.15 * power(d), 'greatsword', el(b)), mp: mp(d) + 2, primary: el(b) }),
b: (b, d) => ({ target: 'one', hits: dual(at(GH, d) + 1, 0.92 * power(d), 'greatsword', el(b)), mp: mp(d), primary: el(b) }),
})

addActive({ tree: 'spear', summary: describe, branches: [
  { branch: 'fire', names: ['Ember Thrust', 'Flame Lance', 'Burning Barrage', 'Inferno Spiral', "Dragon's Rain"],
    a: ['Searing Pierce', 'Magma Pierce', 'Inferno Pierce'], b: ['Steam Lance', 'Steam Barrage', 'Steam Spiral'] },
  { branch: 'ice', names: ['Frost Thrust', 'Ice Lance', 'Shard Barrage', 'Blizzard Spiral', 'Glacier Rain'],
    a: ['Glacial Pierce', 'Permafrost Pierce', 'Absolute Pierce'], b: ['Frostvolt Lance', 'Frostvolt Barrage', 'Frostvolt Spiral'] },
  { branch: 'lightning', names: ['Spark Thrust', 'Volt Lance', 'Static Barrage', 'Thunder Spiral', 'Storm Rain'],
    a: ['Thunder Pierce', 'Storm Pierce', 'Heaven Pierce'], b: ['Plasma Lance', 'Plasma Barrage', 'Plasma Spiral'] },
],
core: (b, d) => ({ target: 'random', hits: alternate(at(SH, d), RPG_RANDOM_BONUS * power(d), 'spear', el(b)), mp: mp(d), primary: el(b),
  ...(d === 5 ? { rider: { status: RIDER[el(b)], stacks: 1, per: 'element-hit' as const } } : {}) }),
a: (b, d) => ({ target: 'one', hits: dual(at(SH, d) / 2, 1.15 * power(d), 'spear', el(b)), mp: mp(d) + 2, primary: el(b) }),
b: (b, d) => ({ target: 'random', hits: [...alternate(at(SH, d), RPG_RANDOM_BONUS * power(d), 'spear', el(b)),
  ...pure(2, 0.3 * power(d), rpgElementBeats(el(b)))], mp: mp(d) + 4, primary: el(b) }),
})

addActive({ tree: 'axe', summary: describe, branches: [
  { branch: 'fire', names: ['Flame Sweep', 'Blazing Whirl', 'Inferno Cyclone', 'Volcanic Quake', 'Firestorm'],
    a: ['Ember Rampage', 'Blaze Rampage', 'Inferno Rampage'], b: ['Pyre Execution', 'Searing Execution', 'Cinder Execution'] },
  { branch: 'ice', names: ['Frost Sweep', 'Rime Whirl', 'Glacier Cyclone', 'Avalanche Quake', 'Absolute Maelstrom'],
    a: ['Hail Rampage', 'Sleet Rampage', 'Blizzard Rampage'], b: ['Frostbite Execution', 'Rime Execution', 'Glacier Execution'] },
  { branch: 'lightning', names: ['Volt Sweep', 'Thunder Whirl', 'Tempest Cyclone', 'Thunderclap Quake', 'Thunderstorm'],
    a: ['Spark Rampage', 'Static Rampage', 'Tempest Rampage'], b: ['Storm Execution', 'Thunder Execution', 'Judgment Execution'] },
],
core: (b, d) => ({ target: 'all', hits: dual(at(GH, d), RPG_AOE_SHARE * power(d), 'axe', el(b)), mp: mp(d) + 4, primary: el(b),
  ...(d === 5 ? { rider: { status: RIDER[el(b)], stacks: 1, per: 'foe' as const } } : {}) }),
a: (b, d) => ({ target: 'all', hits: dual(at(GH, d) + 1, 0.5 * power(d), 'axe', el(b)), mp: mp(d) + 6, primary: el(b) }),
b: (b, d) => ({ target: 'all', hits: dual(at(GH, d), 0.45 * power(d), 'axe', el(b)), focus: dual(1, 0.5 * power(d), 'axe', el(b)),
  mp: mp(d) + 6, primary: el(b) }),
})

addActive({ tree: 'bow', summary: describe, branches: [
  { branch: 'fire', names: ['Fire Arrow', 'Twin Flame Arrows', 'Blazing Quiver', 'Inferno Volley', 'Sunfall Barrage'],
    a: ['Searing Shot', 'Magma Shot', 'Sun Lance Shot'], b: ['Exploding Arrow', 'Cluster Fire', 'Napalm Volley'] },
  { branch: 'ice', names: ['Ice Arrow', 'Twin Frost Arrows', 'Frozen Quiver', 'Blizzard Volley', 'Diamond Dust Barrage'],
    a: ['Icicle Shot', 'Glacial Shot', 'Comet Shot'], b: ['Shatter Arrow', 'Frost Cluster', 'Hail Volley'] },
  { branch: 'lightning', names: ['Spark Arrow', 'Twin Volt Arrows', 'Static Quiver', 'Thunder Volley', 'Thunderhead Barrage'],
    a: ['Rail Shot', 'Volt Shot', 'Thunderbolt Shot'], b: ['Arc Arrow', 'Chain Cluster', 'Storm Volley'] },
],
core: (b, d) => ({ target: 'one', hits: alternate(at(SH, d), power(d), 'bow', el(b)), mp: mp(d), primary: el(b),
  ...(d === 5 ? { rider: { status: RIDER[el(b)], stacks: 1, per: 'element-hit' as const } } : {}) }),
a: (b, d) => ({ target: 'one', hits: dual(at(SH, d) / 2, 1.15 * power(d), 'bow', el(b)), mp: mp(d) + 2, primary: el(b) }),
b: (b, d) => ({ target: 'one', hits: alternate(at(SH, d), power(d), 'bow', el(b)), splash: pure(1, 0.2 * power(d), el(b))[0],
  mp: mp(d) + 4, primary: el(b) }),
})

// --- Mage and Cleric staves --------------------------------------------------------------------------------------------
const LH = [2, 2, 3, 3, 4]
const single = (kind: RpgDamageKind, d: number): RpgSkillDef => ({ target: 'one', hits: pure(1, power(d), kind), mp: mp(d), primary: kind })
const wave = (kind: RpgDamageKind, d: number): RpgSkillDef => ({ target: 'all', hits: pure(1, RPG_AOE_SHARE * power(d), kind), mp: mp(d) + 4, primary: kind })
const chain = (kind: RpgDamageKind, d: number): RpgSkillDef => ({ target: 'random', hits: pure(at(LH, d), RPG_RANDOM_BONUS * power(d), kind), mp: mp(d), primary: kind })
const SHAPES: Readonly<Record<string, readonly [Shape, Shape, Shape]>> = {
  fire: [(d) => single('fire', d), (d) => wave('fire', d), (d) => chain('fire', d)],
  ice: [(d) => wave('ice', d), (d) => single('ice', d), (d) => chain('ice', d)],
  lightning: [(d) => chain('lightning', d), (d) => single('lightning', d), (d) => wave('lightning', d)],
}
addActive({ tree: 'mage-staff', summary: describe, branches: [
  { branch: 'fire', names: ['Fire', 'Fira', 'Firaga', 'Firaja', 'Flare Star'], a: ['Fira Wave', 'Firaga Wave', 'Firaja Wave'], b: ['Fira Chain', 'Firaga Chain', 'Firaja Chain'] },
  { branch: 'ice', names: ['Blizzard', 'Blizzara', 'Blizzaga', 'Blizzaja', 'Absolute Zero'], a: ['Blizzara Spike', 'Blizzaga Spike', 'Blizzaja Spike'], b: ['Blizzara Shards', 'Blizzaga Shards', 'Blizzaja Shards'] },
  { branch: 'lightning', names: ['Thunder', 'Thundara', 'Thundaga', 'Thundaja', 'Judgment Storm'], a: ['Thundara Bolt', 'Thundaga Bolt', 'Thundaja Bolt'], b: ['Thundara Storm', 'Thundaga Storm', 'Thundaja Storm'] },
],
core: (b, d) => {
  if (d < 5) return SHAPES[b]![0](d)
  if (b === 'fire') return { ...single('fire', 5), rider: { status: 'burn', stacks: 2, per: 'foe' } }
  if (b === 'ice') return { target: 'all', hits: pure(2, RPG_AOE_SHARE * power(5), 'ice'), mp: mp(5) + 4, primary: 'ice', rider: { status: 'enfeeble', stacks: 1, per: 'foe' } }
  return { ...chain('lightning', 5), rider: { status: 'shock', stacks: 1, per: 'hit' } }
},
a: (b, d) => SHAPES[b]![1](d),
b: (b, d) => SHAPES[b]![2](d),
})

const UH = [2, 2, 3, 3, 4]
const ultima = (d: number, coda?: 'light' | 'dark'): RpgSkillDef => ({ target: 'random',
  hits: [...pure(at(UH, d), RPG_RANDOM_BONUS * power(d), 'ultima'), ...(coda ? pure(1, 0.25 * power(d), coda) : [])],
  mp: mp(d) + (coda ? 4 : 2), primary: 'ultima' })
addActive({ tree: 'arcane-staff', summary: describe, branches: [
  { branch: 'light', names: ['Lux', 'Luxra', 'Luxaga', 'Luxaja', 'Holy'], a: ['Luxra Lance', 'Luxaga Lance', 'Luxaja Lance'], b: ['Luxra Cascade', 'Luxaga Cascade', 'Luxaja Cascade'] },
  { branch: 'dark', names: ['Nox', 'Noxra', 'Noxaga', 'Noxaja', 'Black Hole'], a: ['Noxra Lance', 'Noxaga Lance', 'Noxaja Lance'], b: ['Noxra Cascade', 'Noxaga Cascade', 'Noxaja Cascade'] },
  { branch: 'ultima', names: ['Arcana', 'Arcanara', 'Arcanaga', 'Arcanaja', 'Ultima'], a: ['Arcanara Dawn', 'Arcanaga Dawn', 'Arcanaja Dawn'], b: ['Arcanara Dusk', 'Arcanaga Dusk', 'Arcanaja Dusk'] },
],
core: (b, d) => {
  if (b === 'ultima') return d < 5 ? ultima(d) : { ...ultima(5), special: 'pierce' }
  if (d < 5) return wave(b as RpgElement, d)
  return { target: 'all', hits: pure(2, RPG_AOE_SHARE * power(5), b as RpgElement), mp: mp(5) + 4, primary: b as RpgElement,
    special: b === 'light' ? 'vs-broken' : 'vs-wounded' }
},
a: (b, d) => b === 'ultima' ? ultima(d, 'light') : single(b as RpgElement, d),
b: (b, d) => b === 'ultima' ? ultima(d, 'dark')
  : { target: 'all', hits: pure(2, 0.5 * power(d), b as RpgElement), mp: mp(d) + 6, primary: b as RpgElement },
})

// --- Summoner ----------------------------------------------------------------------------------------------------------
const EH = [1, 2, 2, 3, 3]
const LEGION: readonly RpgWeaponKind[] = ['greatsword', 'spear', 'axe', 'bow', 'short-sword']
const CONVERT: readonly (readonly [RpgWeaponKind | 'legion', RpgWeaponKind | 'legion'])[] = [['greatsword', 'spear'], ['axe', 'bow'], ['short-sword', 'legion']]
const summonWave = (kind: RpgWeaponKind | Elemental | 'legion', d: number): RpgSkillDef => ({ target: 'all',
  hits: pure(at(EH, d), RPG_AOE_SHARE * power(d), kind === 'legion' ? LEGION : kind), mp: mp(d) + 4, primary: kind === 'legion' ? 'greatsword' : kind })
addActive({ tree: 'summon-elemental', summary: describe, branches: [
  { branch: 'fire', names: ['Ember Sprites', 'Salamander', 'Fire Drake', 'Infernal Wyrm', 'Phoenix'],
    a: ['Skeleton Swordsmen', 'Skeleton Berserkers', 'Skeleton Duelists'], b: ['Skeleton Lancers', 'Skeleton Archers', 'Bone Legion'] },
  { branch: 'ice', names: ['Frost Sprites', 'Snow Wolves', 'Ice Golem', 'Frost Titan', 'Winter Queen'],
    a: ['Frost Knights', 'Glacier Reavers', 'Frost Duelists'], b: ['Ice Pikemen', 'Snow Rangers', 'Frozen Legion'] },
  { branch: 'lightning', names: ['Spark Sprites', 'Thunderbird', 'Storm Roc', 'Thunder Kirin', 'Raijin'],
    a: ['Brass Knights', 'Steam Reavers', 'Spring Duelists'], b: ['Gear Lancers', 'Bolt Rangers', 'Clockwork Legion'] },
],
core: (b, d) => d < 5 ? summonWave(el(b), d)
  : { target: 'all', hits: pure(3, RPG_AOE_SHARE * power(5), el(b)), mp: mp(5) + 4, primary: el(b), rider: { status: RIDER[el(b)], stacks: 1, per: 'foe' } },
a: (_b, d) => summonWave(CONVERT[d - 2]![0], d),
b: (_b, d) => summonWave(CONVERT[d - 2]![1], d),
})

const P2 = [1, 1, 1, 2, 2], AR = [2, 2, 3, 3, 4]
addActive({ tree: 'summon-arcane', summary: describe, branches: [
  { branch: 'angels', names: ['Cherub', 'Angel Lancer', 'Seraph Phalanx', 'Dominion Host', "Heaven's Legion"],
    a: ['Angel Archer', 'Seraph Archers', 'Dominion Volley'], b: ['Valkyrie', 'Valkyrie Blade', 'Valkyrie Charge'] },
  { branch: 'demons', names: ['Imp Brute', 'Hellknight', 'Dread Knight', 'Demon Lord', 'Abyssal Overlord'],
    a: ['Hell Reaver', 'Dread Reaver', 'Abyss Reaver'], b: ['Nightmare', 'Night Terror', 'Dream Eater'] },
  { branch: 'archons', names: ['Herald', 'Archangel', "Archangel's Rain", "Archangel's Judgment", 'Armageddon'],
    a: ['Archdemon', "Archdemon's Ruin", "Archdemon's Cataclysm"], b: ['Twilight Herald', 'Twilight Archon', 'Eclipse Archon'] },
],
core: (b, d) => {
  if (b === 'angels') return { target: 'random', hits: fused(at(P2, d), RPG_RANDOM_BONUS * power(d), 'light', ['spear']), mp: mp(d), primary: 'light',
    ...(d === 5 ? { allies: { status: 'barrier' as const, stacks: 1 } } : {}) }
  if (b === 'demons') return { target: 'one', hits: fused(at(P2, d), power(d), 'dark', ['greatsword']), mp: mp(d), primary: 'dark',
    ...(d === 5 ? { rider: { status: 'enfeeble' as const, stacks: 2, per: 'foe' as const } } : {}) }
  return { target: 'random', hits: fused(at(AR, d), RPG_RANDOM_BONUS * power(d), 'ultima', ['spear', 'bow']), mp: mp(d) + (d === 5 ? 6 : 2), primary: 'ultima',
    ...(d === 5 ? { sweep: fused(1, 0.25 * power(5), 'ultima', ['axe'])[0] } : {}) }
},
a: (b, d) => b === 'angels' ? { target: 'one', hits: fused(at(P2, d), power(d), 'light', ['bow']), mp: mp(d), primary: 'light' }
  : b === 'demons' ? { target: 'all', hits: fused(at(P2, d), RPG_AOE_SHARE * power(d), 'dark', ['axe']), mp: mp(d) + 4, primary: 'dark' }
  : { target: 'all', hits: fused(Math.max(1, at(AR, d) - 1), RPG_AOE_SHARE * power(d), 'ultima', ['greatsword', 'axe']), mp: mp(d) + 6, primary: 'ultima' },
b: (b, d) => b === 'angels' ? { target: 'one', hits: fused(1, 1.15 * power(d), 'light', ['short-sword']), mp: mp(d) + 2, primary: 'light' }
  : b === 'demons' ? { target: 'one', hits: fused(at(P2, d), 0.9 * power(d), 'dark', ['greatsword']), mp: mp(d), primary: 'dark',
    rider: { status: 'mind-break', stacks: 1, per: 'hit' } }
  : { target: 'random', hits: fused(at(AR, d), RPG_RANDOM_BONUS * power(d), 'ultima', ['light', 'dark']), mp: mp(d) + 2, primary: 'ultima' },
})

// --- Spell Blade (D310) -------------------------------------------------------------------------------------------------
// Half magic, half blade, acting twice a turn at half strength (the hand), so every number reads like a Brawler's.
/** Blade hits: half Short Sword, half the element, in the same hit. */
function blade(n: number, total: number, kind: RpgDamageKind): RpgHit[] {
  return Array.from({ length: n }, () => ({ power: round(total / n), parts: [{ kind: 'short-sword', share: 0.5 }, { kind, share: 0.5 }] }))
}
/** An arcane hit then a Short Sword hit, repeated; each half carries half the total. */
function weave(n: number, total: number, kind: RpgDamageKind): RpgHit[] {
  const pairs = n / 2
  return Array.from({ length: n }, (_, i) => ({ power: round(0.5 * total / pairs), parts: [{ kind: i % 2 === 0 ? kind : 'short-sword', share: 1 }] }))
}
/** Variants keep the core and add two hits worth 0.3 of the depth's power at the end, for 4 MP more. */
const CODA = 0.3
addActive({ tree: 'blade-elemental', summary: describe, branches: [
  { branch: 'fire', names: ['Fire Blade', 'Flame Brand', 'Blazing Saber', 'Inferno Saber', 'Phoenix Blade'],
    a: ['Searing Strike', 'Magma Strike', 'Solar Strike'], b: ['Twin Flames', 'Flame Dance', 'Wildfire Dance'] },
  { branch: 'ice', names: ['Frost Blade', 'Ice Brand', 'Rime Saber', 'Glacial Saber', 'Diamond Blade'],
    a: ['Shatter Strike', 'Permafrost Strike', 'Avalanche Strike'], b: ['Twin Frost', 'Frost Dance', 'Blizzard Dance'] },
  { branch: 'lightning', names: ['Thunder Blade', 'Volt Brand', 'Storm Saber', 'Tempest Saber', 'Thunderlord Blade'],
    a: ['Bolt Strike', 'Thunderclap Strike', 'Judgment Strike'], b: ['Twin Volts', 'Spark Dance', 'Storm Dance'] },
],
core: (b, d) => ({ target: 'one', hits: blade(at(GH, d), power(d), el(b)), mp: mp(d), primary: el(b),
  ...(d === 5 ? { rider: { status: RIDER[el(b)], stacks: 2, per: 'foe' as const } } : {}) }),
a: (b, d) => ({ target: 'one', hits: blade(1, 1.15 * power(d), el(b)), mp: mp(d) + 2, primary: el(b) }),
b: (b, d) => ({ target: 'one', hits: blade(at(GH, d) + 1, 0.92 * power(d), el(b)), mp: mp(d), primary: el(b) }),
})
const arcaneBlade = (b: string, d: number): RpgSkillDef => {
  const kind = b as 'light' | 'dark' | 'ultima', random = kind === 'ultima'
  return { target: random ? 'random' : 'one', hits: weave(at(SH, d), (random ? RPG_RANDOM_BONUS : 1) * power(d), kind),
    mp: mp(d) + (random ? 2 : 0), primary: kind }
}
addActive({ tree: 'blade-arcane', summary: describe, branches: [
  { branch: 'light', names: ['Gleam Cut', 'Radiant Flurry', 'Dawn Waltz', 'Sunburst Waltz', 'Holy Blade'],
    a: ['Radiant Coda', 'Dawn Coda', 'Sunburst Coda'], b: ['Radiant Riposte', 'Dawn Riposte', 'Sunburst Riposte'] },
  { branch: 'dark', names: ['Shade Cut', 'Umbral Flurry', 'Dusk Waltz', 'Eclipse Waltz', 'Abyss Blade'],
    a: ['Umbral Coda', 'Dusk Coda', 'Eclipse Coda'], b: ['Umbral Riposte', 'Dusk Riposte', 'Eclipse Riposte'] },
  { branch: 'ultima', names: ['Arcane Cut', 'Arcane Flurry', 'Mystic Waltz', 'Astral Waltz', 'Ultima Blade'],
    a: ['Arcane Twilight', 'Mystic Twilight', 'Astral Twilight'], b: ['Arcane Riposte', 'Mystic Riposte', 'Astral Riposte'] },
],
core: (b, d) => d < 5 ? arcaneBlade(b, d)
  : { ...arcaneBlade(b, 5), special: b === 'light' ? 'vs-broken' : b === 'dark' ? 'vs-wounded' : 'pierce' },
// A: two more arcane hits (Ultima's are a Light and a Dark hit, which can break a shield). B: two more Short Sword hits.
a: (b, d) => { const core = arcaneBlade(b, d)
  return { ...core, hits: [...core.hits, ...pure(2, CODA * power(d), b === 'ultima' ? ['light', 'dark'] : (b as RpgDamageKind))], mp: core.mp + 4 } },
b: (b, d) => { const core = arcaneBlade(b, d)
  return { ...core, hits: [...core.hits, ...pure(2, CODA * power(d), 'short-sword')], mp: core.mp + 4 } },
})

// --- Passive trees: Short Sword follow-ups (retired, D310) and Cleric blessings ------------------------------------------
export const PASSIVE_TEXT: Readonly<Record<string, string>> = {
  'keen-edge': 'Duel follow-ups +20%', disarm: 'Duel follow-ups add Enfeeble 1',
  opening: '+1 slash after a weak spell hit', sunder: 'Duel follow-ups add Armor Break 1',
  lunge: 'Flurry goes to the lowest-HP foe', parry: 'After a Duel follow-up she takes −30% this round',
  'broad-edge': 'Melee follow-ups +20%', 'rending-arc': 'Arc adds Armor Break 1 to each foe slashed',
  'heavy-thrust': 'Thrust ×1.3', 'wide-stance': 'After a Melee follow-up she takes −20% from every-ally attacks this round',
  exploiter: 'Melee follow-ups ×1.3 on Broken foes', 'second-wind': 'Restores 2% max MP per foe slashed',
  allegro: 'Weave +1 slash', staccato: 'Tempo follow-ups +20%',
  counterpoint: 'Finisher also hits a second random foe', rubato: 'Tempo follow-ups ×1.3 on Broken foes',
  prestissimo: 'Weave +1 slash', fortissimo: 'Tempo follow-ups +25%',
  'lasting-grace': 'Grace lasts 3 rounds', 'abundant-grace': 'Party Grace gives 2 stacks',
  'second-blessing': 'Focused Grace also gives the next-best ally 1 stack', inspiration: 'Every Grace stack also restores 1% max MP',
  zeal: 'Brave and Faith cap at 4 stacks', overcharge: 'Breaker holds 5 charges',
  'lingering-malice': 'Malice lasts 3 rounds', 'spreading-malice': 'Focused Malice also gives every other foe 1 stack',
  exploit: 'Malice on a Broken foe gives +1 stack', erosion: 'A foe with 2+ Malice stacks raises its shield 1 lower',
  'deep-hex': 'Hex lasts 3 rounds', 'doom-hex': 'Hexed foes take +10% from everything',
  'lasting-sanctuary': 'Sanctuary lasts 3 rounds', bulwark: 'Barrier absorbs 10% per stack',
  purify: 'Sanctuary also clears one debuff', overflow: 'Healing past max HP becomes Barrier',
  miracle: 'Cure heals 15% per stack', 'sacred-ground': 'Regen also restores 1% max MP per stack',
}
addPassive('short-sword', [
  { branch: 'duel', core: [['Riposte', 'duel', 'Follows one-foe spells'], ['Counter Cut', 'duel', 'Duel follow-up 0.55'],
    ["Duelist's Flurry", 'duel', 'Duel follow-up 0.73'], ["Fencer's Dance", 'duel', 'Duel follow-up 0.93'],
    ['Spellblade', 'spellblade', "Duel slashes also carry the spell's element"]],
  forks: [['Keen Edge', 'keen-edge', 'Disarm', 'disarm'], ['Opening', 'opening', 'Sunder', 'sunder'], ['Lunge', 'lunge', 'Parry', 'parry']] },
  { branch: 'melee', core: [['Side Cut', 'melee', 'Follows every-foe spells'], ['Crescent Arc', 'melee', 'Melee follow-up 0.55'],
    ['Wide Arc', 'melee', 'Melee follow-up 0.73'], ['Full Moon', 'melee', 'Melee follow-up 0.93'],
    ['Whirlwind', 'whirlwind', 'Arc slashes twice; Thrust becomes two slashes']],
  forks: [['Broad Edge', 'broad-edge', 'Rending Arc', 'rending-arc'], ['Heavy Thrust', 'heavy-thrust', 'Wide Stance', 'wide-stance'], ['Exploiter', 'exploiter', 'Second Wind', 'second-wind']] },
  { branch: 'tempo', core: [['Quickstep', 'tempo', 'Follows random multi-hit spells'], ['Interlude', 'tempo', 'Tempo follow-up 0.55'],
    ['Rhythm Cut', 'tempo', 'Tempo follow-up 0.73'], ['Syncopation', 'tempo', 'Tempo follow-up 0.93'],
    ['Crescendo', 'crescendo', 'Weave +1 slash; Finisher ×1.4']],
  forks: [['Allegro', 'allegro', 'Staccato', 'staccato'], ['Counterpoint', 'counterpoint', 'Rubato', 'rubato'], ['Prestissimo', 'prestissimo', 'Fortissimo', 'fortissimo']] },
])
addPassive('cleric-staff', [
  { branch: 'grace', core: [['Brave', 'brave', '+10% weapon damage per stack'], ['Faith', 'faith', '+10% magic damage per stack'],
    ['Clarity', 'clarity', 'Restores 4% max MP per stack'], ['Breaker', 'breaker', 'Next weak hit removes 1 more shield point per charge'],
    ['Exalt', 'exalt', 'Brave and Faith together']],
  forks: [['Lasting Grace', 'lasting-grace', 'Abundant Grace', 'abundant-grace'], ['Second Blessing', 'second-blessing', 'Inspiration', 'inspiration'], ['Zeal', 'zeal', 'Overcharge', 'overcharge']] },
  { branch: 'malice', core: [['Armor Break', 'armor-break', '+10% weapon damage taken per stack'], ['Mind Break', 'mind-break', '+10% magic damage taken per stack'],
    ['Enfeeble', 'enfeeble', '−10% damage dealt per stack'], ['Hex', 'hex', 'Weak to Light and Dark for 2 rounds'],
    ['Shatter', 'shatter', 'Removes 1 shield point per stack at once']],
  forks: [['Lingering Malice', 'lingering-malice', 'Spreading Malice', 'spreading-malice'], ['Exploit', 'exploit', 'Erosion', 'erosion'], ['Deep Hex', 'deep-hex', 'Doom Hex', 'doom-hex']] },
  { branch: 'sanctuary', core: [['Barrier', 'barrier', 'Absorbs 8% of max HP per stack'], ['Regen', 'regen', 'Heals 4% max HP per stack each round'],
    ['Aegis', 'aegis', '−10% damage taken per stack'], ['Cure', 'cure', 'Heals 10% max HP per stack'],
    ['Rebirth', 'rebirth', 'Revives a knocked-out ally with 10% HP per stack, once a fight']],
  forks: [['Lasting Sanctuary', 'lasting-sanctuary', 'Bulwark', 'bulwark'], ['Purify', 'purify', 'Overflow', 'overflow'], ['Miracle', 'miracle', 'Sacred Ground', 'sacred-ground']] },
])

export const RPG_NODES: readonly RpgNode[] = NODES
const BY_ID = new Map(NODES.map((node) => [node.id, node]))
export const rpgNode = (id: string): RpgNode | undefined => BY_ID.get(id)
export const rpgTreeNodes = (tree: RpgTreeId): RpgNode[] => NODES.filter((node) => node.tree === tree)
export const rpgTreeBranches = (tree: RpgTreeId): string[] => [...new Set(rpgTreeNodes(tree).map((node) => node.branch))]
/** The Cleric blessing branch a cast's primary kind points to. */
export const rpgBlessingBranch = (primary: RpgDamageKind): 'grace' | 'malice' | 'sanctuary' | null =>
  primary === 'light' ? 'grace' : primary === 'dark' ? 'malice' : primary === 'ultima' ? 'sanctuary' : null
