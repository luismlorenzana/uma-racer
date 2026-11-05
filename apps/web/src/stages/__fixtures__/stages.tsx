// The stage tests' fixtures (T155): an account with one running career on the invented content, the host rendered in
// the app's providers at 390 × 844, and journals played part-way by the domain's own bots.
import { KitArtProvider, MotionRoot } from '@luismlorenzana/uma-kit/ui'
import { initialSave, careerId, type CareerRecord, type SaveState } from '@racer/domain/save'
import { playBot, YARD_PLACEMENTS, YARD_RULES, type Journal, type StageInput } from '@racer/domain/stages'
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
