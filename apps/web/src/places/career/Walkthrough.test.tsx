// @vitest-environment jsdom
// A whole URA Finale career on the screens (T158's "Done when"; D387), at 390 × 844 over the in-memory port on the
// invented career content, with the device's own race engine: Start a career from the Careers place, then each of the
// twelve seasons' Play (the season's game opened through the stage host on a journal the competent bot played to one
// move from its end, settled through `settle-stage`; a Training Yard season once more through the header's Play
// again), Upgrade (her deck once, a card posted to another branch, every pip she can afford with each preview checked
// against what it paid, Bond poured, skills bought) and Race (each objective, retried at once until won), Next season,
// then the URA Finals (the prep heat and three rounds) to the completion. Seeds are fixed (the plays', and the races' by
// their attempts), so the run is the same every time. The race scene stands in: jsdom draws no canvas.
import { STATS, type Stats } from '@racer/domain'
import { seasonObjectives } from '@racer/domain/career'
import { FINALE_SEASON, type SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemoryGame } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { CAREERS_PATH, careerPath, playPath, profilePath } from '../../hub/nav'
import { journalId } from '../../stages/ids'
import { atPhoneSize } from '../../stages/__fixtures__/stages'
import { accountState, CAREER, CAREER_ENV, careerGame, FakeRaceScene, oneMoveLeft, seasonGame, STRONG_DECK, UMA } from './__fixtures__/career'

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

