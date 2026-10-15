// The loop simulation's two probes (T132's "Probes"; docs/rework/12-economy-and-pacing.md §5, §6):
// Farm Levels a day early in a tier, and the first unlock on a fresh account. Both run on the rules' operations only.
import { collect, start } from '../work/operations'
import { newWorkState } from '../work/state'
import { itemEnds } from '../work/timeline'
import { SESSION_KIND, type WorkState } from '../work/types'
import { rawItem } from '../items/catalogue'
import { highestOpenGrade } from '../items/grades'
import { FAMILY_SITE } from '../farm/jobs'
import { newAccount, unlockUma } from '../tiers/roster'
import { isRefusal } from '../state/types'
import { nextCheckIn } from '../check-in/schedule'
import { projectWork } from '../planner/project'
import { LOOP_EPOCH, loopRng, MS_PER_DAY, MS_PER_HOUR, UTC_OFFSET_MIN } from './clock'
import { PROBE_LETTERS, probeUmaId, SIM_CONTENT, type ProbeLetter } from './fixtures'
import { createLoop, ENV } from './loop'
import { BASELINE_CONFIG, checkInsOn, type LoopConfig } from './policies'

/** The Farm Level probe runs from Lv 1 to Lv 21, grade 5's gate: "early in the tier" (T132). */
export const PROBE_FROM_LEVEL = 1
export const PROBE_TO_LEVEL = 21
/** The family the probe gathers: Vegetables, whose site is the Vegetable Garden, at a Lv 1 building. */
const PROBE_FAMILY = 'vegetables' as const

export interface FarmLevelProbe {
  readonly letter: ProbeLetter
  readonly days: number
  readonly levelsPerDay: number
  /** The day each Farm Level was reached, from day 0. */
  readonly reached: readonly { readonly level: number; readonly day: number }[]
}

/**
 * One Uma at a Lv 1 Vegetable Garden, gathering without a break at her highest open grade (no inputs needed), one item
 * at a time, collected and restarted the moment it ends, from Farm Lv 1 to 21, at Front Runner C, A or S (07 §3–§4).
 */
export function farmLevelProbe(letter: ProbeLetter): FarmLevelProbe {
  const outfitId = probeUmaId(letter)
  const unlocked = unlockUma(newAccount(LOOP_EPOCH), { outfitId }, LOOP_EPOCH, { content: SIM_CONTENT })
  if (isRefusal(unlocked)) throw new Error(unlocked.reason)
  let state: WorkState = newWorkState(unlocked.state)
  let now = LOOP_EPOCH
  const reached: { level: number; day: number }[] = []
  for (let guard = 0; state.umas[outfitId]!.farm.level < PROBE_TO_LEVEL; guard += 1) {
    if (guard > 10_000) throw new Error('The Farm Level probe never reached its level')
    const grade = highestOpenGrade(state.umas[outfitId]!.farm.level)
    const item = rawItem(PROBE_FAMILY, grade).id
    const started = start(state, { outfitId, slot: { building: FAMILY_SITE[PROBE_FAMILY], slot: 0 }, request: { kind: 'gather', item, count: 1 } }, now, ENV)
    if (isRefusal(started)) throw new Error(started.reason)
    now = started.receipt.endsAt
    const collected = collect(started.state, { outfitId }, now, ENV)
    state = collected.state
    for (let level = collected.receipt.farmLevel.from + 1; level <= collected.receipt.farmLevel.to; level += 1) {
      reached.push({ level, day: (now - LOOP_EPOCH) / MS_PER_DAY })
    }
  }
  const days = reached.find((entry) => entry.level === PROBE_TO_LEVEL)!.day
  return { letter, days, levelsPerDay: (PROBE_TO_LEVEL - PROBE_FROM_LEVEL) / days, reached }
}

export const farmLevelProbes = (): readonly FarmLevelProbe[] => PROBE_LETTERS.map(farmLevelProbe)

export interface FirstUnlockProbe {
  /** When the first session started and its first unlock finished. */
  readonly sessionStartedAt: number
  readonly firstUnlockAt: number
  /** Hours from the account's first check-in (08:00 on day 0) to the first unlock. */
  readonly hours: number
  readonly checkIns: number
}

/**
 * The fresh account from 08:00 on day 0 (12 §5's first day), the owner checking in at every finish until the first
 * session starts; it reads that session's first unlock (T132). Each check-in is the loop's own.
 */
export function firstUnlockProbe(config: LoopConfig = BASELINE_CONFIG): FirstUnlockProbe {
  const engine = createLoop({ ...config, tiers: 1, sizing: 'one' }, loopRng(config.seed))
  const first = checkInsOn(0, config.checkIns)[0]!
  let now = first
  for (let checkIns = 1; checkIns < 500; checkIns += 1) {
    engine.checkIn(now, 0, config.checkIns.length, nextCheckIn(now, config.checkIns, UTC_OFFSET_MIN))
    const state = engine.state()
    for (const row of Object.values(state.work)) {
      const session = row.entries.find((entry) => entry.request.kind === SESSION_KIND)
      if (session) {
        const firstUnlockAt = itemEnds(session.startedAt, session.seconds, session.acceleratedMs)[0]!
        return { sessionStartedAt: session.startedAt, firstUnlockAt, hours: (firstUnlockAt - first) / MS_PER_HOUR, checkIns }
      }
    }
    // The next finish: the first item to end after now, running or queued (T131's projection of T127's settle).
    const ends = [
      ...projectWork(state, now, ENV).coming.map((item) => item.at),
      ...Object.values(state.work).flatMap((row) => row.entries.flatMap((entry) => itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs))),
    ].filter((at) => at > now)
    if (ends.length === 0) throw new Error('Nothing is working on the first day')
    now = Math.min(...ends)
  }
  throw new Error('No session started on the first day')
}

