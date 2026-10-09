// @vitest-environment jsdom
// Invented outfits, cast and fight only (D311).
import {
  createBattle, enrollRpgOutfit, learnRpgNode, projectRpgStats, rpgCampaignChapter, rpgFoe,
  type BattleAlly, type BattleStep, type RpgClass, type RpgProfile, type RpgWeapon,
} from '@racer/domain'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import type { RpgAccount, RpgFightView } from '../../game/rpg-local'
import { RpgFightScreen } from './RpgFightScreen'
import { RpgContext, type RpgContextValue } from './RpgScreen'

const local = vi.hoisted(() => ({ readRpgFight: vi.fn(), actRpgFight: vi.fn(), beginRpgFight: vi.fn(), finishRpgFight: vi.fn(), abandonRpgFight: vi.fn() }))
vi.mock('../../game/rpg-local', () => local)
vi.mock('motion/react', async original => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

const STYLE = { brawler: { front: 'A', pace: 'C', late: 'C', end: 'C' }, mage: { front: 'C', pace: 'A', late: 'C', end: 'C' },
  spellblade: { front: 'C', pace: 'A', late: 'C', end: 'C' }, cleric: { front: 'C', pace: 'C', late: 'A', end: 'C' },
  summoner: { front: 'C', pace: 'C', late: 'C', end: 'A' } } as const
function ally(id: string, classId: RpgClass, weapons: RpgWeapon[], nodes: string[]): BattleAlly {
  const p: RpgProfile = nodes.reduce(learnRpgNode, { ...enrollRpgOutfit({ outfit: { id, baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'C' }, strategy: STYLE[classId] } },
  contentVersion: 'test', classId, weapons }), level: 10 })
  const stats = projectRpgStats(p)
  return { id, classId, weapons, tier: 1, level: 10, stats, tree: p.tree, legacy: [], familiar: 'bow', mp: stats.mp,
    loadout: p.tree.filter((r) => !r.id.startsWith('cleric-staff')) }
}
const chapter = rpgCampaignChapter('ura-finale', [{ id: 'cast1', name: 'Rival' }])
const node = chapter.nodes.find((n) => n.kind === 'fight')!
function fight(): RpgFightView {
  const step = createBattle({ version: 5, seed: 1, enemies: [rpgFoe({ id: 'f1', castId: 'cast1', element: 'ice', role: 'striker', rank: 'regular', level: 4,
    shield: 3, weaknesses: { weapons: ['bow'], elements: ['fire'] } })], allies: [
    ally('u1', 'mage', ['mage-staff', 'arcane-staff'], ['mage-staff.fire.1']), ally('u2', 'summoner', ['summoner-tome'], ['summon-elemental.fire.1', 'summon-arcane.angels.1']),
    ally('u3', 'brawler', ['axe', 'bow'], ['axe.ice.1']), ally('u4', 'spellblade', ['short-sword'], ['blade-elemental.fire.1']),
    ally('u5', 'cleric', ['arcane-staff', 'cleric-staff'], ['arcane-staff.light.1']),
  ] })
  for (const u of step.state.units) if (u.id === 'u1' || u.id === 'u2') u.limit = 12
  return { run: { schemaVersion: 2, presetId: 'party-1', chapterId: chapter.id, wins: { start: 1 }, mp: {}, battles: 1, clearedAt: null, updatedAt: 1,
    battle: { battleId: 'rpg-battle:party-1:ura-finale:1', nodeId: node.id, startedAt: 1, input: step.state.input } }, step, actions: [] }
}
async function show() {
  const view = fight()
  local.readRpgFight.mockResolvedValue(view)
  local.actRpgFight.mockImplementation(async (): Promise<BattleStep> => ({ ...view.step, cues: [] }))
  const value: RpgContextValue = { content: { atlases: {}, umas: { byId: new Map() } } as unknown as LoadedContent,
    account: { outfits: new Map(), presets: [], runs: [], tokens: {}, bank: null } as RpgAccount, release: null,
    retryRelease: () => {}, chapters: [chapter], openGuide: () => {} }
  render(<LazyMotion features={domAnimation} strict><MemoryRouter initialEntries={[`/rpg/party/party-1/${chapter.id}/fight`]}><RpgContext.Provider value={value}>
    <Routes><Route path="/rpg/party/:presetId/:chapterId/fight" element={<RpgFightScreen />} /></Routes>
  </RpgContext.Provider></MemoryRouter></LazyMotion>)
  return view
}

describe('fight screen Limit Break (D311)', () => {
  it('badges only the full bars; a Mage picks her fixed Limit Break and taps a foe', async () => {
    await show()
    const badges = await screen.findAllByRole('button', { name: /Limit Break ready/ })
    expect(badges.map((b) => b.getAttribute('aria-label'))).toEqual(['u1: Limit Break ready', 'u2: Limit Break ready'])
    fireEvent.click(badges[0]!)
    const sheet = screen.getByRole('dialog', { name: 'Limit Break' })
    fireEvent.click(within(sheet).getByRole('button', { name: /Prismatic Nova/ }))
    expect(screen.getByText('Tap an enemy: LIMIT BREAK · Prismatic Nova')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^cast1, ice/ }))
    await vi.waitFor(() => expect(local.actRpgFight).toHaveBeenCalledWith('party-1', chapter.id, 'rpg-battle:party-1:ura-finale:1', 0,
      { kind: 'limit', actorId: 'u1', targetId: 'f1' }))
  })

  it('lets a Summoner pick two summons, each summoned twice', async () => {
    await show()
    fireEvent.click((await screen.findAllByRole('button', { name: /Limit Break ready/ }))[1]!)
    const sheet = screen.getByRole('dialog', { name: 'Limit Break' })
    expect(within(sheet).getByText(/0\/2 picked/)).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: /Ember Sprites/ }))
    expect(within(sheet).getByText(/1\/2 picked/)).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: /Cherub/ }))
    expect(screen.queryByRole('dialog', { name: 'Limit Break' })).toBeNull()
    expect(screen.getByText('Tap an enemy: LIMIT BREAK · Ember Sprites + Cherub')).toBeTruthy()
  })
})