type Where = () => string
const STAT_NAMES: Readonly<Record<string, string>> = { speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit' }
const now = (game: MemoryGame): SaveState => game.getSnapshot().state!
const careerNow = (game: MemoryGame) => now(game).careers[CAREER]!
const step = (name: string) => document.querySelector<HTMLElement>(`[data-step="${name}"]`)
const onCareerPage = async (where: Where) => {
  await waitFor(() => expect(where()).toBe(careerPath(CAREER)))
  await waitFor(() => expect(step('play') ?? document.querySelector('[data-racer="completion"]')).not.toBeNull())
}
const enabled = (button: HTMLElement | null | undefined): button is HTMLElement => button != null && !button.hasAttribute('disabled')

/** Her stats as Upgrade's stat row reads them. */
function shownStats(): Stats {
  const row = document.querySelector<HTMLElement>('[data-racer="her-stats"]')!
  return Object.fromEntries(STATS.map((stat) => [stat, Number(within(row).getByLabelText(new RegExp(`^${STAT_NAMES[stat]} \\d+$`)).getAttribute('aria-label')!.split(' ')[1])])) as unknown as Stats
}
/** A buy line's preview: each stat's gain less what her caps throw away. */
function keptShown(line: HTMLElement): Stats {
  const kept = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  for (const item of line.querySelectorAll<HTMLElement>('[data-gain]')) {
    const stat = item.dataset.gain as keyof Stats | 'sp'
    if (stat === 'sp') continue
    const gain = Number(item.querySelector('.numeral')!.textContent!.replace(/[^\d-]/g, ''))
    const over = Number(item.querySelector('[data-overflow]')?.textContent?.replace(/[^\d]/g, '') ?? 0)
    kept[stat] = gain - over
  }
  return kept
}

/**
 * A play: its game's journal one move from the end, the last move tapped in the host, then Done. The season's Play
 * step opens the main game, Furlong Hand; `other` opens Training Yard from the step's Another game row, and `again`
 * that game from the header's Play again.
 */
async function play(game: MemoryGame, where: Where, seed: number, via: 'step' | 'other' | 'again' = 'step'): Promise<void> {
  const kind = via === 'step' ? seasonGame(now(game)) : 'training-yard'
  const { journal, move } = oneMoveLeft(kind, now(game), seed)
  await game.journal.write({ id: journalId(kind, CAREER, 'career'), careerId: CAREER, journal })
  const before = careerNow(game).wallet
  fireEvent.click(via === 'again' ? within(screen.getByRole('group', { name: 'Play again' })).getByRole('link', { name: 'Play Training Yard' })
    : via === 'other' ? document.querySelector<HTMLElement>('[data-racer="other-game"][data-game="training-yard"]')! : step('play')!)
  await waitFor(() => expect(where()).toBe(playPath(CAREER, kind)))
  if (kind === 'training-yard') {
    const cells = await screen.findAllByRole('button', { name: /^Row \d, column \d/ })
    fireEvent.click(cells.find((cell) => cell.getAttribute('aria-label')!.endsWith('empty') && !cell.hasAttribute('disabled'))!)
  } else {
    const spread = await screen.findByRole('group', { name: 'The spread' })
    fireEvent.click(spread.querySelector<HTMLElement>(`[data-front="${move.x}"]`)!)
  }
  expect(await screen.findByLabelText(/^Grade [SABCD]$/)).toBeTruthy()
  // Every game pays the same bundle (D391): drills, Bond and SP.
  const after = careerNow(game).wallet
  expect(Object.values(after.drills).reduce((a, b) => a + b, 0)).toBeGreaterThan(Object.values(before.drills).reduce((a, b) => a + b, 0))
  expect(after.bond).toBeGreaterThan(before.bond)
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  await onCareerPage(where)
  expect(step('play')!.dataset.state).toBe('done')
}

/** Upgrade: her deck (once), a post (once), every pip she can afford, Bond, and skills; each pip's preview is what it pays. */
async function upgrade(game: MemoryGame, where: Where, season: number): Promise<{ pips: number; pours: number; skills: number }> {
  fireEvent.click(step('upgrade')!)
  await waitFor(() => expect(document.querySelector('[data-racer="upgrade"]')).not.toBeNull())
  const tab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))
  if (careerNow(game).deck.length === 0) {
    tab(/^Deck/)
    for (const id of STRONG_DECK) {
      fireEvent.click(await waitFor(() => document.querySelector<HTMLElement>(`[data-racer="deck-cards"] [data-card="${id}"]`)!))
      await waitFor(() => expect(careerNow(game).deck).toContain(id))
    }
  }
  if (season === 0) {
    // The sixth card trains at Wit instead of its own branch.
    const moved = STRONG_DECK[5]!
    fireEvent.click(document.querySelector<HTMLElement>(`[data-deck-card="${moved}"]`)!)
    const sheet = await screen.findByRole('dialog', { name: /Sim/ })
    fireEvent.click(within(sheet).getByRole('button', { name: /^Wit, / }))
    await waitFor(() => expect(careerNow(game).posts[moved]).toBe('wit'))
  }
  let pips = 0
  tab(/^Tree/)
  for (const stat of STATS) {
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${STAT_NAMES[stat]}: level`) }))
    for (;;) {
      const line = [document.querySelector<HTMLElement>('[data-racer="row-pips"]'), document.querySelector<HTMLElement>('[data-racer="next-pip"]')]
        .find((each): each is HTMLElement => enabled(each?.querySelector('button')))
      if (line === undefined) break
      const kept = keptShown(line)
      const before = shownStats()
      const bought = careerNow(game).pips[stat]
      fireEvent.click(line.querySelector('button')!)
      await waitFor(() => expect(careerNow(game).pips[stat]).toBeGreaterThan(bought))
      pips += careerNow(game).pips[stat] - bought
      await waitFor(() => expect(shownStats()).toEqual(Object.fromEntries(STATS.map((each) => [each, before[each] + kept[each]]))))
    }
  }
  let pours = 0
  tab(/^Bonds/)
  for (;;) {
    const pour = await waitFor(() => [...document.querySelectorAll<HTMLElement>('[data-bond-card] button')])
      .then((buttons) => buttons.find(enabled))
    if (pour === undefined || pours > 12) break
    const bond = careerNow(game).wallet.bond
    fireEvent.click(pour)
    await waitFor(() => expect(careerNow(game).wallet.bond).toBeLessThan(bond))
    pours += 1
  }
  let skills = 0
  tab(/^Skills/)
  for (;;) {
    const buy = await waitFor(() => [...document.querySelectorAll<HTMLElement>('[data-skill] button')]).then((buttons) => buttons.find(enabled))
    if (buy === undefined) break
    const held = careerNow(game).skills.length
    fireEvent.click(buy)
    await waitFor(() => expect(careerNow(game).skills.length).toBe(held + 1))
    skills += 1
  }
  fireEvent.click(screen.getByRole('button', { name: 'Back to Careers' }))
  await onCareerPage(where)
  return { pips, pours, skills }
}

/** One race from its Race button to its win, retried at once after each loss. Returns the runs it took. */
async function race(where: Where, name: string): Promise<number> {
  fireEvent.click(await screen.findByRole('button', { name: `Race the ${name}` }))
  const sheet = await screen.findByRole('dialog')
  await waitFor(() => expect(enabled(within(sheet).getByRole('button', { name: 'Race' }))).toBe(true))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Race' }))
  for (let runs = 1; runs <= 100; runs += 1) {
    await waitFor(() => expect(where()).toContain('/race/'))
    fireEvent.click(await screen.findByRole('button', { name: 'Skip to the finish' }))
    const result = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="race-result"]')
      expect(found).not.toBeNull()
      return found!
    })
    const retry = within(result).queryByRole('button', { name: 'Retry' })
    if (retry === null) {
      expect(result.dataset.won).toBe('true')
      fireEvent.click(within(result).getByRole('button', { name: 'Continue' }))
      await onCareerPage(where)
      return runs
    }
    const at = where()
    fireEvent.click(retry)
    await waitFor(() => expect(where()).not.toBe(at))
  }
  throw new Error(`${name} wasn't won in 100 runs`)
}

