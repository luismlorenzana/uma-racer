import {
  createUmaSave,
  type ContentAtlas,
  type SupportCardTemplate,
  type UmaTemplate,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { EMPTY_UMA_FILTERS, filterAndSortUmas, joinUma } from './view'
import { buildLineageView } from './lineage-view'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

function template(id: string, name: string, turf: 'A' | 'G' = 'A'): UmaTemplate {
  return {
    id,
    charaId: `chara-${id}`,
    name,
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter: true,
    baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { ...aptitudes, surface: { ...aptitudes.surface, turf } },
    uniqueSkillId: `skill-${id}`,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

function loaded(umas: UmaTemplate[]): LoadedContent {
  const frames = Object.fromEntries(
    umas.map((uma, index) => [uma.id, { page: 0, x: index * 128, y: 0, width: 128 as const, height: 128 as const }]),
  )
  const atlas: ContentAtlas = {
    schemaVersion: 1,
    kind: 'uma-icons',
    frameWidth: 128,
    frameHeight: 128,
    pages: [{ path: 'synthetic.webp', width: Math.max(128, umas.length * 128), height: 128 }],
    frames,
  }
  const emptyCards: SupportCardTemplate[] = []
  return {
    manifest: { version: 'abc123def456', generatedAt: '2000-01-01T00:00:00Z', source: {}, files: [] },
    origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((uma) => [uma.id, uma])) },
    cards: { items: emptyCards, byId: new Map() },
    skills: { items: [], byId: new Map() },
    races: { items: [], byId: new Map() },
    courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas, pageUrls: ['blob:synthetic-umas'] },
      'card-icons': {
        descriptor: { ...atlas, kind: 'card-icons', frames: { synthetic: atlas.frames[umas[0]?.id ?? '']! } },
        pageUrls: ['blob:synthetic-cards'],
      },
    },
  }
}

describe('Uma view models', () => {
  it('builds a finite frozen lineage with missing-content fallbacks', () => {
    const childTemplate = template('child', 'Synthetic Child')
    const parentTemplate = template('parent', 'Synthetic Parent')
    const content = loaded([childTemplate, parentTemplate])
    const parent = {
      umaId: 'parent', charaId: 'chara-parent', completedTier: 2, takenAt: 20, inheritedUniqueSkillId: 'gene-parent',
      inheritableWhiteSkillIds: ['white-parent'], aptitudes, parents: [{
        umaId: 'missing-grand', charaId: 'chara-grand', completedTier: 1, takenAt: 10, inheritedUniqueSkillId: null,
        inheritableWhiteSkillIds: [], aptitudes,
      }],
    }
    const save = { ...createUmaSave(childTemplate), currentParents: [parent], parentSnapshot: { ...parent, umaId: 'child', charaId: 'chara-child' } }
    const view = buildLineageView(save, content)
    expect(view.activeParents[0]).toMatchObject({ name: 'Synthetic Parent', completedTier: 2, whiteCount: 1 })
    expect(view.activeParents[0]?.grandparents[0]).toMatchObject({ name: 'Missing content · missing-grand', missingContent: true, grandparents: [] })
    expect(view.latestSnapshot).toMatchObject({ name: 'Synthetic Child', grandparents: [{ umaId: 'missing-grand' }] })
  })

  it('derives scenario caps, readiness, and the managed atlas frame', () => {
    const content = loaded([template('u1', 'Synthetic One')])
    const save = { ...createUmaSave(content.umas.items[0]!), scenarioStarted: true, level: 10, exp: 0 }
    const joined = joinUma(save, content)
    expect(joined.status).toBe('ready')
    if (joined.status !== 'ready') return
    expect(joined.value).toMatchObject({ tier: 1, currentStatCap: 960, baselineStatCap: 1200, currentSpCap: 240, readyToPromote: true })
    expect(joined.value.asset?.url).toBe('blob:synthetic-umas')
    const max = joinUma({ ...save, level: 110 }, content)
    expect(max.status === 'ready' && max.value.readyToPromote).toBe(false)
  })

  it('reports missing content instead of throwing', () => {
    const save = createUmaSave(template('missing', 'Synthetic Missing'))
    expect(joinUma(save, loaded([]))).toEqual({ status: 'missing-content', templateId: 'missing' })
  })

  it('filters A/S aptitude categories and sorts with stable id tie-breaks', () => {
    const templates = [template('u2', 'Beta', 'G'), template('u1', 'Alpha')]
    const content = loaded(templates)
    const views = templates.map((item, index) => {
      const joined = joinUma({ ...createUmaSave(item), level: index + 1 }, content)
      if (joined.status !== 'ready') throw new Error('Synthetic join failed')
      return joined.value
    })
    expect(filterAndSortUmas(views, EMPTY_UMA_FILTERS, 'name').map((item) => item.save.templateId)).toEqual(['u1', 'u2'])
    expect(filterAndSortUmas(views, { ...EMPTY_UMA_FILTERS, surface: 'turf' }, 'name').map((item) => item.save.templateId)).toEqual(['u1'])
    expect(filterAndSortUmas(views, EMPTY_UMA_FILTERS, 'uma-level').map((item) => item.save.templateId)).toEqual(['u1', 'u2'])
  })
})
