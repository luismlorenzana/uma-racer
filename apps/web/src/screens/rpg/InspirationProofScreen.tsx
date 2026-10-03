// DEV-only read-only display of invented outfits. No account reads/writes or extracted artwork.
import { createUmaSave, type UmaTemplate, type SkillTemplate, type ContentAtlas } from '@racer/domain'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { LoadedContent } from '../../content/runtime'
import { joinUma } from '../../game/view'
import { ConstellationScreen } from '../ConstellationScreen'
import type { TrainingContext } from '../TrainingScene'

const template = (id: string, name: string): UmaTemplate => ({ id, name, charaId: `invented-${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'G' }, strategy: { front: 'A', pace: 'B', late: 'G', end: 'G' } },
  uniqueSkillId: 'invented-unique', awakeningSkillIds: ['invented-white', 'invented-gold', 'invented-white2', 'invented-gold2'],
  realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/invented.png' })
const umas = [template('preview-child', 'Ember'), template('preview-parent-a', 'Beacon'), template('preview-parent-b', 'Dawn'), template('preview-grand', 'Rill')]
const skill = (id: string, kind: SkillTemplate['kind'], name: string): SkillTemplate => ({ id, name, kind, description: 'An invented skill for read-only phone layout checks.', costSp: 120, iconId: null,
  inheritedSkillId: kind === 'unique' ? 'invented-inherited' : null, normalSkillId: null, conditions: [] })
const skills = [skill('invented-unique', 'unique', 'First Dawn'), skill('invented-inherited', 'inherited-unique', 'Inherited Dawn'),
  skill('invented-white', 'white', 'Quiet Step'), skill('invented-white2', 'white', 'Steady Step'), skill('invented-gold', 'gold', 'Azure Step'), skill('invented-gold2', 'gold', 'Golden Horizon')]
const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({ schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [], frames: {} })
const content: LoadedContent = { origin: 'network', manifest: { version: 'invented-inspiration-preview', generatedAt: '', source: {}, files: [] }, sparkRivals: null,
  umas: { items: umas, byId: new Map(umas.map(u => [u.id, u])) }, cards: { items: [], byId: new Map() }, skills: { items: skills, byId: new Map(skills.map(s => [s.id, s])) },
  races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
  atlases: { 'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] }, 'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] } },
  art: { has: () => false, load: async () => null } }

export function InspirationProofScreen() {
  const [mirror, setMirror] = useState(false)
  const [params] = useSearchParams()
  const context = useMemo<TrainingContext>(() => {
    const save = createUmaSave(umas[0]!), run = save.scenarios[0]!
    run.started = true; run.trainingLevel = 8
    run.inspiration = { slots: ['parent0', 'parent1', 'parent0-gp0', ...(mirror ? ['parent1-gp1' as const] : [])], golds: ['parent0:gold0'] }
    run.assignments = { parent0: { kind: 'lineage', templateId: umas[1]!.id }, parent1: { kind: 'lineage', templateId: umas[2]!.id }, 'parent0-gp0': { kind: 'lineage', templateId: umas[3]!.id },
      ...(mirror ? { 'parent1-gp1': { kind: 'lineage' as const, templateId: umas[3]!.id } } : {}) }
    const joined = joinUma(save, content, {})
    if (joined.status !== 'ready') throw new Error('Invalid invented preview')
    return { content, save, uma: joined.value, cards: {}, umas: Object.fromEntries(umas.map(u => [u.id, createUmaSave(u)])), tickets: 0 }
  }, [mirror])
  return <div className="flex h-dvh flex-col bg-page pt-safe">
    <header className="flex items-center justify-between px-4 py-2"><div><p className="text-micro">Invented read-only proof</p><h1 className="text-lg">Ember · Inspiration</h1></div><label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} />Mirror Rill</label></header>
    <ConstellationScreen viewMode="inspiration" preview={context} key={params.get('node') ?? 'preview'} />
  </div>
}
