import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../../scenarios'
import { RPG_ELEMENTS, enrollRpgOutfit, projectRpgStats, type RpgProfile } from '../rules'
import { createBattle } from '../battle/engine'
import { battleWeakness } from '../battle/skills'
import { rpgCampaign, rpgCampaignChapter, rpgChapterReach, rpgNodeParents, rpgTierLevel } from './chapters'
import { RPG_FINALS } from './finals'
import { RPG_BATTLE_TOKENS, rpgBattleBaseExp, rpgBattleExp, rpgLevelExpFactor, rpgRewardKind } from './rewards'
import { createRpgRun, parseRpgRunSave, rpgBeginRunBattle, rpgCarriedMp, rpgCarryFinals, rpgChapterCleared, rpgNodeStatus, rpgRestAtCamp,
  rpgSettleRunBattle } from './run'

// Invented cast only.
const cast = Array.from({ length: 7 }, (_, i) => ({ id: `cast${i}`, name: `Rival ${i}` }))

describe('generated campaign chapters (D262)', () => {
  it('builds one twelve-level chapter per scenario: three fight stages, then three authored Finals routes (D266, D312)', () => {
    const chapters = rpgCampaign(cast)
    expect(chapters.map((c) => c.scenarioId)).toEqual(SCENARIOS.map((s) => s.id))
    expect(chapters.map((c) => c.levelStart)).toEqual(SCENARIOS.map((s) => (s.tier - 1) * 12 + 1))
    for (const chapter of chapters) {
      const ids = new Set(chapter.nodes.map((n) => n.id))
      expect(ids.size).toBe(chapter.nodes.length)
      expect(chapter.nodes.every((n) => n.exits.every((e) => ids.has(e)))).toBe(true)
      expect(chapter.nodes.filter((n) => n.id !== 'start').every((n) => rpgNodeParents(chapter, n.id).length > 0)).toBe(true)
      const finals = RPG_FINALS[chapter.scenarioId]!
      const bosses = chapter.nodes.filter((n) => n.kind === 'boss')
      expect(bosses.map((n) => n.id)).toEqual(['route1-boss', 'route2-boss', 'route3-boss'])
      expect(bosses.map((n) => n.element)).toEqual(finals.routes.map((r) => r.champion.element))
      expect(bosses.every((n) => n.level === chapter.levelStart + 11 && n.exits.length === 0)).toBe(true)
      const subs = chapter.nodes.filter((n) => n.kind === 'sub-boss')
      expect(subs.map((n) => n.level - chapter.levelStart)).toEqual([2, 5, 8, 10, 10, 10])
      expect(bosses.every((n, i) => rpgNodeParents(chapter, n.id).join() === `route${i + 1}-sub`)).toBe(true)
      expect(rpgNodeParents(chapter, 'route2-sub')).toEqual(['final-camp'])
      // Authored escorts and lines (D312): the champion and vanguard lead, then their two escorts as written.
      finals.routes.forEach((route, i) => {
        for (const [id, foe] of [[`route${i + 1}-sub`, route.vanguard], [`route${i + 1}-boss`, route.champion]] as const) {
          const node = chapter.nodes.find((n) => n.id === id)!
          expect(node.enemies.map((e) => e.element)).toEqual([foe.element, ...foe.escorts.map((x) => x[1])])
          expect(node.note).toBe(route.line)
          expect(node.name.startsWith(route.name)).toBe(true)
        }
      })
      const fights = chapter.nodes.filter((n) => n.kind === 'fight')
      // D286: each stage is a row of three fights at its first level and three at its second.
      expect(fights).toHaveLength(18)
      expect(fights.map((n) => n.level - chapter.levelStart)).toEqual([0, 0, 0, 1, 1, 1, 3, 3, 3, 4, 4, 4, 6, 6, 6, 7, 7, 7])
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
    expect([rpgBattleBaseExp('fight', 5), rpgBattleBaseExp('sub-boss', 5), rpgBattleBaseExp('vanguard', 5), rpgBattleBaseExp('boss', 5)])
      .toEqual([84, 56, 94, 106])
    expect([rpgLevelExpFactor(8, 5), rpgLevelExpFactor(5, 8), rpgLevelExpFactor(20, 5), rpgLevelExpFactor(1, 30)]).toEqual([0.7, 1.3, 0.1, 2])
    expect(rpgBattleExp('fight', 5, 8)).toBe(59)
    expect(RPG_BATTLE_TOKENS).toEqual({ fight: { slot: 2, skill: 4 }, 'sub-boss': { slot: 4, skill: 8 }, vanguard: { slot: 7, skill: 14 },
      boss: { slot: 10, skill: 20 } })
    // A full clear: 18 fights, 3 stage sub-bosses, 3 vanguards, 3 champions → 99 Slot and 198 Skill tokens (D312; 98 + 196
    // with five routes), at least six units' 6 + 12.
    const chapter = rpgCampaignChapter('ura-finale', cast)
    const total = chapter.nodes.filter((n) => n.kind !== 'camp').reduce((sum, n) => {
      const t = RPG_BATTLE_TOKENS[rpgRewardKind(n)]
      return { slot: sum.slot + t.slot, skill: sum.skill + t.skill }
    }, { slot: 0, skill: 0 })
    expect(total).toEqual({ slot: 99, skill: 198 })
    expect(chapter.nodes.filter((n) => n.kind === 'sub-boss').map(rpgRewardKind)).toEqual(['sub-boss', 'sub-boss', 'sub-boss', 'vanguard', 'vanguard', 'vanguard'])
  })
})

function member(id: string): RpgProfile {
  return enrollRpgOutfit({ outfit: { id, baseStats: { speed: 110, stamina: 110, power: 110, guts: 110, wit: 110 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: 'G', medium: 'A', long: 'G' }, strategy: { front: 'A', pace: 'G', late: 'G', end: 'G' } } },
  contentVersion: 'test', classId: 'brawler', weapons: ['greatsword', 'spear'] })
}
const party = ['m1', 'm2', 'm3', 'm4', 'm5'].map(member)
const slots = party.map((p) => ({ profile: p, slot: { outfitId: p.outfitId, loadout: [], familiar: 'greatsword' as const } }))

