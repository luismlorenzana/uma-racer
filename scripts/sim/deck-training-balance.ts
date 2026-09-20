// Synthetic support-deck/Training balance harness (docs/design/support-cards.md#deck).
// Every id and number below is invented; this script never reads private or original-game content.
import {
  CARD_EFFECTS,
  MAX_TRAINING_LEVEL,
  STATS,
  applyForm,
  baselineStatCap,
  createCardSave,
  createUmaSave,
  dealTrainingCards,
  npcRaceStats,
  parseRaceCondition,
  previewTrainingFacilities,
  resolveTrainingTurn,
  supportDeckEffectTotals,
  trainingTurnSeed,
  yourForm,
  type CardEffect,
  type CardSave,
  type CompiledRaceSkill,
  type Facility,
  type RaceSkillEffectKind,
  type SkillTemplate,
  type Stats,
  type Strategy,
  type SupportCardTemplate,
  type SupportCardType,
  type TrainingCardInput,
  type UmaTemplate,
} from '../../packages/domain/src/index'
import { simulateRace } from '../../packages/race/src/index'

const samplesArg = process.argv.slice(2).find((value) => /^\d+$/.test(value))
const RACE_SAMPLES = Number(samplesArg ?? 200)
if (!Number.isSafeInteger(RACE_SAMPLES) || RACE_SAMPLES < 1) throw new Error('Sample count must be positive')

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'B' },
  strategy: { front: 'B', pace: 'A', late: 'B', end: 'C' },
} as const
const umaTemplate: UmaTemplate = {
  id: 'synthetic-trainee', charaId: 'synthetic-trainee-character', name: 'Synthetic Trainee', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0.2, stamina: 0, power: 0.1, guts: 0, wit: 0 }, aptitudes,
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  imageSource: 'https://example.invalid/synthetic.png',
}

const effectProfile = (weight: number): Record<CardEffect, number> => Object.fromEntries(
  CARD_EFFECTS.map((effect) => [effect, weight]),
) as Record<CardEffect, number>
const types = ['speed', 'power', 'stamina', 'wit', 'guts', 'speed'] as const
const skillTemplates: SkillTemplate[] = types.map((_, index) => ({
  id: `synthetic-hint-${index + 1}`, kind: 'white', name: `Synthetic Hint ${index + 1}`, description: '',
  costSp: 100, iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null,
}))
const skills = new Map(skillTemplates.map((skill) => [skill.id, skill]))

function template(index: number, weight: number, type: SupportCardType = types[index]!): SupportCardTemplate {
  return {
    id: `synthetic-card-${index + 1}`, charaId: `synthetic-card-character-${index + 1}`,
    charName: `Synthetic Card ${index + 1}`, title: 'Practice Notes', type,
    jpRelease: '2000-01-01', era: 3, obtain: 'free', starter: false,
    hintSkillIds: [skillTemplates[index]!.id], eventSkillIds: [], effectProfile: effectProfile(weight),
    uniqueEffect: { level: 25, effects: [{ type: 8, value: 999 }] },
    imageSource: 'https://example.invalid/synthetic.png',
  }
}

type Build = 'weak' | 'mid' | 'mature'
const buildState: Record<Build, { level: number; limitBreak: CardSave['limitBreak']; weight: number }> = {
  weak: { level: 1, limitBreak: 0, weight: 0.5 },
  mid: { level: 12, limitBreak: 2, weight: 0.8 },
  mature: { level: 25, limitBreak: 4, weight: 1 },
}

type DeckShape = 'stat' | 'friend' | 'group'

function runTraining(build: Build, shape: DeckShape = 'stat') {
  const state = buildState[build]
  const templates = types.map((type, index) => template(
    index,
    state.weight,
    index === types.length - 1 && shape !== 'stat' ? shape : type,
  ))
  let cards: TrainingCardInput[] = templates.map((item) => ({
    template: item,
    save: { ...createCardSave(item), level: state.level, limitBreak: state.limitBreak },
  }))
  let uma = { ...createUmaSave(umaTemplate), level: 21, scenarioStarted: true }
  const startingStats = { ...uma.stats }
  let turns = 0
  let totalApplied = 0
  while (uma.trainingLevel < MAX_TRAINING_LEVEL && turns < 100) {
    const seed = trainingTurnSeed(10_000 + build.length, uma.templateId, 3, uma.trainingsThisScenario)
    const deal = dealTrainingCards(cards, seed)
    const previews = previewTrainingFacilities(uma, umaTemplate, cards, deal)
    const facility = STATS.reduce((best, candidate) => {
      const total = (value: Facility) => Object.values(previews[value].appliedGains).reduce((sum, gain) => sum + (gain ?? 0), 0)
      return total(candidate) > total(best) ? candidate : best
    }, STATS[0])
    const result = resolveTrainingTurn({ uma, template: umaTemplate, cards, skills, deal, facility })
    totalApplied += Object.values(result.preview.appliedGains).reduce((sum, gain) => sum + (gain ?? 0), 0)
    uma = result.uma
    cards = result.cards.map((card, index) => ({ save: card.card, template: templates[index]! }))
    turns += 1
  }
  const statGain = STATS.reduce((sum, stat) => sum + uma.stats[stat] - startingStats[stat], 0)
  const effects = supportDeckEffectTotals(cards)
  return {
    turns,
    averageGain: totalApplied / turns,
    statGain,
    learnedHints: uma.skillLibrary.filter((unlock) => unlock.origin === 'card').length,
    availableHints: new Set(templates.flatMap((item) => item.hintSkillIds)).size,
    raceBonus: effects.raceBonus,
  }
}

