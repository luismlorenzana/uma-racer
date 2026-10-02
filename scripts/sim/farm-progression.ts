// Stable Farm progression harness (docs/design/farm.md#outfit-farming-level-and-aggregate-farm-level, D234, D237).
// Every outfit and crop is synthetic; this script never reads private content.
//
// Each policy is a check-in schedule (hours of the day the player opens the Farm). At every check-in the player harvests
// what is ready, assigns a free outfit to any open plot without one, and plants the fastest crop the worker can grow
// (an older row, at 7h 30m, once she has two).
// Workers stay on their plots: with a linear Farming Level every harvest is worth the same Farm Level whoever grows it,
// and a veteran grows faster. The stable starts with 30 owned outfits and gains one a week.
import {
  FARM_CROP_TIERS,
  FARM_PLOTS_PER_SECTION,
  FARMING_EXP_PER_HARVEST,
  FARMING_EXP_PER_LEVEL,
  MAX_FARM_PLOTS,
  applyFarmingXp,
  cropGrowthMinutes,
  cropTierOpenLevel,
  farmLevel,
  farmPlotRequirement,
  highestCropTier,
  unlockedPlotCount,
  type OutfitFarmingProgress,
} from '../../packages/domain/src/farm/index'

type PolicyId = 'five-a-day' | 'three-a-day' | 'twice-a-day' | 'once-a-day'

interface Policy {
  id: PolicyId
  /** Hours of the day the Farm is opened. */
  checks: readonly number[]
}

export interface FarmProgressionSimulation {
  policy: PolicyId
  /** Day each plot opened, by plot number (index 0 is plot 1). */
  plotDays: Array<number | null>
  /** Day the best worker opened each scenario row (index 0 is scenario 1). */
  tierDays: Array<number | null>
  farmLevelAt: Record<number, number>
}

const DAYS = 1_460
const PLOTS_TRACKED = MAX_FARM_PLOTS
const START_OUTFITS = 30
const NEW_OUTFIT_EVERY_DAYS = 7
const SNAPSHOT_DAYS = [30, 90, 180, 365, 730, 1_460] as const

const POLICIES: readonly Policy[] = [
  { id: 'five-a-day', checks: [8, 12, 16, 20, 24] },
  // Eight hours apart: every 7h 30m older-row crop is ready at the next check-in (D237).
  { id: 'three-a-day', checks: [7, 15, 23] },
  { id: 'twice-a-day', checks: [8, 20] },
  { id: 'once-a-day', checks: [20] },
]

/** The fastest crop she can grow: an older row, at 7h 30m, once she has two (D237). */
function fastestMinutes(level: number): number {
  let best = Number.POSITIVE_INFINITY
  for (let tier = 1; tier <= highestCropTier(level); tier += 1) best = Math.min(best, cropGrowthMinutes(tier, level))
  return best
}

export function simulateFarmProgression(policy: Policy): FarmProgressionSimulation {
  const workers: OutfitFarmingProgress[] = Array.from({ length: START_OUTFITS }, () => ({ level: 1, exp: 0 }))
  const plots: Array<{ worker: number | null; readyAt: number | null }> = []
  const busy = new Set<number>()
  const plotDays: Array<number | null> = Array.from({ length: PLOTS_TRACKED }, () => null)
  const tierDays: Array<number | null> = Array.from({ length: FARM_CROP_TIERS }, () => null)
  const farmLevelAt: Record<number, number> = {}
  const record = () => Object.fromEntries(workers.map((progress, index) => [index, progress]))

  for (let day = 0; day < DAYS; day += 1) {
    if (day > 0 && day % NEW_OUTFIT_EVERY_DAYS === 0) workers.push({ level: 1, exp: 0 })
    for (const hour of policy.checks) {
      const now = (day * 24 + hour) * 60
      for (const plot of plots) {
        if (plot.worker === null || plot.readyAt === null || plot.readyAt > now) continue
        workers[plot.worker] = applyFarmingXp(workers[plot.worker]!, FARMING_EXP_PER_HARVEST).progress
        plot.readyAt = null
      }
      const level = farmLevel(record())
      while (plots.length < unlockedPlotCount(level)) {
        plots.push({ worker: null, readyAt: null })
        if (plots.length <= PLOTS_TRACKED) plotDays[plots.length - 1] = day + hour / 24
      }
      for (const plot of plots) {
        if (plot.worker === null) {
          const pick = workers.findIndex((_, index) => !busy.has(index))
          if (pick < 0) continue
          plot.worker = pick
          busy.add(pick)
        }
        if (plot.readyAt === null) plot.readyAt = now + fastestMinutes(workers[plot.worker]!.level)
      }
      const lead = Math.max(...workers.map((progress) => progress.level))
      for (let tier = 1; tier <= FARM_CROP_TIERS; tier += 1) {
        if (tierDays[tier - 1] === null && lead >= cropTierOpenLevel(tier)) tierDays[tier - 1] = day
      }
    }
    if ((SNAPSHOT_DAYS as readonly number[]).includes(day + 1)) farmLevelAt[day + 1] = farmLevel(record())
  }
  return { policy: policy.id, plotDays, tierDays, farmLevelAt }
}