describe('foe weaknesses (D279)', () => {
  it('shows more weaknesses on weaker foes and bigger shields on stronger ones, never its own element', () => {
    const chapter = rpgCampaignChapter('ura-finale', cast)
    const foes = chapter.nodes.flatMap((n) => n.enemies)
    const counts = (rank: string) => new Set(foes.filter((f) => f.rank === rank).map((f) => `${f.weaknesses.weapons.length}+${f.weaknesses.elements.length}`))
    expect([...counts('regular')].sort()).toEqual(['2+3', '3+2'])
    expect([...counts('sub-boss')]).toEqual(['2+2'])
    expect([...counts('boss')].sort()).toEqual(['1+2', '2+1'])
    expect(foes.every((f) => !f.weaknesses.elements.includes(f.element) && f.weaknesses.elements[0] === battleWeakness(f.element))).toBe(true)
    expect(new Set(foes.filter((f) => f.rank === 'boss').map((f) => f.shield))).toEqual(new Set([8]))
    expect(new Set(foes.filter((f) => f.rank === 'sub-boss').map((f) => f.shield))).toEqual(new Set([6]))
    expect(new Set(foes.filter((f) => f.rank === 'regular').map((f) => f.shield))).toEqual(new Set([2, 3]))
    // Boss HP follows the skill depth open at the chapter's start: URA ×1, Unity Cup ×2.2 / 1.6.
    expect([rpgChapterReach(1), rpgChapterReach(13), rpgChapterReach(25), rpgChapterReach(61)]).toEqual([1, 1.375, 2.9 / 1.6, 1.375])
  })
})

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

