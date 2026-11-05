// The stage tests' fixtures (T155, T156): an account with one running career on the invented content, the host rendered
// in the app's providers at 390 × 844, and journals played part-way by the domain's own bots; for Furlong Hand, a career
// on the domain's invented career content (races, courses and skills).
import { KitArtProvider, MotionRoot } from '@luismlorenzana/uma-kit/ui'
import { syntheticCards } from '@racer/domain/build'
import { newCareer, syntheticCareerUmas, syntheticCourses, syntheticRaces, syntheticSkills } from '@racer/domain/career'
import { buildOperationEnv, initialSave, careerId, type CareerRecord, type OperationEnv, type SaveState } from '@racer/domain/save'
import {
  FURLONG_RULES, playBot, YARD_PLACEMENTS, YARD_RULES, type FurlongState, type Journal, type StageConfig, type StageInput,
} from '@racer/domain/stages'
import { render } from '@testing-library/react'
import { domMax, LazyMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { cardId, syntheticEnv, umaId } from '../../__fixtures__/content'
import { MEMORY_AT, memoryGame, type MemoryGame } from '../../__fixtures__/memory'
import { RACER_ART } from '../../app/art'
import { ContentContext } from '../../app/content'
import { GameProvider } from '../../app/GameProvider'
import { RULES } from '../../app/rules'
import { stageConfigFor } from '../session'

export const UMA = umaId(1)
export const CAREER = careerId(UMA, 1)
export const ENV = syntheticEnv()

/** Her running career in its second season, with a deck of three invented cards. */
export function careerState(): SaveState {
  const base = initialSave(MEMORY_AT).state
  const career: CareerRecord = {
    umaId: UMA, T: 1, startedAt: MEMORY_AT, season: 1, objectives: [], finale: { step: 0, won: false },
    deck: [cardId(1), cardId(2), cardId(3)], posts: {}, pips: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, camps: [null, null],
    skills: [], spSpent: 0, wallet: { drills: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, bond: 0, sp: 0 }, completedAt: null,
    racingBuild: null,
  }
  return {
    ...base,
    umas: { [UMA]: { unlockedAt: MEMORY_AT } },
    cards: Object.fromEntries([1, 2, 3].map((n) => [cardId(n), { unlockedAt: MEMORY_AT }])),
    careers: { [CAREER]: career },
  }
}

export const careerGame = (): MemoryGame => memoryGame({ state: careerState(), env: ENV })

/** The phone the owner plays on. */
export function atPhoneSize(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
  window.dispatchEvent(new Event('resize'))
}

export function renderInApp(game: MemoryGame, children: ReactNode) {
  return render(
    <MotionRoot>
      <LazyMotion features={domMax} strict>
        <KitArtProvider art={RACER_ART}>
          <ContentContext.Provider value={null}>
            <GameProvider game={game} rules={RULES}>
              <MemoryRouter>{children}</MemoryRouter>
            </GameProvider>
          </ContentContext.Provider>
        </KitArtProvider>
      </LazyMotion>
    </MotionRoot>,
  )
}

// --- Furlong Hand (T156) ---------------------------------------------------------------------------------------------
// The web's invented content has no races, courses or skills, so the race runs on the domain's invented career content:
// Umas with aptitudes, races of every distance and their courses, skills, and the invented cards.

/** The env Furlong Hand's tests run on. */
export const FURLONG_ENV: OperationEnv = buildOperationEnv({
  umas: syntheticCareerUmas(), races: syntheticRaces(), courses: syntheticCourses(), cards: syntheticCards(), skills: syntheticSkills(),
  contentVersion: 'furlong-test',
})
export const FURLONG_UMA = 'sim-uma-0'
export const FURLONG_CAREER = careerId(FURLONG_UMA, 1)
/** One card a type and a Friend, the stat ones bonded: their Partners are rainbows. */
export const FURLONG_DECK = ['sim-speed-2', 'sim-stamina-2', 'sim-power-2', 'sim-guts-2', 'sim-wit-2', 'sim-friend-2']

/** Her career in the season of her first objective, with a deck of six invented cards. */
export function furlongState(): SaveState {
  const base = initialSave(MEMORY_AT).state
  const uma = FURLONG_ENV.content.umas.get(FURLONG_UMA)!
  const fresh = newCareer(uma, 1, FURLONG_ENV.content.races, MEMORY_AT)
  const career: CareerRecord = { ...fresh, deck: FURLONG_DECK, season: fresh.objectives[0]!.season }
  return {
    ...base,
    umas: { [FURLONG_UMA]: { unlockedAt: MEMORY_AT } },
    cards: Object.fromEntries(FURLONG_DECK.map((id) => [id, { unlockedAt: MEMORY_AT }])),
    careers: { [FURLONG_CAREER]: career },
  }
}

export const furlongGame = (): MemoryGame => memoryGame({ state: furlongState(), env: FURLONG_ENV })

/** A Furlong Hand config from the save: the career's, or practice. */
export function furlongConfigFor(seed: number, practice = false, careerFor: string | null = FURLONG_CAREER): StageConfig {
  const config = stageConfigFor('furlong-hand', careerFor, practice, seed, furlongState(), FURLONG_ENV)
  if (typeof config === 'string') throw new Error(config)
  return config
}

/**
 * A Furlong journal played by the competent bot to all but its last move, on the first seed from `seed` whose last
 * move is `last` (run, bank, flip …): what a phone keeps one tap from the finish.
 */
export function furlongOneLeft(practice: boolean, last: number, seed = 1, careerFor: string | null = FURLONG_CAREER): { journal: Journal; move: StageInput } {
  for (let tried = seed; tried < seed + 200; tried += 1) {
    const config = furlongConfigFor(tried, practice, careerFor)
    const inputs = playBot(FURLONG_RULES, config, 'competent', tried).inputs
    const move = inputs.at(-1)!
    if (move.code === last) return { journal: { config, version: FURLONG_RULES.version, inputs: inputs.slice(0, -1) }, move }
  }
  throw new Error('No seed ends on that move')
}

/** The rules' state after `moves` of the competent bot's play of seed `seed`. */
export function furlongAfter(seed: number, moves: number, practice = false): FurlongState {
  const config = furlongConfigFor(seed, practice)
  const inputs = playBot(FURLONG_RULES, config, 'competent', seed).inputs
  let state = FURLONG_RULES.init(config)
  for (const input of inputs.slice(0, moves)) state = FURLONG_RULES.step(state, input)!
  return state
}

/**
 * A Yard journal played by the competent bot to `placements` placements, on the first seed from `seed` whose play is
 * still open there: what a phone keeps when the app is closed mid-play.
 */
export function partPlayed(state: SaveState, practice: boolean, placements: number, careerIdFor: string | null = CAREER, seed = 1): Journal {
  for (let tried = seed; tried < seed + 200; tried += 1) {
    const config = stageConfigFor('training-yard', careerIdFor, practice, tried, state, ENV)
    if (typeof config === 'string') throw new Error(config)
    const full = playBot(YARD_RULES, config, 'competent', tried).inputs
    let yard = YARD_RULES.init(config)
    const inputs: StageInput[] = []
    for (const input of full) {
      if (yard.placed >= placements) break
      inputs.push(input)
      yard = YARD_RULES.step(yard, input)!
    }
    if (yard.placed === placements && !YARD_RULES.done(yard) && placements < YARD_PLACEMENTS) return { config, version: YARD_RULES.version, inputs }
  }
  throw new Error('No seed keeps the yard open that long')
}