describe('a whole URA Finale career on the screens', () => {
  it('starts, plays, upgrades and races twelve seasons, wins the URA Finals and completes', async () => {
    const game = careerGame(accountState())
    const { where } = renderRacer(CAREERS_PATH, game)
    const tickets = now(game).account

    // Start: the picker, her, and the one confirm sheet.
    fireEvent.click(await screen.findByRole('button', { name: 'Start a career' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Who runs?' })).getByRole('button', { name: 'Sim Uma 0' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Sim Uma 0' })).getByRole('button', { name: 'Start career · URA Finale' }))
    await onCareerPage(where)

    const totals = { plays: 0, pips: 0, pours: 0, skills: 0, runs: 0, races: 0 }
    for (let season = 0; season < FINALE_SEASON; season += 1) {
      expect(careerNow(game).season).toBe(season)
      // Seeds far apart: the host shows a play already settled with the same seed instead of paying it twice.
      await play(game, where, 1_000 * (season + 1))
      totals.plays += 1
      // Then the other game, Training Yard, from the step's Another game row, and in a season without a race once more
      // from the header's Play again: each pays like a first play.
      await play(game, where, 1_000 * (season + 1) + 300, 'other')
      totals.plays += 1
      if (seasonObjectives(careerNow(game)).length === 0) {
        await play(game, where, 1_000 * (season + 1) + 600, 'again')
        totals.plays += 1
      }
      const spent = await upgrade(game, where, season)
      totals.pips += spent.pips
      totals.pours += spent.pours
      totals.skills += spent.skills
      for (const objective of seasonObjectives(careerNow(game))) {
        const name = CAREER_ENV.content.races.find((each) => each.id === objective.raceId)!.name
        totals.runs += await race(where, name)
        totals.races += 1
      }
      expect(seasonObjectives(careerNow(game)).every((objective) => objective.status === 'won')).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: season === FINALE_SEASON - 1 ? 'On to the URA Finals' : 'Next season' }))
      await waitFor(() => expect(careerNow(game).season).toBe(season + 1))
    }

    // The Finale: the prep heat, the build, then the three rounds one at a time.
    await waitFor(() => expect(document.querySelector('[data-racer="finale-card"]')).not.toBeNull())
    await play(game, where, 50_000)
    totals.plays += 1
    await upgrade(game, where, FINALE_SEASON)
    for (const name of ['URA Finals Qualifier', 'URA Finals Semifinal', 'URA Finals Final']) {
      totals.runs += await race(where, name)
      totals.races += 1
    }

    // Completion: her build frozen, the tickets paid, and the career under Completed.
    const done = careerNow(game)
    expect(done.completedAt).not.toBeNull()
    expect(done.racingBuild).not.toBeNull()
    const completion = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="completion"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(within(completion).getByLabelText(`Speed ${done.racingBuild!.stats.speed}`)).toBeTruthy()
    expect(within(completion).getByText('Next: Unity Cup, coming in release 2')).toBeTruthy()
    expect(now(game).account.umaTickets).toBe(tickets.umaTickets + 1)
    expect(now(game).account.cardTickets).toBe(tickets.cardTickets + done.objectives.length + 2)
    expect(totals.races).toBe(done.objectives.length + 3)
    expect(totals.pips).toBeGreaterThan(30)
    expect(totals.pours).toBeGreaterThan(0)
    expect(totals.skills).toBeGreaterThan(0)
    expect(game.applied.filter((name) => name === 'settle-stage')).toHaveLength(totals.plays)
    expect(totals.plays).toBeGreaterThan(13)
    expect(game.applied.filter((name) => name === 'next-season')).toHaveLength(12)
    expect(game.applied.filter((name) => name === 'run-race' || name === 'run-finale')).toHaveLength(totals.runs)

    fireEvent.click(screen.getByRole('button', { name: 'Back to Careers' }))
    await waitFor(() => expect(where()).toBe(CAREERS_PATH))
    const completed = await screen.findByRole('region', { name: 'Completed' })
    expect(within(completed).getByRole('link').getAttribute('href')).toBe(profilePath(UMA))
  }, 300_000)
})