describe('authored Finals (D312)', () => {
  it('gives every scenario three named routes with three different champions, escorts and a line', () => {
    expect(Object.keys(RPG_FINALS)).toEqual(SCENARIOS.map((s) => s.id))
    const champions = new Map<string, number>()
    for (const finals of Object.values(RPG_FINALS)) {
      expect(finals.routes).toHaveLength(3)
      expect(new Set(finals.routes.map((r) => r.champion.element)).size).toBe(3)
      expect(new Set(finals.routes.map((r) => r.name)).size).toBe(3)
      for (const r of finals.routes) {
        champions.set(r.champion.element, (champions.get(r.champion.element) ?? 0) + 1)
        expect(r.line.length).toBeLessThanOrEqual(70)
      }
    }
    // Each element leads seven to ten of the forty-two routes.
    expect([...champions.values()].every((n) => n >= 7 && n <= 10)).toBe(true)
    expect(champions.size).toBe(RPG_ELEMENTS.length)
  })
  it('carries wins on the five retired routes onto the three by count, paying nothing new', () => {
    const run = { ...createRpgRun('party-1', 'unity-cup', 1), wins: { start: 1, a1boss: 2, 'fire-sub': 1, 'fire-boss': 3, 'ice-sub': 1, 'dark-sub': 1 } }
    expect(rpgCarryFinals(run).wins).toEqual({ start: 1, a1boss: 2, 'route1-sub': 1, 'route1-boss': 1, 'route2-sub': 1, 'route3-sub': 1 })
    expect(parseRpgRunSave(run)!.wins).toEqual(rpgCarryFinals(run).wins)
    const five = { ...run, wins: Object.fromEntries(RPG_ELEMENTS.flatMap((e) => [[`${e}-sub`, 1], [`${e}-boss`, 1]])) }
    expect(Object.keys(rpgCarryFinals(five).wins).sort()).toEqual(['route1-boss', 'route1-sub', 'route2-boss', 'route2-sub', 'route3-boss', 'route3-sub'])
    expect(rpgCarryFinals(rpgCarryFinals(run))).toEqual(rpgCarryFinals(run))
    const chapter = rpgCampaignChapter('unity-cup', cast)
    expect(rpgChapterCleared(chapter, parseRpgRunSave(run))).toBe(true)
  })
  it('settles a fight left open on a retired Finals route as a vanguard or champion', () => {
    const chapter = rpgCampaignChapter('ura-finale', cast)
    const open = rpgBeginRunBattle(chapter, { ...createRpgRun('party-1', chapter.id, 1), wins: { start: 1, 'route1-sub': 1 } }, 'route1-boss', slots, 2)
    const run = { ...open, battle: { ...open.battle!, nodeId: 'ice-boss' } }
    const won = { ...createBattle(run.battle.input).state, outcome: 'victory' as const }
    const settled = rpgSettleRunBattle(chapter, run, won, party, 3)
    expect(settled.result).toMatchObject({ nodeId: 'ice-boss', tokens: { tier: 1, ...RPG_BATTLE_TOKENS.boss } })
    expect(settled.result!.members[0]!.delta).toBe(rpgBattleExp('boss', 12, 1))
    expect(parseRpgRunSave(settled.run)!.wins).toMatchObject({ 'route1-sub': 1, 'route1-boss': 1 })
  })
})

describe('campaign save migration (D265, D282)', () => {
  it('drops a fight left open under an older engine; the run and its MP stay', () => {
    const run = { ...createRpgRun('party-1', 'ura-finale', 1), mp: { m1: 4 }, battles: 1,
      battle: { battleId: 'rpg-battle:party-1:ura-finale:1', nodeId: 'a1r1c1', startedAt: 1, input: { version: 3, seed: 1 } } }
    expect(parseRpgRunSave(run)).toMatchObject({ battle: null, mp: { m1: 4 }, battles: 1 })
  })
  it('settles a fight opened on a row the six-fight stages retired as a regular fight (D286)', () => {
    const chapter = rpgCampaignChapter('ura-finale', cast)
    const open = rpgBeginRunBattle(chapter, createRpgRun('party-1', chapter.id, 1), 'a1r1c1', slots, 2)
    const run = { ...open, battle: { ...open.battle!, nodeId: 'a1r4c1' } }
    const won = { ...createBattle(run.battle.input).state, outcome: 'victory' as const }
    const settled = rpgSettleRunBattle(chapter, run, won, party, 3)
    expect(settled.result).toMatchObject({ nodeId: 'a1r4c1', tokens: { tier: 1, ...RPG_BATTLE_TOKENS.fight } })
    expect(settled.result!.members[0]!.delta).toBe(rpgBattleExp('fight', 1, 1))
    expect(rpgNodeStatus(chapter, settled.run, 'a1r1c1')).toBe('available')
  })
})
