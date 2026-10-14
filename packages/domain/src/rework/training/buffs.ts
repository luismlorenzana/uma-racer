// The scenario buffs, reviewed (docs/rework/04-tiers-and-promotion.md §8): one per scenario, deterministic, a whole
// percentage on card nodes in the derivation (D165), never paid by which node a card sits on. Foundation alone touches
// Extra Stats. The unchanged rules keep today's values (`BUFF_VALUES`); Team Spirit, Fragments and Encore are new, and
// two are renamed. Rivals' typical values stay with the tier rules until they are re-measured (T133).
import { BUFF_VALUES } from '../../scenario-buffs'
import { LAST_SCENARIO_NUMBER, scenarioRow } from '../tiers/map'
import { EXTRA_NODE_VALUES_TIER_1 } from '../tiers/scaling'

export type ReworkBuffId =
  | 'foundation' | 'team-spirit' | 'climax' | 'performance' | 'fragments' | 'new-wave' | 'genres' | 'full-course'
  | 'research' | 'legends' | 'construction' | 'soak' | 'shared-light' | 'orders' | 'encore'

/** Each buff's numbers in whole percent, so the derivation stays exact. */
export const REWORK_BUFF_VALUES = Object.freeze({
  /** Foundation: Extra Stats nodes pay ×1.5 (today's). */
  foundationStatPct: BUFF_VALUES.foundationStatPct,
  /** Team Spirit: +1% to every card node per filled Inspiration slot (04 §8, D346): four slots in Unity Cup, +4%. */
  teamSpiritPerSlot: 1,
  climaxPerGoal: BUFF_VALUES.climaxPerGoal,
  climaxGoals: BUFF_VALUES.climaxGoals,
  performance: BUFF_VALUES.performance,
  /** Fragments: cards from era 4 or older pay +8% (04 §8, replaces the 3★ rule). */
  fragments: BUFF_VALUES.fragments,
  fragmentsMaxEra: 4,
  /** New Wave, renamed from Expedition: era 6 or newer +5% (today's rule). */
  newWave: BUFF_VALUES.expedition,
  newWaveEra: BUFF_VALUES.expeditionEra,
  genres: BUFF_VALUES.genres,
  /** Full Course, renamed from Cooking: a card on its full node cap +10% (today's rule). */
  fullCourse: BUFF_VALUES.cooking,
  research: BUFF_VALUES.research,
  construction: BUFF_VALUES.construction,
  soak: BUFF_VALUES.soak,
  sharedLight: BUFF_VALUES.sharedLight,
  ordersStatPct: BUFF_VALUES.ordersStatPct,
  /** Encore, the 15th's placeholder: Wit cards +10% (04 §8). */
  encore: 10,
})

export interface ReworkBuff {
  /** The game's scenario T it belongs to. */
  readonly T: number
  readonly id: ReworkBuffId
  readonly name: string
  /** The rule as the player reads it. */
  readonly rule: string
}

const V = REWORK_BUFF_VALUES
const FRACTION_WORDS: Readonly<Record<number, string>> = { 25: 'a quarter', 50: 'half' }
function fractionWord(pct: number): string {
  const word = FRACTION_WORDS[pct]
  if (word === undefined) throw new Error(`No words for ${pct}%`)
  return word
}
const foundationValue = (value: number): number => (value * V.foundationStatPct) / 100
const F = EXTRA_NODE_VALUES_TIER_1

/** 04 §8's reviewed table, T = 1–15. */
export const REWORK_BUFFS: readonly ReworkBuff[] = Object.freeze(([
  ['foundation', 'Foundation', `Extra Stats nodes pay ×${V.foundationStatPct / 100} (single +${foundationValue(F.single)}, Duo +${foundationValue(F.duo)}/+${foundationValue(F.duo)}, Sun +${foundationValue(F.sun)})`],
  ['team-spirit', 'Team Spirit', `Each filled Inspiration slot adds +${V.teamSpiritPerSlot}% to every card node`],
  ['climax', 'Climax', `Each career goal won in this scenario adds +${V.climaxPerGoal}% to every card node, up to +${V.climaxPerGoal * V.climaxGoals}%`],
  ['performance', 'Performance', `A set with a Speed, Stamina, Power, Guts and Wit card: every card node pays +${V.performance}%`],
  ['fragments', 'Fragments', `Cards from era ${V.fragmentsMaxEra} or older pay +${V.fragments}%`],
  ['new-wave', 'New Wave', `Cards from era ${V.newWaveEra} or newer pay +${V.newWave}%`],
  ['genres', 'Genres', `A card type with two or more cards in the set pays +${V.genres}% on those cards`],
  ['full-course', 'Full Course', `A card on its full node cap pays +${V.fullCourse}% on all its nodes`],
  ['research', 'Research', `Speed and Power cards pay +${V.research}%`],
  ['legends', 'Legends', 'The first parent slot may hold any Uma in the game, never owned included'],
  ['construction', 'Construction', `A card on exactly its fair share of nodes pays +${V.construction}% on all of them`],
  ['soak', 'Soak', `Stamina and Guts cards pay +${V.soak}%`],
  ['shared-light', 'Shared Light', `The two lowest stats from card nodes each gain +${V.sharedLight}%`],
  ['orders', 'Orders', `Friend and Group cards also pay ${fractionWord(V.ordersStatPct)} of a node's value as stats, beside their SP`],
  ['encore', 'Encore', `Wit cards pay +${V.encore}%`],
] as const).map(([id, name, rule], i): ReworkBuff => Object.freeze({ T: i + 1, id, name, rule })))

if (REWORK_BUFFS.length !== LAST_SCENARIO_NUMBER) throw new Error('Every scenario has one buff')

/** Scenario T's buff (D165). */
export function reworkBuff(T: number): ReworkBuff {
  const buff = REWORK_BUFFS[T - 1]
  if (!buff || !Number.isInteger(T)) throw new RangeError(`Scenario must be 1–15: ${T}`)
  return buff
}

/** The percentage Extra Stats pay at T: 150 under Foundation, else 100 (03 §8). */
export const foundationPct = (T: number): number => (reworkBuff(T).id === 'foundation' ? V.foundationStatPct : 100)

/** Scenario T's name, for the buff table. */
export const buffScenarioName = (T: number): string => scenarioRow(T).name
