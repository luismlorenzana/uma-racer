// Small public-action campaign sample; fixed invented stats, no private content or phone-time claims.
import assert from 'node:assert/strict'
import { createBattle, applyBattleAction } from '../../packages/domain/src/minigames/uma-puzzles/battle'
import { battleStateHash, replayBattle } from '../../packages/domain/src/minigames/uma-puzzles/replay'
import { puzzleBotAction, type PuzzleBot } from '../../packages/domain/src/minigames/uma-puzzles/bots'
import type { PuzzleBattleAction } from '../../packages/domain/src/minigames/uma-puzzles/battle-types'
import { PUZZLE_ELEMENTS, type PuzzleElement } from '../../packages/domain/src/minigames/uma-puzzles/types'
import { puzzleChapter } from '../../packages/domain/src/minigames/uma-puzzles/campaign/chapters'
import { resolvePuzzleEncounter } from '../../packages/domain/src/minigames/uma-puzzles/campaign/encounters'
import { syntheticPuzzleCast, syntheticPuzzleEntrants } from '../../packages/domain/src/minigames/uma-puzzles/campaign/fixtures'
import { syntheticPuzzleBattle } from '../../packages/domain/src/minigames/uma-puzzles/battle-fixtures'
import { SCENARIOS } from '../../packages/domain/src/scenarios'
import { PUZZLE_SQUAD_MIXES } from '../../packages/domain/src/minigames/uma-puzzles/campaign/rules'
import { PUZZLE_CAMPAIGN_COMBAT_ENVELOPE } from './puzzles-campaign-envelope'
import { puzzleStats } from '../../packages/domain/src/minigames/uma-puzzles/progression'

