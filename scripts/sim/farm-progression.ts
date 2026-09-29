// Stable Farm progression harness (docs/design/farm.md#outfit-farming-level-and-aggregate-farm-level, T082).
// Every outfit and crop is synthetic; this script never reads private content.
import {
  FARM_CROP_LEVEL_REQUIREMENTS,
  FARM_OUTFIT_LEVEL_REQUIREMENTS,
  FARM_PLOT_LEVEL_REQUIREMENTS,
  FARMING_EXP_PER_HARVEST,
  MAX_OUTFIT_FARMING_LEVEL,
  applyFarmingXp,
  farmLevel,
  isCropTierUnlocked,
  type OutfitFarmingProgress,
} from '../../packages/domain/src/farm/index'

type PolicyId = 'focused' | 'ideal-spread' | 'casual-spread'

interface Policy {
  id: PolicyId
  harvestsPerDay: 1 | 2
  useUnlockedPlots: boolean
}

export interface FarmProgressionSimulation {
  policy: PolicyId
  plotUnlockDays: Array<number | null>
  cropTierUnlockDays: Array<number | null>
  leadOutfitLevelDays: Array<number | null>
}

const POLICIES: readonly Policy[] = [
  { id: 'focused', harvestsPerDay: 2, useUnlockedPlots: false },
  { id: 'ideal-spread', harvestsPerDay: 2, useUnlockedPlots: true },
  { id: 'casual-spread', harvestsPerDay: 1, useUnlockedPlots: true },
]

const firstUnset = (values: Array<number | null>, index: number, day: number): void => {
  if (values[index] === null) values[index] = day
}

export function simulateFarmProgression(policy: Policy): FarmProgressionSimulation {
  const workers: Record<string, OutfitFarmingProgress> = Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => [`synthetic-outfit-${index + 1}`, { level: 1, exp: 0 }]),
  )
  const ids = Object.keys(workers)
  const plotUnlockDays: Array<number | null> = Array.from({ length: FARM_PLOT_LEVEL_REQUIREMENTS.length }, () => null)
  const cropTierUnlockDays: Array<number | null> = Array.from({ length: FARM_CROP_LEVEL_REQUIREMENTS.length }, () => null)
  const leadOutfitLevelDays: Array<number | null> = Array.from({ length: MAX_OUTFIT_FARMING_LEVEL }, () => null)
  plotUnlockDays[0] = 0
  cropTierUnlockDays[0] = 0
  leadOutfitLevelDays[0] = 0

  const record = (day: number): void => {
    const level = farmLevel(workers)
    FARM_PLOT_LEVEL_REQUIREMENTS.forEach((required, index) => {
      if (level >= required) firstUnset(plotUnlockDays, index, day)
    })
    FARM_CROP_LEVEL_REQUIREMENTS.forEach((_, index) => {
      const tier = index + 1
      if (ids.some((id) => isCropTierUnlocked(tier, workers[id]!.level, level))) {
        firstUnset(cropTierUnlockDays, index, day)
      }
    })
    const lead = Math.max(...ids.map((id) => workers[id]!.level))
    for (let outfitLevel = 1; outfitLevel <= lead; outfitLevel += 1) {
      firstUnset(leadOutfitLevelDays, outfitLevel - 1, day)
    }
  }

  const wavesPerDay = policy.harvestsPerDay
  for (let wave = 1; wave <= 2_000; wave += 1) {
    const currentFarmLevel = farmLevel(workers)
    const unlockedPlots = FARM_PLOT_LEVEL_REQUIREMENTS.filter((required) => currentFarmLevel >= required).length
    const active = policy.useUnlockedPlots ? unlockedPlots : 1
    for (let index = 0; index < active; index += 1) {
      const id = ids[index]!
      workers[id] = applyFarmingXp(workers[id]!, FARMING_EXP_PER_HARVEST).progress
    }
    const day = wave / wavesPerDay
    record(day)
    if (cropTierUnlockDays.every((value) => value !== null) && leadOutfitLevelDays.every((value) => value !== null)) break
    if (!policy.useUnlockedPlots && workers[ids[0]!]!.level === MAX_OUTFIT_FARMING_LEVEL) break
  }

  return { policy: policy.id, plotUnlockDays, cropTierUnlockDays, leadOutfitLevelDays }
}

const formatDays = (values: readonly (number | null)[]): string =>
  values.map((day, index) => `${index + 1}:${day === null ? '—' : `${day}d`}`).join('  ')

const results = POLICIES.map(simulateFarmProgression)
const ideal = results.find((result) => result.policy === 'ideal-spread')!
const casual = results.find((result) => result.policy === 'casual-spread')!

const expectedIdeal = [0, 2, 6, 12, 20, 28]
const expectedCasual = [0, 4, 12, 24, 40, 56]
if (JSON.stringify(ideal.plotUnlockDays) !== JSON.stringify(expectedIdeal) ||
  JSON.stringify(casual.plotUnlockDays) !== JSON.stringify(expectedCasual)) {
  throw new Error(`Farm plot envelope drifted: ideal ${ideal.plotUnlockDays.join('/')} casual ${casual.plotUnlockDays.join('/')}`)
}

console.log('Stable Farm progression — synthetic outfits, fixed 12 XP harvests')
console.log(`Plot Farm Levels: ${FARM_PLOT_LEVEL_REQUIREMENTS.join(' / ')}`)
console.log(`Crop outfit levels: ${FARM_OUTFIT_LEVEL_REQUIREMENTS.join(' / ')}`)
console.log(`Crop Farm Levels: ${FARM_CROP_LEVEL_REQUIREMENTS.join(' / ')}`)
for (const result of results) {
  console.log(`\n${result.policy}`)
  console.log(`  plots       ${formatDays(result.plotUnlockDays)}`)
  console.log(`  crop tiers  ${formatDays(result.cropTierUnlockDays)}`)
  console.log(`  outfit Lv   ${formatDays(result.leadOutfitLevelDays)}`)
}

