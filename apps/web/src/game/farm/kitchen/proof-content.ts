// Invented, tiny phone/integration fixture. Never original-game content or owner-account data.
import { DISTANCE_CATEGORIES, createCardSave, createUmaSave, type ContentAtlas, type CourseTemplate, type RaceTemplate, type UmaTemplate, type SupportCardTemplate, type UmaSave } from '@racer/domain'
import type { LoadedContent } from '../../../content/runtime'

export function farmProofContent(): LoadedContent {
  const umas: UmaTemplate[] = Array.from({ length: 12 }, (_, i) => ({ id: `invented-${i}`, charaId: `invented-character-${i}`,
    name: ['Aster', 'Birch', 'Clover', 'Dahlia', 'Elm', 'Fern', 'Ginger', 'Hazel', 'Iris', 'Juniper', 'Kestrel', 'Lilac'][i]!, outfit: 'Proof Outfit',
    jpRelease: '2000-01-01', globalRelease: null, starter: true, baseStats: { speed: 1195, stamina: 650, power: 600, guts: 500, wit: 550 },
    growthRates: { speed: 0.1, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { surface: { turf: 'A', dirt: 'A' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
      strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } }, uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null,
    signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/invented.png' }))
  const races: RaceTemplate[] = DISTANCE_CATEGORIES.map((distanceCategory, i) => ({ id: `invented-race-${distanceCategory}`, familyId: `invented-${i}`,
    name: `Invented ${distanceCategory} trial`, grade: 'g1', surface: 'turf', distance: [1200, 1600, 2000, 3000][i]!, distanceCategory,
    direction: 'left', venue: 'Invented track', venueKey: 'invented-track', venueTags: [], series: [], seriesLegs: [], courseId: `invented-course-${i}`, season: 1, fieldSize: 8 }))
  const courses: CourseTemplate[] = races.map((race, i) => ({ id: race.courseId, trackId: 'invented-track', distance: i + 1, terrain: 1, turn: 1,
    corners: [{ start: race.distance * 0.25, end: race.distance * 0.5, number: 1 }], slopes: [],
    straights: [{ start: 0, end: race.distance * 0.25, frontType: 1 }, { start: race.distance * 0.5, end: race.distance, frontType: 2 }] }))
  const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({ schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [], frames: {} })
  const support: SupportCardTemplate = { id: 'invented-support', charaId: 'invented-support-character', charName: 'Invented mentor', title: 'Practice day',
    type: 'friend', jpRelease: '2000-01-01', era: 1, obtain: 'free', starter: true, hintSkillIds: [], eventSkillIds: [],
    effectProfile: { trainingBonus: 0, friendshipBonus: 0, statBonus: 0, skillPointBonus: 0, specialtyPriority: 0, hintFrequency: 0, raceBonus: 0, initialStats: 0 },
    uniqueEffect: null, imageSource: 'https://invalid.test/invented-support.png' }
  return { origin: 'network', manifest: { version: 'invented-farm-proof', generatedAt: '', source: {}, files: [] }, sparkRivals: null,
    umas: { items: umas, byId: new Map(umas.map(u => [u.id, u])) }, cards: { items: [support], byId: new Map([[support.id, support]]) }, skills: { items: [], byId: new Map() },
    races: { items: races, byId: new Map(races.map(r => [r.id, r])) }, courses: { items: courses, byId: new Map(courses.map(c => [c.id, c])) },
    atlases: { 'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] }, 'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] } },
    art: { has: () => false, load: async () => null } }
}
export function farmProofCards() {
  const card = farmProofContent().cards.items[0]!
  return { [card.id]: createCardSave(card) }
}
export function farmProofUma(id = 'invented-0'): UmaSave {
  const content = farmProofContent(), uma = createUmaSave(content.umas.byId.get(id)!)
  uma.activePreset = 'sprint'
  for (const run of uma.scenarios) {
    run.started = true
    for (const d of DISTANCE_CATEGORIES) run.presets[d].cardSetIds = ['invented-support']
  }
  return uma
}
