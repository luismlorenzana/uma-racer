// The game's interpretation, not a second master-data importer (SE1; uma-platform/docs/racer-mapping.md).
import type { MasterData, Skill, SupportCard } from '@luismlorenzana/uma-data'
import { sourceCardEffect, type CardEffect } from '../cards'
import type { CourseTemplate, RaceDirection, RaceTemplate, SkillKind, SkillTemplate, SupportCardObtain, SupportCardTemplate, UmaTemplate } from '../content'
import { distanceCategory } from '../types'
import { eraOf, SCENARIOS } from '../scenarios'
import { applyCardFocusOverride } from './card-focus'
import { applyFlairOverride } from './flair'
import type { RacerOverlays } from './overlays'

export interface RacerContent { umas: UmaTemplate[]; cards: SupportCardTemplate[]; skills: SkillTemplate[]; races: RaceTemplate[]; courses: CourseTemplate[] }
export interface AdaptedMaster { content: RacerContent; warnings: string[]; scenarioIds: ReadonlyMap<string, string> }
const EFFECTS: readonly CardEffect[] = ['trainingBonus', 'friendshipBonus', 'statBonus', 'skillPointBonus', 'specialtyPriority', 'hintFrequency', 'raceBonus', 'initialStats']
// Keep the racer's existing catalogue. Platform also names international tracks, which are not regular racer races.
const RACER_TRACKS = new Set([10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010, 10101, 10103, 10104, 10105, 10201])
const GRADES = { 100: 'g1', 200: 'g2', 300: 'g3', 400: 'op', 700: 'pre-op' } as const
const KINDS: Record<number, SkillKind> = { 1: 'white', 2: 'gold', 3: 'unique-upgraded', 4: 'inherited-unique', 5: 'unique' }
const ids = (values: readonly number[]): string[] => [...new Set(values)].map(String)
const terms: Record<string, string> = { Runner: 'Front Runner', Leader: 'Pace Chaser', Betweener: 'Late Surger', Chaser: 'End Closer' }
export const toGlobalTerms = (value: string): string => value.replace(/\bFront Runner\b|\bPace Chaser\b|\bLate Surger\b|\bEnd Closer\b|\bRunner\b|\bLeader\b|\bBetweener\b|\bChaser\b/g, (term) => terms[term] ?? term)
const text = (value: { global: string | null; en: string | null; ja: string }): string => value.global || value.en || value.ja

export function masterSkills(source: readonly Skill[]): SkillTemplate[] {
  const top = source.filter((skill) => skill.rarity !== 6 && skill.parentSkillIds.length === 0 && KINDS[skill.rarity] !== undefined)
  const retained = new Set(top.map((skill) => skill.id))
  // Gene rarity is not the parent rarity: the old racer retained a gene even when its own source rarity is 6.
  const keep = source.filter((skill) => skill.parentSkillIds.length > 0 ? skill.parentSkillIds.some((id) => retained.has(id)) : retained.has(skill.id))
  const byId = new Map(keep.map((skill) => [skill.id, skill]))
  return keep.map((skill): SkillTemplate => {
    const inherited = skill.parentSkillIds.length > 0
    const kind = inherited ? 'inherited-unique' : KINDS[skill.rarity]!
    const name = text(skill.name)
    const normal = kind === 'gold' ? skill.versionIds.find((id) => byId.get(id)?.rarity === 1 && byId.get(id)?.parentSkillIds.length === 0)
      : kind === 'white' && name.endsWith('◎') ? skill.versionIds.find((id) => {
        const other = byId.get(id)
        return other?.rarity === 1 && text(other.name) === `${name.slice(0, -1)}○`
      }) : undefined
    return {
      id: String(skill.id), kind, name, description: toGlobalTerms(text(skill.description)), costSp: skill.costSp,
      iconId: inherited ? skill.globalIconId ?? skill.iconId : skill.iconId, activation: skill.activation,
      conditions: (skill.globalConditionGroups ?? skill.conditionGroups).map((group) => ({
        precondition: group.precondition, condition: group.condition, baseTime: group.baseTime, cooldown: group.cooldown,
        effects: group.effects.map(({ type, value, target }) => ({ type, value, ...(target === null ? {} : { target }) })),
      })),
      inheritedSkillId: inherited || skill.inheritedSkillId === null ? null : String(skill.inheritedSkillId),
      normalSkillId: normal === undefined ? null : String(normal),
    }
  })
}

function effects(card: SupportCard): Partial<Record<CardEffect, number>> {
  const values: Partial<Record<CardEffect, number>> = {}
  for (const row of card.effects) {
    const effect = sourceCardEffect(row.type, card.type)
    const present = row.values.filter((value): value is number => value !== null && value !== -1)
    if (effect !== null && present.length) values[effect] = Math.max(values[effect] ?? -Infinity, ...present)
  }
  return values
}