const days = (values: readonly (number | null)[], from: number, to: number): string =>
  values.slice(from, to).map((day) => day === null ? '—' : String(Math.round(day))).join(' ')

const results = POLICIES.map(simulateFarmProgression)

// The pacing envelope D234 was tuned to, opening the Farm twice a day: Section 1 fills in about a month, Section 2 in about
// four, Section 3, the last (D237), in about ten, and every plot takes longer than the one before.
const twice = results.find((result) => result.policy === 'twice-a-day')!
const sectionDone = (section: number) => twice.plotDays[section * FARM_PLOTS_PER_SECTION - 1]
const envelope: Array<[string, number | null | undefined, number, number]> = [
  ['Section 1', sectionDone(1), 21, 40],
  ['Section 2', sectionDone(2), 100, 170],
  ['Section 3', sectionDone(3), 240, 380],
]
for (const [label, day, min, max] of envelope) {
  if (day === null || day === undefined || day < min || day > max) throw new Error(`Farm pacing drifted: ${label} on day ${day} (want ${min}–${max})`)
}
const opened = twice.plotDays.filter((day): day is number => day !== null)
const waits = opened.slice(1).map((day, index) => day - opened[index]!)
if (waits.some((wait, index) => index > 0 && wait < waits[index - 1]! - 1)) throw new Error(`Farm plot waits shrank: ${waits.join(' ')}`)

const last = farmPlotRequirement(MAX_FARM_PLOTS)
const harvestsPerLevel = FARMING_EXP_PER_LEVEL / FARMING_EXP_PER_HARVEST
console.log('Stable Farm progression — synthetic outfits (30, +1 a week), 2 harvests a level, fastest crop, workers stay')
console.log(`Plot Farm Levels: ${Array.from({ length: MAX_FARM_PLOTS }, (_, index) => farmPlotRequirement(index + 1)).join(' ')}`)
console.log(`Plot ${MAX_FARM_PLOTS} (the last) at Farm Lv${last.toLocaleString()}: ${((last - 1) * harvestsPerLevel).toLocaleString()} harvests, ` +
  `or ${Math.ceil((last - 1) / 149)} outfits at Farming Lv150, ${Math.ceil((last - 1) / 99)} at Lv100, ${Math.ceil((last - 1) / 139)} at Lv140`)
for (const result of results) {
  console.log(`\n${result.policy}`)
  for (let section = 1; section * FARM_PLOTS_PER_SECTION <= PLOTS_TRACKED; section += 1) {
    const start = (section - 1) * FARM_PLOTS_PER_SECTION
    console.log(`  Section ${section} plots open on days  ${days(result.plotDays, start, start + FARM_PLOTS_PER_SECTION)}`)
  }
  console.log(`  best worker opens scenarios on days  ${days(result.tierDays, 0, FARM_CROP_TIERS)}`)
  console.log(`  Farm Level  ${Object.entries(result.farmLevelAt).map(([day, level]) => `d${day}:${level}`).join('  ')}`)
}
