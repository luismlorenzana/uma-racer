// The stage registry and the configs (D384, D385): Training Yard and Furlong Hand are registered, a kind registers once;
// a career's config reads her growth, her deck and bonds, and the season's focus.
import { describe, expect, it } from 'vitest'
import { careerSave, CONTENT_ENV, UMAS } from '../__fixtures__/career'
import { careerId, type CareerRecord } from '../save/records'
import { isRefusal } from '../save/registry'
import { commitOperation } from '../save/commit'
import { clock, opId } from '../__fixtures__/g3'
import { careerStageConfig, practiceStageConfig } from './config'
import { STAGE_KINDS } from './contract'
import { registeredStages, registerStage, stageRules } from './registry'
import { FURLONG_RULES } from './furlong'
import { YARD_RULES } from './yard'

describe('the registry', () => {
  it('holds Training Yard and Furlong Hand', () => {
    expect(registeredStages()).toEqual(['training-yard', 'furlong-hand'])
    expect(stageRules('training-yard')).toBe(YARD_RULES)
    expect(stageRules('furlong-hand')).toBe(FURLONG_RULES)
    expect(STAGE_KINDS).toEqual(['training-yard', 'furlong-hand'])
  })

  it('registers a kind once', () => {
    expect(() => registerStage(YARD_RULES)).toThrow(/registered twice/)
  })
})

describe('configs', () => {
  const UMA = UMAS[0]!
  const ID = careerId(UMA.id, 1)
  const started = (): CareerRecord => {
    const commit = commitOperation(careerSave(UMA.id), { id: opId(1), name: 'start-career', input: { umaId: UMA.id, T: 1 }, at: clock('08:00') }, CONTENT_ENV)
    if (commit.status !== 'applied') throw new Error(commit.status)
    return commit.state.careers[ID]!
  }

  it('read her growth as whole percents, her deck in order with its bonds, and the season\'s focus', () => {
    const cards = [...CONTENT_ENV.content.cards.values()]
    const deck = [cards[0]!.id, cards[7]!.id]
    const career = { ...started(), deck, season: 3 }
    const config = careerStageConfig(career, {}, CONTENT_ENV.content, 'training-yard', 99, false)
    if (isRefusal(config)) throw new Error(config.reason)
    expect(config).toMatchObject({ kind: 'training-yard', seed: 99, T: 1, practice: false, seasonFocus: 'guts' })
    expect(config.uma.growth).toEqual(Object.fromEntries(Object.entries(UMA.growthRates).map(([stat, rate]) => [stat, Math.round(rate * 100)])))
    expect(config.deck.map((card) => card.id)).toEqual(deck)
    expect(config.deck[0]!.effects).toEqual(cards[0]!.effects)
    expect(Object.keys(config.bonds)).toEqual(deck)
    expect(Object.values(config.bonds).every((bond) => bond > 0)).toBe(true) // their Initial Friendship Gauge
    expect(careerStageConfig(career, {}, CONTENT_ENV.content, 'furlong-hand', 99, false)).toMatchObject({ kind: 'furlong-hand', seasonFocus: 'guts' })
  })

  it('refuse an Uma the content doesn\'t hold, and practice outside a career has no deck', () => {
    const missing = careerStageConfig({ ...started(), umaId: 'nobody' }, {}, CONTENT_ENV.content, 'training-yard', 1, false)
    expect(isRefusal(missing) && missing.code).toBe('unknown-uma')
    expect(practiceStageConfig(UMA, 'training-yard', 5)).toMatchObject({ deck: [], bonds: {}, practice: true, seasonFocus: 'speed', seed: 5 })
    expect(() => practiceStageConfig(UMA, 'training-yard', -1)).toThrow(/seed/)
  })
})