const makeSkill = (
  id: string,
  condition: string,
  kind: RaceSkillEffectKind,
  amount: number,
  duration: number,
  activation: 'guaranteed' | 'wit' = 'wit',
): CompiledRaceSkill => ({
  id, activation, inherited: false,
  groups: [{ precondition: null, condition: parseRaceCondition(condition)!, duration, cooldown: 0, effects: [{ kind, amount }], unsupportedVariables: [], unsupportedEffects: [] }],
})
const recovery = makeSkill('synthetic-recovery', 'hp_per<=70', 'recovery', 0.055, 0, 'guaranteed')
const rivalSkills: readonly CompiledRaceSkill[] = [
  recovery,
  makeSkill('synthetic-rival-middle', 'phase_random==1', 'target-speed', 0.15, 3),
  makeSkill('synthetic-rival-late', 'phase_random==2', 'target-speed', 0.15, 3),
  makeSkill('synthetic-rival-accel', 'phase_random==2', 'acceleration', 0.2, 3),
]
const playerSkills: readonly CompiledRaceSkill[] = [
  ...rivalSkills,
  makeSkill('synthetic-card-middle', 'phase_laterhalf_random==1', 'target-speed', 0.35, 3),
  makeSkill('synthetic-card-current', 'phase_random==2', 'current-speed', 0.25, 3),
  makeSkill('synthetic-card-late', 'phase_laterhalf_random==2', 'target-speed', 0.35, 3),
  makeSkill('synthetic-card-spurt', 'is_lastspurt==1', 'acceleration', 0.3, 3),
]
const strategies: readonly Strategy[] = ['front', 'pace', 'late', 'end']
const allStats = (value: number): Stats => ({ speed: value, stamina: value, power: value, guts: value, wit: value })

function g1WinRate(k: 0 | 9): number {
  const level = k + 1
  const rivals = npcRaceStats(1, 'g1', 'medium', level)
  const player = applyForm(allStats(baselineStatCap(1)), yourForm(level))
  let wins = 0
  for (let sample = 1; sample <= RACE_SAMPLES; sample += 1) {
    const gate = sample % 12
    const runners = Array.from({ length: 12 }, (_, index) => ({
      id: index === gate ? 'synthetic-player' : `synthetic-rival-${index}`,
      label: String(index + 1), stats: index === gate ? player : rivals,
      strategy: index === gate ? 'pace' as const : strategies[index % strategies.length]!,
      aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      gate: index, skills: index === gate ? playerSkills : rivalSkills,
    }))
    if (simulateRace({ course: { distance: 2_400, surface: 'turf' }, seed: 50_000 + k * 1_000 + sample, runners }).results[0]!.runner === gate) wins += 1
  }
  return 100 * wins / RACE_SAMPLES
}

console.log(`Milestone 4 support-deck balance · synthetic fixtures only · ${RACE_SAMPLES} G1 seeds/row`)
console.log('deck/build     TL10 turns  avg applied gain  stat gain  learned/available hints  Race Bonus')
for (const shape of ['stat', 'friend', 'group'] as const) {
  for (const build of ['weak', 'mid', 'mature'] as const) {
    const result = runTraining(build, shape)
    const label = `${shape}/${build}`
    console.log(`${label.padEnd(14)} ${String(result.turns).padStart(10)}  ${result.averageGain.toFixed(1).padStart(16)}  ${String(result.statGain).padStart(9)}  ${`${result.learnedHints}/${result.availableHints}`.padStart(23)}  ${(result.raceBonus * 100).toFixed(1).padStart(9)}%`)
  }
}
const k0 = g1WinRate(0)
const k9 = g1WinRate(9)
console.log(`Sensible medium/Pace mature-skill G1: k=0 ${k0.toFixed(1)}% · k=9 ${k9.toFixed(1)}% (aspirational 35%→65%)`)
console.log(`Verdict: ${k0 >= 30 && k0 <= 40 && k9 >= 55 && k9 <= 75 ? 'target range reached' : 'curve remains a review item; no hidden player bonus applied'}`)
