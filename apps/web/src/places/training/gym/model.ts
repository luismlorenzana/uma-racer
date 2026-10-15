// Her Extra Stats map at the Gym (docs/rework/05-training-hub.md §3, §6, §8; T139): 05 §6's 37 nodes, in columns by
// `EXTRA_STATS` (the ring: Stamina, Wit, Power, Speed, Guts) and then the Sun, in rows by layer and grade, each with its
// value at her tier and scenario (`extraNodeStats`) and its state; open nodes on or off in the viewed preset, "9 of 9 on"
// against `extraCapacity`. A switch runs `set-active-nodes`, whose `over-capacity` reads in its own words. A Duo sits
// between its two columns; a Duo's or Sun's Unlock opens the first room `roomsFor` lists. Pure.
import type { DistanceCategory, StatKey } from '@racer/domain'
import { scenarioNumber } from '@racer/domain/tiers'
import type { UmaState } from '@racer/domain/state'
import {
  EXTRA_NODES, EXTRA_STATS, extraCapacity, extraNodeStats, fixedUnlock, unlockLabel, type DerivedBuild, type ExtraNode, type Unlock,
} from '@racer/domain/training'
import type { WorkState } from '@racer/domain/work'
import type { WordsContext } from '../../../ui/work/words'
import { itemState, itemWords, type Content, type ItemState } from '../common'
import { trainingWords } from '../words'

export interface ExtraCell {
  readonly id: string
  readonly kind: ExtraNode['kind']
  readonly name: string
  readonly stats: readonly StatKey[]
  readonly grade: number
  /** Its column: 0–4 by the ring, a Duo halfway between its two (0.5–3.5), the Sun 5. */
  readonly column: number
  /** "+40", "+20 ×2", "+8 ×5". */
  readonly value: string
  readonly state: ItemState['kind']
  /** On in the viewed preset (open nodes only). */
  readonly on: boolean
  readonly words: string | null
  readonly unlock: Unlock
}

export interface ExtraLayer {
  readonly layer: number
  readonly title: string
  readonly singles: readonly ExtraCell[]
  readonly duos: readonly ExtraCell[]
  readonly sun: ExtraCell | null
}

export interface ExtraView {
  readonly layers: readonly ExtraLayer[]
  readonly cells: readonly ExtraCell[]
  /** Active nodes that pay in the viewed preset, and the scenario's capacity. */
  readonly on: number
  readonly capacity: number
  readonly active: readonly string[]
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** The whole map for the viewed preset. */
export function extraView(settled: WorkState, uma: UmaState, preset: DistanceCategory, derived: DerivedBuild, now: number, context: WordsContext, content: Content): ExtraView {
  const T = scenarioNumber(uma)
  const row = settled.work[uma.outfitId]
  const active = derived.activeExtraNodes
  const cell = (node: ExtraNode): ExtraCell => {
    const unlock = fixedUnlock({ kind: node.kind, target: node.id })!
    const state = itemState(uma, row, unlock, now, settled.items)
    const vector = extraNodeStats(uma.tier, T, node.id)
    const each = Math.round(vector[node.stats[0]!])
    const value = node.kind === 'single' ? trainingWords('value-single', { n: each })
      : node.kind === 'duo' ? trainingWords('value-duo', { n: each }) : trainingWords('value-sun', { n: each })
    const column = node.kind === 'sun' ? EXTRA_STATS.length
      : node.kind === 'single' ? EXTRA_STATS.indexOf(node.stats[0]!)
        : Math.min(...node.stats.map((stat) => EXTRA_STATS.indexOf(stat))) + 0.5
    return {
      id: node.id,
      kind: node.kind,
      name: capital(unlockLabel(unlock)),
      stats: node.stats,
      grade: node.grade,
      column,
      value,
      state: state.kind,
      on: state.kind === 'open' && active.includes(node.id),
      words: itemWords(state, unlock, context, content),
      unlock,
    }
  }
  const cells = EXTRA_NODES.map(cell)
  const layers = [1, 2, 3, 4, 5].map((layer): ExtraLayer => {
    const here = EXTRA_NODES.filter((node) => node.layer === layer)
    const sun = here.find((node) => node.kind === 'sun')
    const low = 2 * layer - 1
    return {
      layer,
      title: sun === undefined
        ? trainingWords('layer-row', { s: layer, low })
        : trainingWords('layer-row-sun', { s: layer, low, high: sun.grade }),
      singles: cells.filter((entry) => entry.kind === 'single' && here.some((node) => node.id === entry.id)),
      duos: cells.filter((entry) => entry.kind === 'duo' && here.some((node) => node.id === entry.id)),
      sun: sun === undefined ? null : cells.find((entry) => entry.id === sun.id)!,
    }
  })
  return { layers, cells, on: active.length, capacity: extraCapacity(uma.scenario), active }
}

/** The preset's active list with `id` switched: on adds it, off takes it away (`set-active-nodes` checks the rest). */
export function switched(active: readonly string[], id: string, on: boolean): readonly string[] {
  return on ? [...active.filter((entry) => entry !== id), id] : active.filter((entry) => entry !== id)
}
