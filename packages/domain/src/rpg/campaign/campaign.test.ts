import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../../scenarios'
import { RPG_ELEMENTS, enrollRpgOutfit, projectRpgStats, type RpgProfile } from '../rules'
import { createBattle } from '../battle/engine'
import { rpgCampaign, rpgCampaignChapter, rpgNodeParents, rpgTierLevel } from './chapters'
import { RPG_BATTLE_TOKENS, rpgBattleBaseExp, rpgBattleExp, rpgLevelExpFactor } from './rewards'
import { createRpgRun, parseRpgRunSave, rpgBeginRunBattle, rpgCarriedMp, rpgChapterCleared, rpgNodeStatus, rpgRestAtCamp,
  rpgSettleRunBattle } from './run'
import { rpgCampaignOutfit, type RpgOutfitSaveV1 } from '../save'

// Invented cast only.
const cast = Array.from({ length: 7 }, (_, i) => ({ id: `cast${i}`, name: `Rival ${i}` }))

describe('generated campaign chapters (D262)', () => {
  it('builds one ten-level chapter per scenario with a reachable map and five elemental champions', () => {
    const chapters = rpgCampaign(cast)
    expect(chapters.map((c) => c.scenarioId)).toEqual(SCENARIOS.map((s) => s.id))
    expect(chapters.map((c) => c.levelStart)).toEqual(SCENARIOS.map((s) => (s.tier - 1) * 10 + 1))
    for (const chapter of chapters) {
      const ids = new Set(chapter.nodes.map((n) => n.id))
      expect(ids.size).toBe(chapter.nodes.length)
      expect(chapter.nodes.every((n) => n.exits.every((e) => ids.has(e)))).toBe(true)
      expect(chapter.nodes.filter((n) => n.id !== 'start').every((n) => rpgNodeParents(chapter, n.id).length > 0)).toBe(true)
      const bosses = chapter.nodes.filter((n) => n.kind === 'boss')
      expect(bosses.map((n) => n.element)).toEqual([...RPG_ELEMENTS])
      expect(bosses.every((n) => n.level === chapter.levelStart + 10 && n.exits.length === 0)).toBe(true)
      expect(chapter.nodes.filter((n) => n.kind === 'sub-boss')).toHaveLength(4)
      expect(chapter.nodes.filter((n) => n.kind === 'fight')).toHaveLength(50)
      expect(chapter.nodes.every((n) => n.col >= 0 && n.col < 5 && n.enemies.length <= 5)).toBe(true)
      for (const n of chapter.nodes.filter((x) => x.kind !== 'camp')) {
        expect(n.enemies.every((e) => e.level === n.level && cast.some((c) => c.id === e.castId))).toBe(true)
      }
    }
  })
  it('is deterministic for a scenario and cast', () => {
    expect(JSON.stringify(rpgCampaignChapter('ura-finale', [...cast].reverse()))).toBe(JSON.stringify(rpgCampaignChapter('ura-finale', cast)))
    expect(rpgTierLevel(51)).toEqual({ tier: 2, level: 1 })
    expect(rpgTierLevel(140)).toEqual({ tier: 3, level: 40 })
  })
})

describe('campaign rewards (D263)', () => {
  it('pays a share of a level, scaled ±10% per level of gap within 10%–200%', () => {
    expect([rpgBattleBaseExp('fight', 5), rpgBattleBaseExp('sub-boss', 5), rpgBattleBaseExp('boss', 5)]).toEqual([28, 90, 160])
    expect([rpgLevelExpFactor(8, 5), rpgLevelExpFactor(5, 8), rpgLevelExpFactor(20, 5), rpgLevelExpFactor(1, 30)]).toEqual([0.7, 1.3, 0.1, 2])
    expect(rpgBattleExp('fight', 5, 8)).toBe(20)
    expect(RPG_BATTLE_TOKENS).toEqual({ fight: { slot: 1, skill: 2 }, 'sub-boss': { slot: 3, skill: 6 }, boss: { slot: 6, skill: 12 } })
  })
})

function member(id: string): RpgProfile {
  return enrollRpgOutfit({ outfit: { id, baseStats: { speed: 110, stamina: 110, power: 110, guts: 110, wit: 110 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: 'G', medium: 'A', long: 'G' }, strategy: { front: 'A', pace: 'G', late: 'G', end: 'G' } } },
  contentVersion: 'test', style: 'front', weapon: 'greatsword', defaultSignature: 'fire' })
}
const party = ['m1', 'm2', 'm3', 'm4', 'm5'].map(member)
const slots = party.map((p) => ({ profile: p, slot: { outfitId: p.outfitId, signature: p.defaultSignature, loadout: [] } }))

describe('campaign runs (D263)', () => {
  const chapter = rpgCampaignChapter('ura-finale', cast)
  it('opens nodes below each clear, replays cleared fights and pays every win', () => {
    let run = createRpgRun('party-1', chapter.id, 1)
    const first = chapter.nodes.find((n) => n.id === 'start')!.exits[0]!
    expect(rpgNodeStatus(chapter, run, first)).toBe('available')
    const below = chapter.nodes.find((n) => n.id === first)!.exits[0]!
    expect(rpgNodeStatus(chapter, run, below)).toBe('locked')
    expect(() => rpgBeginRunBattle(chapter, run, below, slots, 2)).toThrow(/path/)
    run = rpgBeginRunBattle(chapter, run, first, slots, 2)
    expect(parseRpgRunSave(JSON.parse(JSON.stringify(run)))).toEqual(run)
    const won = { ...createBattle(run.battle!.input).state, outcome: 'victory' as const }
    won.units = won.units.map((u) => u.side === 'ally' ? { ...u, mp: 5 } : u)
    const settled = rpgSettleRunBattle(chapter, run, won, party, 3)
    expect(settled.outcome).toBe('win')
    expect(settled.result!.members.every((m) => m.delta > 0)).toBe(true)
    expect(settled.result!.tokens).toEqual({ tier: 1, ...RPG_BATTLE_TOKENS.fight })
    run = settled.run
    expect(rpgNodeStatus(chapter, run, below)).toBe('available')
    expect(rpgCarriedMp(run, party[0]!)).toBe(5)
    run = rpgBeginRunBattle(chapter, run, first, slots, 4)
    expect(run.battle!.input.allies[0]!.mp).toBe(5)
    const lost = rpgSettleRunBattle(chapter, run, { ...createBattle(run.battle!.input).state, outcome: 'loss' }, party, 5)
    expect(lost.result).toBeNull()
    expect(lost.run.wins[first]).toBe(1)
    expect(lost.run.mp).toEqual(run.mp)
    run = rpgRestAtCamp(chapter, lost.run, 'start', 6)
    expect(rpgCarriedMp(run, party[0]!)).toBe(projectRpgStats(party[0]!).mp)
    expect(rpgChapterCleared(chapter, run)).toBe(false)
  })
})

describe('campaign save migration (D263)', () => {
  it('restarts schema-1 outfits at Tier 1 Lv1 once, keeping class and element', () => {
    const old: RpgOutfitSaveV1 = { schemaVersion: 1, projectionRevision: 4,
      profile: { ...member('x'), tier: 2, level: 12, exp: 40, tree: [], legacy: [] } }
    const next = rpgCampaignOutfit(old)
    expect(next).toMatchObject({ schemaVersion: 2, projectionRevision: 5, profile: { tier: 1, level: 1, exp: 0, style: 'front', defaultSignature: 'fire' } })
    expect(rpgCampaignOutfit(next)).toBe(next)
  })
})
