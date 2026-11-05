// Card power and `sim:decks` on the invented cards (D382): the bands CI holds, and the area's purity.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'
import { testCard, unique } from '../__fixtures__/build'
import { DECK_BANDS, pickDecks, runDeck, simulateDecks, syntheticCards, syntheticUmas } from './decks'
import { cardPower, powerScale } from './power'

describe('card power', () => {
  it('is the stat gain the card adds to the reference session: Speed level 3, alone, bond 80, no growth', () => {
    // Alone: ⌊13 × 1.2⌋ + ⌊6 × 1.2⌋ = 22. With the card: × 1.09 × 1.05 × 1.22 friendship = 1.6755 → ⌊14 × 1.6755⌋ + ⌊6 × 1.6755⌋ = 33.
    expect(cardPower(testCard('a', 'speed', { 1: 22, 3: 1, 8: 9 }))).toBe(11)
    expect(cardPower(testCard('b', 'speed', { 1: 33, 3: 1, 8: 9 }))).toBeGreaterThan(11)
    expect(cardPower(testCard('c', 'speed', {}))).toBe(1) // its presence alone: ⌊13 × 1.26⌋ = 16
  })

  it('reads conditionals in the reference deck: bond 80, one card of each type, the tree at level 3', () => {
    const atBond = testCard('u', 'speed', {}, { uniqueEffect: unique({ type: 101, value: 80, params: [8, 13] }) })
    const sixTypes = testCard('t', 'speed', {}, { uniqueEffect: unique({ type: 103, value: 6, params: [11] }) })
    const plain = testCard('p', 'speed', { 8: 13 })
    expect(cardPower(atBond)).toBe(cardPower(plain))
    expect(cardPower(sixTypes)).toBe(cardPower(plain))
  })

  it('scores Friend and Group cards on their own scale, at Wit and never in friendship', () => {
    const friend = testCard('f', 'friend', { 8: 10, 2: 20, 1: 50 })
    // Wit level 3 alone: ⌊2 × 1.2⌋ + ⌊12 × 1.2⌋ = 16; with it: × 1.24 × 1.1 × 1.05 → ⌊2.86⌋ + ⌊17.19⌋ = 19.
    expect(cardPower(friend)).toBe(3)
    expect(powerScale(friend)).toBe('support')
    expect(powerScale(testCard('s', 'wit', {}))).toBe('stat')
  })
})

describe('sim:decks on the invented cards', () => {
  const cards = syntheticCards()
  const umas = syntheticUmas()

  it('picks a median deck (each type\'s median and a Friend) and a strong one (each type\'s best and the best left)', () => {
    const { median, strong } = pickDecks(cards, 1)
    expect(median.map((card) => card.type)).toEqual(['speed', 'stamina', 'power', 'guts', 'wit', 'friend'])
    expect(median.slice(0, 5).map((card) => card.id)).toEqual(['sim-speed-2', 'sim-stamina-2', 'sim-power-2', 'sim-guts-2', 'sim-wit-2'])
    expect(strong.slice(0, 5).map((card) => card.id)).toEqual(['sim-speed-4', 'sim-stamina-4', 'sim-power-4', 'sim-guts-4', 'sim-wit-4'])
    expect(strong).toHaveLength(6)
    expect(pickDecks(cards.map((card) => ({ ...card, era: 2 })), 1)).toEqual({ median: [], strong: [] })
  })

  it('holds the bands: median 55–77%, strong 70–90%, and no deck caps all five stats', () => {
    const report = simulateDecks(cards, umas, 1)
    expect(report.failures).toEqual([])
    const [empty, median, strong] = report.lines
    expect(median!.mean).toBeGreaterThanOrEqual(DECK_BANDS.median.min)
    expect(median!.mean).toBeLessThanOrEqual(DECK_BANDS.median.max)
    expect(strong!.mean).toBeGreaterThanOrEqual(DECK_BANDS.strong.min)
    expect(strong!.mean).toBeLessThanOrEqual(DECK_BANDS.strong.max)
    expect(empty!.mean).toBeLessThan(median!.mean)
    expect(median!.mean).toBeLessThan(strong!.mean)
  })

  it('reports aggregates only, and fails when a band drifts', () => {
    const report = simulateDecks(cards, umas, 1)
    expect(JSON.stringify(report)).not.toMatch(/sim-/)
    const weak = cards.map((card) => ({ ...card, effects: {}, uniqueEffect: null }))
    expect(simulateDecks(weak, umas, 1).failures.join(' ')).toMatch(/median deck reaches/)
  })

  it('runs a full tree: 100 sessions, the empty deck near 45% of the cap budget', () => {
    const run = runDeck([], umas[0]!, 1, false)
    expect(run.share).toBeGreaterThan(0.4)
    expect(run.share).toBeLessThan(0.5)
    expect(run.capped).toBe(0)
  })
})

describe('purity', () => {
  it('reads no clock, rolls no dice, does no I/O and touches no browser global', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url))
    const sources = readdirSync(dir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts')).map((file) => join(dir, file))
    expect(sources.length).toBeGreaterThanOrEqual(10)
    for (const file of sources) {
      const code = codeOnly(readFileSync(file, 'utf8'))
      for (const banned of [/Date\.now/, /\bDate\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/,
        /\bwindow\./, /\bdocument\./, /\bnavigator\./, /\bcrypto\./, /\bprocess\./, /\bconsole\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })
})