export const PUZZLE_CAMPAIGN_SIM_SEEDS = ['campaign-1', 'campaign-2', 'campaign-3', 'campaign-4', 'campaign-5', 'campaign-6', 'campaign-7', 'campaign-8']
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2 }
const counter: Record<PuzzleElement, PuzzleElement> = { fire: 'water', water: 'wood', wood: 'fire', light: 'dark', dark: 'light' }
const scenarios = SCENARIOS.slice(0, 5).map(s => s.id)
// Pick authored nodes rather than fabricating an impossible guardian colour/recipe combination.
const nodes = scenarios.flatMap(id => { const chapter = puzzleChapter(id); return chapter.nodes.map(node => ({ chapter, node })) })
// Rounded invented release reference, informed by catalogue aggregates only; no copied real rows.
function entrants(level: number, elements: readonly PuzzleElement[] = PUZZLE_ELEMENTS) {
  return syntheticPuzzleEntrants(level, elements).map(e => {
    const source = { ...e.source, baseStats: { speed: 110, stamina: 100, power: 110, guts: 110, wit: 110 } }
    return { ...e, source, stats: puzzleStats(source, level) }
  })
}
export function runPuzzleCampaignCombat() {
  const envelope: (string | number)[][] = []
  console.log('Release sample: invented 110/100/110/110/110 stats; eight fixed seeds by kind/colour, four low/high/novice probes; not phone skill estimates.')
  console.log('bot/composition kind colour level/PL clears median-drags median-end-HP median-low-HP Hearts actives')
  for (const kind of ['ordinary', 'guardian', 'champion'] as const) for (const colours of kind === 'ordinary' ? PUZZLE_SQUAD_MIXES : PUZZLE_ELEMENTS.map(e => [e])) {
    const selected = nodes.find(({ node }) => node.kind === kind && node.elements.join('/') === colours.join('/'))!
    assert(selected, `No authored ${kind}/${colours} sample`)
    const { chapter, node } = selected
    const colour = colours[0]!, label = colours.join('/')
    for (const composition of [...['mixed', 'neutral', 'counter', 'low', 'high', 'novice'] as const, ...(kind === 'champion' ? ['no-actives'] as const : [])]) {
      const bot: PuzzleBot = composition === 'novice' ? 'novice' : 'competent'
      const level = Math.max(1, node.level + (composition === 'low' ? -3 : composition === 'high' ? 3 : 0))
      const neutral = kind === 'ordinary' ? colour : colour === 'light' || colour === 'dark' ? 'fire' : colour
      const elements = composition === 'counter' ? Array.from({ length: 5 }, (_, i) => counter[colours[i % colours.length]!]) :
        composition === 'neutral' ? Array<PuzzleElement>(5).fill(neutral) : PUZZLE_ELEMENTS
      const drags: number[] = [], hp: number[] = [], lows: number[] = []; let clears = 0, hearts = 0, actives = 0
      const seeds = ['mixed', 'neutral', 'counter', 'no-actives'].includes(composition) ? PUZZLE_CAMPAIGN_SIM_SEEDS : PUZZLE_CAMPAIGN_SIM_SEEDS.slice(0, 4)
      for (const seed of seeds) {
        const encounter = resolvePuzzleEncounter(chapter, node.id, syntheticPuzzleCast(), colour === 'dark' && kind === 'champion' ? 'late' : null)
        const input = { ...syntheticPuzzleBattle(seed), scenarioId: chapter.scenarioId, kind, encounterLevel: node.level,
          entrants: entrants(level, elements), enemies: encounter.enemies, rewards: encounter.rewards }
        let state = createBattle(input), low = state.hp; const actions: PuzzleBattleAction[] = [], hashes: string[] = []
        while (state.outcome === 'active') {
          // Only the routing policy ignores charged skills; the real reducer/input remain unmodified.
          const view = composition === 'no-actives' ? { ...state, members: state.members.map(m => ({ ...m, charge: 0 })) } : state
          const action = puzzleBotAction(view, bot), step = applyBattleAction(state, action)
          state = step.state; actions.push(action); hashes.push(battleStateHash(state))
          low = Math.min(low, state.hp)
          for (const event of step.events) {
            if (event.type === 'cascade') hearts += event.cascade.groups.filter(g => g.orb === 'heart').length
            if (event.type === 'active') actives++
            if (event.type === 'enemy-intent') low = Math.min(low, event.hpAfter)
          }
        }
        assert.deepEqual(replayBattle(input, actions).hashes.slice(1), hashes)
        clears += Number(state.outcome === 'win'); drags.push(state.turn); hp.push(100 * state.hp / state.maxHp); lows.push(100 * low / state.maxHp)
      }
      const row = [composition, kind, label, node.level, level, seeds.length, clears, median(drags), Math.round(median(hp) * 10), Math.round(median(lows) * 10), hearts, actives]
      envelope.push(row)
      console.log('Measured release row:', JSON.stringify(row))
      console.log(`${composition.padEnd(7)} ${kind.padEnd(8)} ${label.padEnd(16)} ${node.level}/${level} ${(100 * clears / seeds.length).toFixed(1)}% ${median(drags)} ${median(hp).toFixed(1)}% ${median(lows).toFixed(1)}% ${hearts} ${actives}`)
    }
  }
  // A few later-band probes expose fixed-reference scaling/finite-kit gaps without a large Cartesian simulation.
  for (const scenario of [SCENARIOS[4]!, SCENARIOS[13]!]) for (const gap of [-3, 0, 3]) {
    const chapter = puzzleChapter(scenario.id), node = chapter.nodes.find(n => n.localId === 'c-fire')!, level = node.level + gap
    const encounter = resolvePuzzleEncounter(chapter, node.id, syntheticPuzzleCast()), drags: number[] = [], hp: number[] = [], lows: number[] = []
    let clears = 0, hearts = 0, actives = 0
    for (const seed of PUZZLE_CAMPAIGN_SIM_SEEDS.slice(0, 4)) {
      const input = { ...syntheticPuzzleBattle(seed), scenarioId: chapter.scenarioId, kind: node.kind, encounterLevel: node.level,
        entrants: entrants(level), enemies: encounter.enemies, rewards: encounter.rewards }
      let state = createBattle(input), low = state.hp; const actions: PuzzleBattleAction[] = [], hashes: string[] = []
      while (state.outcome === 'active') {
        const action = puzzleBotAction(state, 'competent'), step = applyBattleAction(state, action)
        actions.push(action); state = step.state; hashes.push(battleStateHash(state))
        low = Math.min(low, state.hp)
        for (const event of step.events) {
          if (event.type === 'cascade') hearts += event.cascade.groups.filter(g => g.orb === 'heart').length
          if (event.type === 'active') actives++
          if (event.type === 'enemy-intent') low = Math.min(low, event.hpAfter)
        }
      }
      assert.deepEqual(replayBattle(input, actions).hashes.slice(1), hashes)
      clears += Number(state.outcome === 'win'); drags.push(state.turn); hp.push(100 * state.hp / state.maxHp); lows.push(100 * low / state.maxHp)
    }
    const row = ['scale', node.kind, 'fire', node.level, level, 4, clears, median(drags), Math.round(median(hp) * 10), Math.round(median(lows) * 10), hearts, actives]
    envelope.push(row)
    console.log('Measured later-band row:', JSON.stringify(row))
    console.log(`scale ${scenario.id} level/PL${node.level}/${level}: ${clears}/4 clears, median ${median(drags)} drags / ${median(hp).toFixed(1)}% HP`)
  }
  assert.deepEqual(envelope, PUZZLE_CAMPAIGN_COMBAT_ENVELOPE, 'Campaign combat regression drift; review coefficients/docs/pins/decision')
  console.log('PASS:640 campaign battles, exact kind/colour/PL regression, skill ablation and replay hashes.')
  return envelope
}
