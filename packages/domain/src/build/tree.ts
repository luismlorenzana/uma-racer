// Her tree (docs/game/05-the-build.md, D382): five branches × five levels × four pips, opening in order (the next
// level opens when four are full), plus two Camp nodes once any branch reaches level 3. Pips spend drills of their
// branch's colour; what every pip pays is derived when read (derive.ts). Pure.
import { refuse, type Refusal } from '../save/registry'
import { BRANCHES, PIPS_PER_BRANCH, type Branch, type CareerRecord } from '../save/records'
import { capProfileAt } from '../tiers/scaling'
import { STATS, type Stats } from '../types'
import { BRANCH_NAMES } from './deck'
import { branchLevel, pipLevel, PIPS_PER_LEVEL } from './facilities'
import { branchCost, CAMP_LEVEL, CAMP_OPENS_AT_LEVEL, CAMP_SESSIONS, gainDelta, readDeck, statParts, treeGain, type BuildView } from './derive'
import type { Gain } from './session'

/** Camps open once any branch's level-3 row is open: eight pips bought there. */
export const campsOpen = (career: Pick<CareerRecord, 'pips'>): boolean =>
  Object.values(career.pips).some((pips) => branchLevel(pips) >= CAMP_OPENS_AT_LEVEL)

/** What buying something in the tree does, before it's bought. */
export interface TreePreview {
  readonly branch: Branch
  /** The facility level its sessions train at. */
  readonly level: number
  /** Drills of the branch's colour. */
  readonly cost: number
  /** What her stats and SP gain, before the caps. */
  readonly gain: Gain
  /** The part of the gain her caps throw away. */
  readonly overflow: Stats
}

function preview(career: CareerRecord, after: CareerRecord, view: BuildView, branch: Branch, level: number, cost: number): TreePreview {
  const before = statParts(career, view).total
  const next = statParts(after, view).total
  const caps = capProfileAt(career.T)
  const gain = gainDelta(treeGain(after, view), treeGain(career, view))
  const overflow = Object.fromEntries(STATS.map((stat) => {
    const kept = Math.min(caps[stat], next[stat]) - Math.min(caps[stat], before[stat])
    return [stat, Math.max(0, gain.stats[stat] - kept)]
  })) as unknown as Stats
  return { branch, level, cost, gain, overflow }
}

/** A branch's next pip: its level, cost, gain and overflow; null once the branch is full. */
export function previewPip(career: CareerRecord, view: BuildView, branch: Branch): TreePreview | null {
  const pips = career.pips[branch]
  if (pips >= PIPS_PER_BRANCH) return null
  const level = pipLevel(pips)
  const after = { ...career, pips: { ...career.pips, [branch]: pips + 1 } }
  return preview(career, after, view, branch, level, branchCost(career, view, branch, level))
}

/**
 * A branch's next `count` pips bought at once (the career screens' Buy row, T158): their summed cost, gain and overflow,
 * exactly what `buyPips` with that count spends and pays. Its `level` is the first pip's. Null when the branch hasn't
 * that many pips left, or `count` isn't a whole number from 1.
 */
export function previewPips(career: CareerRecord, view: BuildView, branch: Branch, count: number): TreePreview | null {
  const pips = career.pips[branch]
  if (!Number.isInteger(count) || count < 1 || pips + count > PIPS_PER_BRANCH) return null
  const read = readDeck(career, view)
  let cost = 0
  for (let index = pips; index < pips + count; index++) cost += branchCost(career, view, branch, pipLevel(index), read)
  const after = { ...career, pips: { ...career.pips, [branch]: pips + count } }
  return preview(career, after, view, branch, pipLevel(pips), cost)
}

/** The pips left in a branch's open level: what Buy row buys (0 once the branch is full). */
export const rowLeft = (pips: number): number => (pips >= PIPS_PER_BRANCH ? 0 : PIPS_PER_LEVEL - (pips % PIPS_PER_LEVEL))

/** A Camp node in a branch: four level-5 sessions; null while camps are closed or both are bought. */
export function previewCamp(career: CareerRecord, view: BuildView, branch: Branch): TreePreview | null {
  const slot = career.camps.indexOf(null)
  if (!campsOpen(career) || slot < 0) return null
  const after = { ...career, camps: career.camps.map((camp, i) => (i === slot ? branch : camp)) }
  return preview(career, after, view, branch, CAMP_LEVEL, CAMP_SESSIONS * branchCost(career, view, branch, CAMP_LEVEL))
}

export interface Bought {
  readonly career: CareerRecord
  readonly spent: number
}

/** Buys the next `count` pips of a branch, in order, spending drills of its colour. */
export function buyPips(career: CareerRecord, view: Pick<BuildView, 'cards' | 'bonds'>, branch: Branch, count: number): Bought | Refusal {
  const name = BRANCH_NAMES[branch]
  const pips = career.pips[branch]
  const left = PIPS_PER_BRANCH - pips
  if (left === 0) return refuse('branch-complete', `${name}'s branch is complete.`)
  if (!Number.isInteger(count) || count < 1) return refuse('bad-count', 'Buy one pip or more.')
  if (count > left) return refuse('too-many-pips', `${name} has ${left} pip${left === 1 ? '' : 's'} left.`, { left })
  const read = readDeck(career, view)
  let spent = 0
  for (let index = pips; index < pips + count; index++) spent += branchCost(career, view, branch, pipLevel(index), read)
  const have = career.wallet.drills[branch]
  if (spent > have) return refuse('not-enough-drills', `That takes ${spent} ${name} drills; she has ${have}.`, { need: spent, have })
  return {
    career: {
      ...career,
      pips: { ...career.pips, [branch]: pips + count },
      wallet: { ...career.wallet, drills: { ...career.wallet.drills, [branch]: have - spent } },
    },
    spent,
  }
}

/** Buys the next Camp node in a branch: four level-5 sessions' drills. */
export function buyCamp(career: CareerRecord, view: Pick<BuildView, 'cards' | 'bonds'>, branch: Branch): Bought | Refusal {
  const name = BRANCH_NAMES[branch]
  if (!campsOpen(career)) return refuse('camps-closed', `Camps open once a branch reaches level ${CAMP_OPENS_AT_LEVEL}.`)
  const slot = career.camps.indexOf(null)
  if (slot < 0) return refuse('camps-full', 'Both Camps are bought.')
  const spent = CAMP_SESSIONS * branchCost(career, view, branch, CAMP_LEVEL)
  const have = career.wallet.drills[branch]
  if (spent > have) return refuse('not-enough-drills', `That takes ${spent} ${name} drills; she has ${have}.`, { need: spent, have })
  return {
    career: {
      ...career,
      camps: career.camps.map((camp, i) => (i === slot ? branch : camp)),
      wallet: { ...career.wallet, drills: { ...career.wallet.drills, [branch]: have - spent } },
    },
    spent,
  }
}

/** The tree's pips: five branches of 20 (Camps aside). */
export const TREE_PIPS = PIPS_PER_BRANCH * BRANCHES.length
