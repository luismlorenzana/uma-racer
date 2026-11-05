// @vitest-environment jsdom
// A career's races (docs/game/11-hub-and-places.md §3.2, §6; T158, D387) at 390 × 844: the race sheet (her racing
// build, her best style preselected, the field the seeded draw meets), Race committing `run-race` and opening the run,
// the run replayed from its stored result (the race scene stands in: jsdom draws no canvas), the result with the
// objective's status and reward, Retry at once after a loss with the next attempt, and the URA Finals' rounds up to the
// final's completion. The engine here places her as each test says; the run screen replays what the row stored.
import { bestStrategy, type RaceEngine, type RaceSetup } from '@racer/domain'
import { FINALE_SEASON, type OperationEnv, type SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMORY_AT, memoryGame } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { careerPath, racePath } from '../../hub/nav'
import { atPhoneSize } from '../../stages/__fixtures__/stages'
import { CAREER, CAREER_ENV, FakeRaceScene, startedState, STRONG_DECK, UMA } from './__fixtures__/career'

vi.mock('../../scenes/race/RaceScene', () => ({ RaceScene: FakeRaceScene }))

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** An engine that places her by a list, one entry a race (the last repeats), everyone else in gate order around her. */
function placing(places: readonly number[]): RaceEngine & { readonly runs: RaceSetup[] } {
  const runs: RaceSetup[] = []
  return {
    version: 9,
    runs,
    simulate: (setup) => {
      const placement = places[Math.min(runs.length, places.length - 1)]!
      runs.push(setup)
      const her = setup.runners.findIndex((runner) => runner.id === UMA)
      const others = setup.runners.map((_, i) => i).filter((i) => i !== her)
      const order = [...others.slice(0, placement - 1), her, ...others.slice(placement - 1)]
      return { results: order.map((runner, n) => ({ runner, placement: n + 1, finishTime: 95 + n * 0.3, marginLengths: n === 0 ? 0 : 0.5 })) }
    },
  }
}

const withEngine = (engine: RaceEngine): OperationEnv => ({ ...CAREER_ENV, race: engine })
const game = (state: SaveState, engine: RaceEngine) => memoryGame({ state, env: withEngine(engine) })

async function openSheet(name: RegExp) {
  fireEvent.click(await screen.findByRole('button', { name }))
  return screen.findByRole('dialog')
}
const result = () => waitFor(() => {
  const found = document.querySelector<HTMLElement>('[data-racer="race-result"]')
  expect(found).not.toBeNull()
  return found!
})

