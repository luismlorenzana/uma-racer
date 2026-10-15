// Her lineage at the Lineage Hall (docs/game/05-training-hub.md §3, §5, §8; D250; T139): 05 §5's map, parents A and B
// above, A1, A2, B1 and B2 below, each slot locked, open or filled in the viewed preset, with its unique and two golds
// and their states, the skills they pay from whoever fills it (`lineagePays`), and the gold warning of 05 §3 when she
// has fewer natural golds than the position needs. Filling a slot is `set-lineage` through the Uma picker: owned Umas,
// never herself, a refused pick reading the rule's words, sorted by what each pick would add (`deriveBuild` with it).
// Lineage picks are made here only (T139). Pure.
import type { Aptitudes, DistanceCategory } from '@racer/domain'
import { say } from '@racer/domain/check-in'
import { isRefusal, type UmaState } from '@racer/domain/state'
import {
  deriveBuild, FIXED_UNLOCKS, fixedUnlock, goalsWon, goldPosition, isGrandparentSlot, lineagePays, setLineage, SLOT_LETTER, trainingTemplate,
  type DerivedBuild, type Unlock,
} from '@racer/domain/training'
import type { WorkState } from '@racer/domain/work'
import type { WordsContext } from '../../../ui/work/words'
import { itemState, itemWords, ruleWords, type Content, type ItemState } from '../common'
import { trainingWords } from '../words'

export type LineageSlotId = keyof typeof SLOT_LETTER

/** 05 §5's six slots in slot order: parents A and B, then A's grandparents A1, A2 and B's B1, B2. */
export const LINEAGE_SLOTS = Object.keys(SLOT_LETTER) as LineageSlotId[]

export interface LineageItem {
  readonly unlock: Unlock
  readonly state: ItemState['kind']
  readonly words: string | null
}

export interface GoldView {
  /** 0 for gold 1, 1 for gold 2. */
  readonly index: 0 | 1
  readonly item: LineageItem
  /** The gold her filler pays at this position, by name; null with nobody, or with too few golds. */
  readonly skill: string | null
  /** 05 §3's warning: the filler has fewer natural golds than this position needs. */
  readonly warning: string | null
}

export interface LineageSlotView {
  readonly slot: LineageSlotId
  readonly letter: string
  readonly grandparent: boolean
  readonly item: LineageItem
  /** Who sits here in the viewed preset. */
  readonly filler: string | null
  readonly unique: { readonly item: LineageItem; readonly skill: string | null }
  readonly golds: readonly GoldView[]
}

const skillName = (content: Content, skillId: string | null | undefined): string | null =>
  skillId == null ? null : content.skills.get(skillId)?.name ?? skillId

export function lineageView(settled: WorkState, uma: UmaState, preset: DistanceCategory, now: number, context: WordsContext, content: Content): readonly LineageSlotView[] {
  const row = settled.work[uma.outfitId]
  const lineage = uma.build.presets[preset].lineage
  const item = (unlock: Unlock): LineageItem => {
    const state = itemState(uma, row, unlock, now, settled.items)
    return { unlock, state: state.kind, words: itemWords(state, unlock, context, content) }
  }
  return LINEAGE_SLOTS.map((slot): LineageSlotView => {
    const letter = SLOT_LETTER[slot]
    const grandparent = isGrandparentSlot(slot)
    const filler = lineage[slot] ?? null
    const template = filler === null ? undefined : content.umas.get(filler)
    const pays = template === undefined ? null : lineagePays(template, content.skills)
    const who = trainingWords(grandparent ? 'who-grandparent' : 'who-parent')
    const golds = FIXED_UNLOCKS
      .filter((entry) => entry.kind === 'gold' && goldPosition(entry.target)?.slot === slot)
      .map((unlock): GoldView => {
        const index = goldPosition(unlock.target)!.index
        const have = pays?.golds.length ?? null
        const warning = have === null || have > index ? null
          : have === 1 ? trainingWords('gold-warning-one', { who, letter })
            : trainingWords('gold-warning-none', { who, n: index + 1, letter })
        return { index, item: item(unlock), skill: skillName(content, pays?.golds[index]), warning }
      })
      .sort((a, b) => a.index - b.index)
    return {
      slot,
      letter,
      grandparent,
      item: item(fixedUnlock({ kind: 'slot', target: slot })!),
      filler,
      unique: { item: item(fixedUnlock({ kind: 'unique', target: slot })!), skill: skillName(content, pays?.unique) },
      golds,
    }
  })
}

// ---- The picker ------------------------------------------------------------------------------------------------------

export interface LineagePick {
  readonly umaId: string
  /** `set-lineage`'s refusal on the current state, in its words; null when she can sit there. */
  readonly refusal: string | null
  /** Aptitude grades the pick would raise and skills it would add to her library, from `deriveBuild` with it. */
  readonly grades: number
  readonly skills: number
  readonly line: string
  /** The map `set-lineage` takes for this pick. */
  readonly lineage: Readonly<Partial<Record<LineageSlotId, string>>>
}

const RANK = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'] as const
const rank = (grade: string): number => RANK.indexOf(grade as (typeof RANK)[number])

/** Aptitude grades raised from `before` to `after`, summed over every surface, distance and running style. */
export function gradesRaised(before: Aptitudes, after: Aptitudes): number {
  let raised = 0
  for (const group of ['surface', 'distance', 'strategy'] as const) {
    const was = before[group] as Readonly<Record<string, string>>
    const now = after[group] as Readonly<Record<string, string>>
    for (const key of Object.keys(was)) raised += Math.max(0, rank(now[key] ?? 'G') - rank(was[key] ?? 'G'))
  }
  return raised
}

/** Every owned Uma but herself for `slot`, each tried through `set-lineage` and measured by what she'd add. */
export function lineagePicks(settled: WorkState, uma: UmaState, preset: DistanceCategory, slot: LineageSlotId, derived: DerivedBuild, now: number, context: WordsContext, content: Content): ReadonlyMap<string, LineagePick> {
  const current = uma.build.presets[preset]
  const template = trainingTemplate(content, uma.outfitId)
  const library = new Set(derived.library.map((skill) => skill.skillId))
  const picks = new Map<string, LineagePick>()
  for (const umaId of Object.keys(settled.umas)) {
    if (umaId === uma.outfitId) continue
    const lineage = { ...current.lineage, [slot]: umaId }
    const tried = setLineage(settled, { umaId: uma.outfitId, preset, lineage }, now, { content })
    const refusal = isRefusal(tried) ? ruleWords(say(tried.reason, tried.data), context, content) : null
    let grades = 0
    let skills = 0
    if (refusal === null) {
      const build = { ...uma.build, presets: { ...uma.build.presets, [preset]: { ...current, lineage } } }
      const next = deriveBuild({ at: uma, build, preset, template, content, goalsWon: goalsWon(uma) })
      grades = gradesRaised(derived.aptitudes, next.aptitudes)
      skills = next.library.filter((skill) => !library.has(skill.skillId)).length
    }
    const line = grades + skills === 0 ? trainingWords('lineage-adds-none') : trainingWords('lineage-adds', { grades, skills })
    picks.set(umaId, { umaId, refusal, grades, skills, line, lineage })
  }
  return picks
}

/** The map without `slot`: emptying it. */
export function withoutSlot(uma: UmaState, preset: DistanceCategory, slot: LineageSlotId): Readonly<Partial<Record<LineageSlotId, string>>> {
  const { [slot]: _gone, ...rest } = uma.build.presets[preset].lineage
  return rest
}