function masterCards(source: readonly SupportCard[]): SupportCardTemplate[] {
  const cards = source.filter((card) => card.rarity === 3)
  const values = cards.map(effects)
  const medians = Object.fromEntries(EFFECTS.map((effect) => {
    const sorted = values.flatMap((value) => value[effect] === undefined ? [] : [value[effect]!]).sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return [effect, sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2]
  })) as Record<CardEffect, number>
  return cards.map((card, index) => {
    const obtain: SupportCardObtain = card.obtain === 'gacha' ? 'gacha' : card.obtain === 'story_event' ? 'event'
      : ['promo', 'limited_quest', 'shop'].includes(card.obtain) ? 'free' : 'unknown'
    return {
      id: String(card.id), charaId: String(card.characterId), charName: card.characterName.en ?? '', title: card.title.en ?? '',
      type: card.type, jpRelease: card.release.jp, era: eraOf(card.release.jp), obtain, starter: obtain === 'event' || obtain === 'free',
      hintSkillIds: ids(card.hints.skillIds), eventSkillIds: ids(card.globalEventSkillIds ?? card.eventSkillIds),
      effectProfile: Object.fromEntries(EFFECTS.map((effect) => [effect, values[index]![effect] === undefined || medians[effect] === 0 ? 0
        : Math.round(Math.min(1.5, Math.max(0.5, values[index]![effect]! / medians[effect])) * 100) / 100])) as Record<CardEffect, number>,
      uniqueEffect: card.uniqueEffect === null ? null : { level: card.uniqueEffect.level, effects: card.uniqueEffect.effects.map(({ type, value }) => ({ type, value })) },
    }
  })
}

export function adaptMaster(data: MasterData, overlay: RacerOverlays | null = null): AdaptedMaster {
  const tracks = new Map(data.tracks.filter((track) => RACER_TRACKS.has(track.id) && track.name !== null).map((track) => [track.id, track]))
  const courses: CourseTemplate[] = data.courses.filter((course) => tracks.has(course.trackId)).map((course) => ({
    id: String(course.id), trackId: String(course.trackId), distance: course.distanceCategory, terrain: course.terrain,
    turn: course.turn, corners: course.corners.map((corner) => ({ ...corner })), straights: course.straights.map((straight) => ({ ...straight })), slopes: course.slopes.map((slope) => ({ ...slope })),
  }))
  const races: RaceTemplate[] = data.races.flatMap((race) => {
    const grade = GRADES[race.grade as keyof typeof GRADES]
    const track = tracks.get(race.trackId)
    const surface = race.terrain === 1 ? 'turf' : race.terrain === 2 ? 'dirt' : null
    const direction: RaceDirection | null = race.direction === 1 ? 'right' : race.direction === 2 ? 'left' : race.direction === 4 ? 'straight' : null
    if (grade === undefined || track === undefined || surface === null || direction === null || !race.name.en) return []
    return [{ id: String(race.id), familyId: String(race.familyId), name: race.name.en, grade, surface, distance: race.distance,
      distanceCategory: distanceCategory(race.distance), direction, venue: track.name!, venueKey: String(track.id), venueTags: [],
      series: [], seriesLegs: [], courseId: String(race.courseId), season: race.season, fieldSize: Math.min(race.entries, 18) }]
  })
  const families = new Set(races.map((race) => race.familyId))
  const objectives = new Map(data.objectives.map((row) => [row.characterId, [...new Set([...row.objectives].sort((a, b) => a.order - b.order)
    .flatMap((goal) => goal.races.map((race) => String(race.familyId))).filter((id) => families.has(id)))]]))
  const characters = new Map(data.characters.map((character) => [character.id, character]))
  const umas: UmaTemplate[] = data.outfits.flatMap((outfit) => {
    const character = characters.get(outfit.characterId)
    if (character === undefined) return []
    return [{ id: String(outfit.id), charaId: String(outfit.characterId), name: character.name.en ?? character.name.ja,
      outfit: outfit.title.global ?? outfit.title.en, jpRelease: outfit.release.jp, globalRelease: outfit.release.global,
      starter: outfit.release.jp === '2021-02-24', baseStats: { ...outfit.stats.star5 },
      growthRates: Object.fromEntries(Object.entries(outfit.growthRatePercents).map(([key, value]) => [key, value * 0.01])) as UmaTemplate['growthRates'],
      aptitudes: { surface: { ...outfit.aptitudes.surface }, distance: { ...outfit.aptitudes.distance }, strategy: { ...outfit.aptitudes.strategy } },
      uniqueSkillId: outfit.skills.unique[0] === undefined ? null : String(outfit.skills.unique[0]),
      awakeningSkillIds: ids(outfit.skills.globalAwakening ?? outfit.skills.awakening), innateSkillIds: ids(outfit.skills.innate), eventSkillIds: ids(outfit.skills.event),
      realHorseSex: character.realHorseSex, signatureRaceFamilyIds: [...(objectives.get(outfit.characterId) ?? [])] }]
  })
  const skills = masterSkills(data.skills)
  const flair = applyFlairOverride(races, overlay?.flair ?? null)
  const cards = applyCardFocusOverride(masterCards(data.supportCards), skills, overlay?.cardFocus ?? null)
  const scenarioIds = new Map<string, string>()
  for (const source of data.scenarios) {
    const scenario = SCENARIOS.find((scenario) => scenario.jpRelease === source.startsAt.jp.slice(0, 10))
    if (scenario !== undefined) scenarioIds.set(String(source.id), scenario.id)
  }
  return { content: { umas, cards: cards.items, skills, races: flair.items, courses }, warnings: [...flair.warnings, ...cards.warnings], scenarioIds }
}

/** Aggregate-only freshness signal. Caller supplies the date; this pure adapter never reads the clock. */
export function scenarioCoverage(data: Pick<MasterData, 'scenarios'>, today: string): string | null {
  const source = data.scenarios.filter((scenario) => scenario.startsAt.jp.slice(0, 10) <= today)
  const modeled = SCENARIOS.filter((scenario) => scenario.jpRelease <= today)
  return source.length > modeled.length ? `Scenario ladder is behind: ${source.length} released, ${modeled.length} modeled` : null
}
