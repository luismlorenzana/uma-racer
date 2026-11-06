// The career screens' fixtures (T158, D387): the domain's invented career content (Umas with aptitudes, races of every
// surface, distance, grade and season with their courses, skills and the invented cards) as an operation env with the
// device's own race engine, an account that owns them, her career started through `start-career`, and a season's play
// journalled by the domain's competent bot to one move from its end, so a test plays the last move through the host.
// Invented values only.
import { pickDecks, syntheticCards } from '@racer/domain/build'
import { finaleRace, seasonStages, syntheticCareerUmas, syntheticCourses, syntheticRaces, syntheticSkills } from '@racer/domain/career'
import { buildOperationEnv, careerId, commitOperation, initialSave, type OperationEnv, type SaveState } from '@racer/domain/save'
import {
  FURLONG_MOVE, FURLONG_RULES, playBot, YARD_PLACEMENTS, YARD_RULES, type Journal, type StageInput, type StageKind,
} from '@racer/domain/stages'
import { MEMORY_AT, memoryGame, type MemoryGame } from '../../../__fixtures__/memory'
import { RACE_ENGINE } from '../../../save/env'
import { stageConfigFor } from '../../../stages/session'

const CARDS = syntheticCards()

/** The invented career content with the device's race engine: careers race for real. */
export const CAREER_ENV: OperationEnv = buildOperationEnv({
  umas: syntheticCareerUmas(), races: syntheticRaces(), courses: syntheticCourses(), cards: CARDS, skills: syntheticSkills(),
  contentVersion: 'career-test', race: RACE_ENGINE,
})

export const UMA = 'sim-uma-0'
export const CAREER = careerId(UMA, 1)
/** The strongest invented card of each stat type and one more: the deck the walk-through builds. */
export const STRONG_DECK = pickDecks(CARDS, 1).strong.map((card) => card.id)

/** An account owning three invented Umas and every invented card, with no career yet. */
export function accountState(): SaveState {
  const base = initialSave(MEMORY_AT).state
  return {
    ...base,
    umas: Object.fromEntries(['sim-uma-0', 'sim-uma-1', 'sim-uma-2'].map((id, n) => [id, { unlockedAt: MEMORY_AT + n }])),
    cards: Object.fromEntries(CARDS.map((card) => [card.id, { unlockedAt: MEMORY_AT }])),
  }
}

let made = 0
/** `state` after one operation, applied through the domain's own commit; throws on a refusal. */
export function applied(state: SaveState, name: string, input: unknown): SaveState {
  const commit = commitOperation(state, { id: `fixture-${String((made += 1)).padStart(5, '0')}`, name, input, at: MEMORY_AT }, CAREER_ENV)
  if (commit.status === 'refused') throw new Error(commit.refusal.reason)
  return commit.state
}

/** Her career started, with `deck` set when given. */
export function startedState(deck: readonly string[] = []): SaveState {
  let state = applied(accountState(), 'start-career', { umaId: UMA, T: 1 })
  if (deck.length > 0) state = applied(state, 'set-deck', { careerId: CAREER, deck })
  return state
}

export const careerGame = (state: SaveState = startedState()): MemoryGame => memoryGame({ state, env: CAREER_ENV })

/** The game the season's Play step opens: the main one, Furlong Hand, in every season and at the Finale (D391). */
export function seasonGame(state: SaveState, id = CAREER): StageKind {
  const career = state.careers[id]!
  const uma = CAREER_ENV.content.umas.get(career.umaId)!
  return seasonStages(career, career.season === 12 ? finaleRace(uma, career, CAREER_ENV.content.races).id : 'any')[0]!.game
}

/**
 * A career play of `kind` on the save as it stands, played by the competent bot to one move from its end: for the Yard
 * a placement left (any empty cell finishes it), for Furlong Hand a card to run (`move.x`, its front column). The first
 * seed from `seed` that ends that way.
 */
export function oneMoveLeft(kind: StageKind, state: SaveState, seed = 1, id = CAREER): { journal: Journal; move: StageInput } {
  for (let tried = seed; tried < seed + 200; tried += 1) {
    const config = stageConfigFor(kind, id, false, tried, state, CAREER_ENV)
    if (typeof config === 'string') throw new Error(config)
    if (kind === 'training-yard') {
      const full = playBot(YARD_RULES, config, 'competent', tried).inputs
      let yard = YARD_RULES.init(config)
      const inputs: StageInput[] = []
      for (const input of full) {
        if (yard.placed >= YARD_PLACEMENTS - 1) break
        inputs.push(input)
        yard = YARD_RULES.step(yard, input)!
      }
      if (yard.placed === YARD_PLACEMENTS - 1 && !YARD_RULES.done(yard)) {
        return { journal: { config, version: YARD_RULES.version, inputs }, move: full[inputs.length]! }
      }
      continue
    }
    const inputs = playBot(FURLONG_RULES, config, 'competent', tried).inputs
    const move = inputs.at(-1)!
    if (move.code === FURLONG_MOVE.run) return { journal: { config, version: FURLONG_RULES.version, inputs: inputs.slice(0, -1) }, move }
  }
  throw new Error(`No seed leaves ${kind} one move from its end`)
}

/** The stand-in race scene: no canvas in jsdom; Skip finishes the race at once, as the real scene's ticker does. */
export class FakeRaceScene {
  readonly position = 0
  constructor(_timeline: unknown, _runners: unknown, _player: number, _onHud: unknown, private readonly onFinish: () => void) {}
  async mount(): Promise<void> {}
  setSpeed(): void {}
  seek(): void {}
  skipToEnd(): void {
    this.onFinish()
  }
  destroy(): void {}
  async setBusts(): Promise<void> {}
}