describe('a career race', () => {
  it('opens the sheet on her racing build, her best style and the field, and Race runs it', async () => {
    const engine = placing([1])
    const memory = game(startedState(STRONG_DECK), engine)
    const { where } = renderRacer(careerPath(CAREER), memory)
    const career = memory.getSnapshot().state!.careers[CAREER]!
    const objective = career.objectives[0]!
    const race = CAREER_ENV.content.races.find((each) => each.id === objective.raceId)!
    const sheet = await openSheet(new RegExp(`^Race the ${race.name}$`))
    expect(within(sheet).getByRole('heading', { name: race.name })).toBeTruthy()
    const uma = CAREER_ENV.content.umas.get(UMA)!
    const styles = within(sheet).getByRole('group', { name: 'Running style' })
    expect(within(styles).getAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.dataset.style))
      .toEqual([bestStrategy(uma)])
    const field = await waitFor(() => {
      const found = sheet.querySelector<HTMLElement>('[data-racer="race-field"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(within(field).getAllByRole('listitem')).toHaveLength(14)
    expect(field.querySelectorAll('[data-her]')).toHaveLength(1)
    // Her style is in the seed: choosing another draws its field again.
    fireEvent.click(within(styles).getByRole('button', { name: /^End Closer/ }))
    const faces = within(sheet.querySelector<HTMLElement>('[data-racer="race-field"]')!).getAllByRole('listitem')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Race' }))
    await waitFor(() => expect(where()).toMatch(/^\/career\/careers\/sim-uma-0%3A1\/race\/memory-\d+$/))
    expect(memory.applied).toEqual(['run-race'])
    expect(engine.runs[0]!.runners.find((runner) => runner.id === UMA)!.strategy).toBe('end')
    // The field the sheet showed is the field that ran.
    expect(engine.runs[0]!.runners.map((runner) => runner.id)).toEqual(faces.map((face) => face.getAttribute('aria-label')!.split(': ')[1]).map((name) =>
      [...CAREER_ENV.content.umas.values()].find((each) => each.name === name)?.id))
    await waitFor(() => expect(document.querySelector('[data-racer="run-title"]')?.textContent).toBe(race.name))
    fireEvent.click(screen.getByRole('button', { name: 'Skip to the finish' }))
    const shown = await result()
    expect(within(shown).getByText('Win!')).toBeTruthy()
    expect(within(shown).getByText('Objective won')).toBeTruthy()
    expect(within(shown).getByText('+1 Card Ticket')).toBeTruthy()
    expect(within(shown).getByText(/^\+\d+ SP$/)).toBeTruthy()
    const order = within(shown).getByRole('region', { name: 'Finishing order' })
    expect(within(order).getAllByRole('listitem')[0]!.dataset.runner).toBe(UMA)
    fireEvent.click(within(shown).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(where()).toBe(careerPath(CAREER)))
    expect(memory.getSnapshot().state!.careers[CAREER]!.objectives[0]!.status).toBe('won')
    expect(await screen.findByRole('button', { name: 'Next season' })).toBeTruthy()
  })

  it('offers Retry at once after a loss: the next attempt, a new race', async () => {
    const engine = placing([4, 1])
    const memory = game(startedState(STRONG_DECK), engine)
    const { where } = renderRacer(careerPath(CAREER), memory)
    const sheet = await openSheet(/^Race the /)
    await waitFor(() => expect(within(sheet).getByRole('button', { name: 'Race' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Race' }))
    await waitFor(() => expect(where()).toContain('/race/'))
    const first = where()
    fireEvent.click(await screen.findByRole('button', { name: 'Skip to the finish' }))
    const lost = await result()
    expect(within(lost).getByText('4th')).toBeTruthy()
    expect(within(lost).getByText('Not won yet: retries are free.')).toBeTruthy()
    expect(within(lost).queryByRole('list', { name: 'Earned' })).toBeNull()
    fireEvent.click(within(lost).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(where()).not.toBe(first))
    expect(memory.applied).toEqual(['run-race', 'run-race'])
    expect(engine.runs[1]!.seed).not.toBe(engine.runs[0]!.seed)
    fireEvent.click(await screen.findByRole('button', { name: 'Skip to the finish' }))
    const won = await result()
    expect(within(won).getByText('Win!')).toBeTruthy()
    fireEvent.click(within(won).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(where()).toBe(careerPath(CAREER)))
  })

  it('runs the URA Finals round by round, and winning the final completes her career', async () => {
    let state = startedState(STRONG_DECK)
    const career = state.careers[CAREER]!
    state = { ...state, careers: { [CAREER]: { ...career, season: FINALE_SEASON, objectives: career.objectives.map((each) => ({ ...each, status: 'won' as const, wonAt: MEMORY_AT })) } } }
    const memory = game(state, placing([1]))
    const { where } = renderRacer(careerPath(CAREER), memory)
    for (const [round, name] of [[0, 'URA Finals Qualifier'], [1, 'URA Finals Semifinal'], [2, 'URA Finals Final']] as const) {
      const sheet = await openSheet(new RegExp(`^Race the ${name}$`))
      expect(within(sheet).getByRole('heading', { name })).toBeTruthy()
      await waitFor(() => expect(within(sheet).getByRole('button', { name: 'Race' }).hasAttribute('disabled')).toBe(false))
      fireEvent.click(within(sheet).getByRole('button', { name: 'Race' }))
      await waitFor(() => expect(where()).toContain('/race/'))
      await waitFor(() => expect(document.querySelector('[data-racer="run-title"]')?.textContent).toBe(name))
      fireEvent.click(await screen.findByRole('button', { name: 'Skip to the finish' }))
      const shown = await result()
      if (round < 2) {
        expect(within(shown).getByText(round === 0 ? 'On to the URA Finals Semifinal' : 'On to the URA Finals Final')).toBeTruthy()
      } else {
        expect(shown.dataset.completed).toBe('true')
        expect(within(shown).getByText('The URA Finals are hers')).toBeTruthy()
        expect(within(shown).getByText('+1 Uma Ticket')).toBeTruthy()
        expect(within(shown).getByText('Next: Unity Cup, coming in release 2')).toBeTruthy()
      }
      fireEvent.click(within(shown).getByRole('button', { name: 'Continue' }))
      await waitFor(() => expect(where()).toBe(careerPath(CAREER)))
    }
    expect(memory.applied).toEqual(['run-finale', 'run-finale', 'run-finale'])
    expect(memory.getSnapshot().state!.careers[CAREER]!.completedAt).not.toBeNull()
    expect(await screen.findByRole('heading', { name: 'URA Finale complete' })).toBeTruthy()
    expect(racePath(CAREER, 'x')).toBe('/career/careers/sim-uma-0%3A1/race/x')
  })

  it('says so for a run this phone does not hold', async () => {
    renderRacer(racePath(CAREER, 'nothing-here'), memoryGame({ state: startedState(), env: CAREER_ENV }))
    expect(await screen.findByText("That race isn't on this phone yet.")).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
